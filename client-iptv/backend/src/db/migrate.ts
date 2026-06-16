import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { closeConnection, getConnection, getDatabasePath, type Db } from './connection.js'

/**
 * Idempotent migration runner (BE-04 / issue #14).
 *
 * Applies `schema.sql` to the configured database. A `_meta(key, value)` table
 * records the applied `schema_version`; re-running the migration is a no-op
 * because every DDL statement uses `IF NOT EXISTS` and the version guard skips
 * already-applied schemas.
 */

/** Bump when `schema.sql` changes (so existing DBs re-apply the schema). */
export const SCHEMA_VERSION = 2

const here = dirname(fileURLToPath(import.meta.url))

/** Locate `schema.sql`: next to the source in dev, copied into dist on build. */
function readSchemaSql(): string {
  // `here` is .../src/db (tsx) or .../dist/db (compiled). The .sql sits beside
  // this module in both cases (the build step copies it into dist/db).
  return readFileSync(resolve(here, 'schema.sql'), 'utf8')
}

function ensureMetaTable(db: Db): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
}

function getSchemaVersion(db: Db): number {
  const row = db.prepare(`SELECT value FROM _meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined
  return row ? Number(row.value) : 0
}

function setSchemaVersion(db: Db, version: number): void {
  db.prepare(
    `INSERT INTO _meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(version))
}

/**
 * Apply the schema (idempotent). Returns the resulting schema version. Safe to
 * call repeatedly; only re-applies DDL when the recorded version is older.
 */
export function runMigrations(db: Db = getConnection()): number {
  ensureMetaTable(db)
  const current = getSchemaVersion(db)

  // The schema is fully `IF NOT EXISTS`, so applying it again is harmless; we
  // still gate on the version to skip the (cheap) DDL replay once up to date.
  if (current >= SCHEMA_VERSION) {
    return current
  }

  const schema = readSchemaSql()
  db.transaction(() => {
    db.exec(schema)
    setSchemaVersion(db, SCHEMA_VERSION)
  })

  return SCHEMA_VERSION
}

/** CLI entrypoint for `npm run db:migrate`. */
function main(): void {
  const db = getConnection()
  const version = runMigrations(db)
  console.log(
    `Schema applied at ${getDatabasePath()} ` +
      `(driver: ${db.driver}, schema_version: ${version}).`
  )
  closeConnection()
}

// Run only when invoked directly (not when imported by the ETL/tests).
const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (invokedDirectly) {
  main()
}
