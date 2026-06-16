import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../../src/db/connection.js'
import type { LoadCounts } from '../../src/etl/load.js'

/**
 * ETL idempotency test (issue #25, BE-05/BE-15).
 *
 * Runs the real `load()` pipeline — which reads JSON via `@iptv-org/sdk` and
 * writes rows with INSERT OR REPLACE inside one transaction — against a tiny
 * fixture dataset (the 13 iptv-org JSON files in tests/fixtures/etl-data). No
 * network. Loading twice must produce identical row counts and no duplicates,
 * proving the clear+reload+FTS-rebuild path is idempotent.
 */

const here = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DATA_DIR = resolve(here, '../fixtures/etl-data')

let tmpDir: string
let load: (dataDir?: string) => Promise<LoadCounts>
let getConnection: () => Db
let closeConnection: () => void

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'iptv-etl-test-'))
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_PATH = join(tmpDir, 'iptv.db')

  // Import after env is set so the connection singleton uses the temp path.
  const conn = await import('../../src/db/connection.js')
  conn.closeConnection()
  getConnection = conn.getConnection
  closeConnection = conn.closeConnection
  ;({ load } = await import('../../src/etl/load.js'))
})

afterAll(() => {
  closeConnection()
  rmSync(tmpDir, { recursive: true, force: true })
})

function tableCount(db: Db, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  return Number(row.n)
}

describe('ETL load() is idempotent against the fixture', () => {
  let first: LoadCounts
  let second: LoadCounts

  beforeAll(async () => {
    first = await load(FIXTURE_DATA_DIR)
    second = await load(FIXTURE_DATA_DIR)
  })

  it('reports the same counts on both runs', () => {
    expect(second).toEqual(first)
  })

  it('loaded the expected fixture cardinality', () => {
    expect(first.channels).toBe(3)
    expect(first.streams).toBe(3)
    expect(first.feeds).toBe(2)
    expect(first.logos).toBe(1)
    expect(first.guides).toBe(1)
    expect(first.categories).toBe(2)
    expect(first.countries).toBe(2)
    expect(first.languages).toBe(2)
    expect(first.channels_fts).toBe(3)
  })

  it('leaves stable physical row counts after a second load (no duplicates)', () => {
    const db = getConnection()
    for (const table of [
      'channels',
      'streams',
      'feeds',
      'logos',
      'guides',
      'categories',
      'countries',
      'languages',
      'regions',
      'subdivisions',
      'cities',
      'channel_categories',
      'channel_languages',
      'region_countries',
      'channels_fts'
    ]) {
      expect(tableCount(db, table)).toBe((first as unknown as Record<string, number>)[table])
    }
  })

  it('resolves derived fields: blocklisted channel is flagged, country name denormalized', () => {
    const db = getConnection()
    const blocked = db
      .prepare(`SELECT is_blocked FROM channels WHERE id = ?`)
      .get('Blocked.us') as { is_blocked: number }
    expect(blocked.is_blocked).toBe(1)

    const cnn = db
      .prepare(`SELECT country_name FROM channels WHERE id = ?`)
      .get('CNN.us') as { country_name: string }
    expect(cnn.country_name).toBe('United States')
  })

  it('reset AUTOINCREMENT so stream ids do not grow across reloads', () => {
    const db = getConnection()
    const maxId = db.prepare(`SELECT MAX(id) AS m FROM streams`).get() as { m: number }
    // 3 streams, ids reset each load -> max id stays 3, never climbs to 6.
    expect(Number(maxId.m)).toBe(3)
  })
})
