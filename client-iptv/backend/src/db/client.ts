import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from '../config/env.js'

/**
 * Minimal SQLite access layer (BE-03 / issue #13).
 *
 * The DB driver is loaded lazily and defensively:
 *  1. Prefer `better-sqlite3` (fast, synchronous, the project default).
 *  2. If its native binding fails to load (common on Windows without build
 *     tools), fall back to Node 22's built-in `node:sqlite`.
 *
 * Both drivers are normalized behind the small {@link SqliteDatabase} interface
 * so the rest of the backend does not care which one is active. The connection
 * is opened on demand; callers (e.g. the db healthcheck) must tolerate a `null`
 * handle when the database file does not exist yet.
 */

/** Driver-agnostic statement handle (only what the backend needs). */
export interface SqliteStatement {
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
  run(...params: unknown[]): unknown
}

/** Driver-agnostic database handle. */
export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement
  exec(sql: string): void
  close(): void
  /** Which underlying driver is in use, for diagnostics. */
  readonly driver: 'better-sqlite3' | 'node:sqlite'
}

let cached: SqliteDatabase | null | undefined

/** Absolute path to the configured SQLite database file. */
export function getDatabasePath(): string {
  return resolve(process.cwd(), config.DATABASE_PATH)
}

/** Whether the database file currently exists on disk. */
export function databaseFileExists(): boolean {
  return existsSync(getDatabasePath())
}

async function openWithBetterSqlite(path: string): Promise<SqliteDatabase | null> {
  try {
    const mod = await import('better-sqlite3')
    const Database = mod.default
    const db = new Database(path, { fileMustExist: false })
    db.pragma('journal_mode = WAL')
    return {
      driver: 'better-sqlite3',
      prepare: sql => db.prepare(sql) as unknown as SqliteStatement,
      exec: sql => db.exec(sql),
      close: () => db.close()
    }
  } catch {
    return null
  }
}

async function openWithNodeSqlite(path: string): Promise<SqliteDatabase | null> {
  try {
    // `node:sqlite` is experimental in Node 22; used only as a fallback.
    const mod = await import('node:sqlite')
    const DatabaseSync = mod.DatabaseSync
    const db = new DatabaseSync(path)
    db.exec('PRAGMA journal_mode = WAL')
    return {
      driver: 'node:sqlite',
      prepare: sql => {
        const stmt = db.prepare(sql)
        return {
          get: (...params: unknown[]) =>
            stmt.get(...(params as Parameters<typeof stmt.get>)),
          all: (...params: unknown[]) =>
            stmt.all(...(params as Parameters<typeof stmt.all>)) as unknown[],
          run: (...params: unknown[]) =>
            stmt.run(...(params as Parameters<typeof stmt.run>))
        }
      },
      exec: sql => db.exec(sql),
      close: () => db.close()
    }
  } catch {
    return null
  }
}

/**
 * Open (and cache) the SQLite connection.
 *
 * Returns `null` when no driver can be loaded. The connection itself is created
 * even if the file is empty/missing so migrations can bootstrap it; the db
 * healthcheck distinguishes "file missing" from "driver missing".
 */
export async function getDb(): Promise<SqliteDatabase | null> {
  if (cached !== undefined) return cached

  const path = getDatabasePath()
  cached = (await openWithBetterSqlite(path)) ?? (await openWithNodeSqlite(path))
  return cached
}

/** Close and reset the cached connection (used by tests and shutdown). */
export function closeDb(): void {
  if (cached) {
    try {
      cached.close()
    } catch {
      // ignore close errors
    }
  }
  cached = undefined
}
