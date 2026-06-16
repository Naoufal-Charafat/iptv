import type { Db, Statement } from './connection.js'

/**
 * Full-text search index for channels (BE-06 / issue #16).
 *
 * A contentless-ish FTS5 virtual table `channels_fts` indexes the denormalized,
 * searchable channel fields produced by the SDK's `Channel.getSearchable()`
 * (name, alt_names, country name, categories, network, owners, languages). The
 * `channel_id` column is UNINDEXED so it can be selected back without bloating
 * the index. The tokenizer uses `unicode61 remove_diacritics 2` for
 * accent/case-insensitive matching.
 */

/** A single channel row to feed into the FTS index. */
export interface ChannelFtsRow {
  channel_id: string
  name: string
  alt_names: string
  country_name: string
  categories: string
  network: string
  owners: string
  languages: string
}

const CREATE_FTS_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS channels_fts USING fts5 (
  name,
  alt_names,
  country_name,
  categories,
  network,
  owners,
  languages,
  channel_id UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
)
`

/** Create the `channels_fts` virtual table if it does not exist. */
export function createFtsTable(db: Db): void {
  db.exec(CREATE_FTS_SQL)
}

/** Drop the FTS table (used to fully rebuild from scratch). */
export function dropFtsTable(db: Db): void {
  db.exec('DROP TABLE IF EXISTS channels_fts')
}

/**
 * Rebuild `channels_fts` from the provided rows. Drops and recreates the table
 * so a re-run never leaves stale entries, then bulk-inserts. Intended to be
 * called inside the ETL's transaction.
 *
 * @returns the number of indexed rows.
 */
export function rebuildFtsIndex(db: Db, rows: Iterable<ChannelFtsRow>): number {
  dropFtsTable(db)
  createFtsTable(db)

  const insert = db.prepare(
    `INSERT INTO channels_fts
       (name, alt_names, country_name, categories, network, owners, languages, channel_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )

  let count = 0
  for (const row of rows) {
    insert.run(
      row.name,
      row.alt_names,
      row.country_name,
      row.categories,
      row.network,
      row.owners,
      row.languages,
      row.channel_id
    )
    count++
  }

  return count
}

/**
 * Escape a user query for FTS5 MATCH. Splits on whitespace and wraps each token
 * as a quoted prefix term (`"tok"*`) so the search is forgiving and never
 * triggers FTS5 syntax errors from special characters.
 */
export function toMatchQuery(query: string): string {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map(t => t.replace(/"/g, '')) // strip quotes that would break the literal
    .filter(Boolean)

  if (tokens.length === 0) return ''
  return tokens.map(t => `"${t}"*`).join(' ')
}

export interface SearchHit {
  channel_id: string
  rank: number
}

let searchStmt: Statement | null = null
let searchStmtDb: Db | null = null
let countStmt: Statement | null = null
let countStmtDb: Db | null = null

/**
 * Restrict FTS hits to *playable* channels (non-blocked + at least one stream),
 * the same guarantee as `/api/channels`. Applying this INSIDE the FTS query —
 * before LIMIT/OFFSET — is what keeps pages full and the total accurate; doing
 * it after pagination would yield short or empty pages.
 */
const PLAYABLE_FILTER = `
  AND EXISTS (
    SELECT 1 FROM channels c
     WHERE c.id = channels_fts.channel_id
       AND c.is_blocked = 0
       AND EXISTS (SELECT 1 FROM streams s WHERE s.channel = c.id)
  )`

function getSearchStmt(db: Db): Statement {
  if (searchStmt && searchStmtDb === db) return searchStmt
  searchStmt = db.prepare(
    `SELECT channel_id, bm25(channels_fts) AS rank
       FROM channels_fts
      WHERE channels_fts MATCH ?${PLAYABLE_FILTER}
      ORDER BY rank
      LIMIT ? OFFSET ?`
  )
  searchStmtDb = db
  return searchStmt
}

function getCountStmt(db: Db): Statement {
  if (countStmt && countStmtDb === db) return countStmt
  countStmt = db.prepare(
    `SELECT COUNT(*) AS total
       FROM channels_fts
      WHERE channels_fts MATCH ?${PLAYABLE_FILTER}`
  )
  countStmtDb = db
  return countStmt
}

/** Exact count of playable channels matching the query (for pagination total). */
export function countChannelMatches(db: Db, query: string): number {
  const match = toMatchQuery(query)
  if (!match) return 0
  const row = getCountStmt(db).get(match) as { total: number }
  return row.total
}

/**
 * Search channel IDs ordered by relevance (bm25). Returns an empty array for a
 * blank query. Parameters are always bound (no SQL injection).
 */
export function searchChannelIds(
  db: Db,
  query: string,
  limit = 50,
  offset = 0
): SearchHit[] {
  const match = toMatchQuery(query)
  if (!match) return []

  const safeLimit = Math.max(1, Math.min(limit, 200))
  const safeOffset = Math.max(0, offset)

  const stmt = getSearchStmt(db)
  return stmt.all(match, safeLimit, safeOffset) as SearchHit[]
}

/** Reset the cached search statement (used by tests when reopening the db). */
export function resetFtsCache(): void {
  searchStmt = null
  searchStmtDb = null
  countStmt = null
  countStmtDb = null
}
