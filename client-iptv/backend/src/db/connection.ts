import { createRequire } from 'node:module'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { config } from '../config/env.js'

/**
 * Synchronous SQLite connection singleton (BE-04 / issue #14).
 *
 * The data layer (migrations, ETL, repositories) needs a *synchronous* handle
 * with prepared statements and transactions. This module wraps the active
 * driver behind the small {@link Db} interface so callers do not care which one
 * is in use:
 *
 *   1. Prefer `better-sqlite3` (the project default — fast, synchronous, has
 *      FTS5 compiled in).
 *   2. If its native binding fails to load (e.g. Windows without build tools),
 *      fall back to Node 22's built-in `node:sqlite` (`DatabaseSync`).
 *
 * PRAGMAs applied on open: `journal_mode=WAL`, `foreign_keys=ON`,
 * `synchronous=NORMAL`.
 *
 * NOTE: This is a separate connection from the async `client.ts` used by the
 * health route; both can coexist (SQLite WAL allows multiple connections).
 */

const require = createRequire(import.meta.url)

export type SqlParam = string | number | bigint | boolean | null | Uint8Array

/** Driver-agnostic prepared statement (only what the data layer needs). */
export interface Statement {
  get(...params: SqlParam[]): unknown
  all(...params: SqlParam[]): unknown[]
  run(...params: SqlParam[]): { changes: number; lastInsertRowid: number | bigint }
}

/** Driver-agnostic synchronous database handle. */
export interface Db {
  prepare(sql: string): Statement
  exec(sql: string): void
  /** Run `fn` inside a single transaction (BEGIN/COMMIT, ROLLBACK on throw). */
  transaction<T>(fn: () => T): T
  /** Read or set a PRAGMA (passes the raw clause, e.g. `journal_mode = WAL`). */
  pragma(clause: string): unknown
  close(): void
  readonly driver: 'better-sqlite3' | 'node:sqlite'
}

let cached: Db | null = null

/** Absolute path to the configured SQLite database file. */
export function getDatabasePath(): string {
  return resolve(process.cwd(), config.DATABASE_PATH)
}

/** Whether the database file currently exists on disk. */
export function databaseFileExists(): boolean {
  return existsSync(getDatabasePath())
}

function ensureParentDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
}

function applyPragmas(db: Db): void {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')
}

function openBetterSqlite(path: string): Db | null {
  let Database: typeof import('better-sqlite3')
  try {
    // Loaded via require so a missing native binding is a catchable throw.
    Database = require('better-sqlite3') as typeof import('better-sqlite3')
  } catch {
    return null
  }

  const db = new Database(path, { fileMustExist: false })

  const wrapped: Db = {
    driver: 'better-sqlite3',
    prepare(sql) {
      const stmt = db.prepare(sql)
      return {
        get: (...params) => stmt.get(...params),
        all: (...params) => stmt.all(...params),
        run: (...params) => {
          const info = stmt.run(...params)
          return { changes: info.changes, lastInsertRowid: info.lastInsertRowid }
        }
      }
    },
    exec: sql => {
      db.exec(sql)
    },
    transaction: fn => db.transaction(fn)(),
    pragma: clause => db.pragma(clause),
    close: () => db.close()
  }

  return wrapped
}

function openNodeSqlite(path: string): Db | null {
  let mod: typeof import('node:sqlite')
  try {
    // `node:sqlite` is experimental in Node 22; used only as a fallback.
    mod = require('node:sqlite') as typeof import('node:sqlite')
  } catch {
    return null
  }

  const db = new mod.DatabaseSync(path)

  const wrapped: Db = {
    driver: 'node:sqlite',
    prepare(sql) {
      const stmt = db.prepare(sql)
      return {
        get: (...params) => stmt.get(...(params as never[])),
        all: (...params) => stmt.all(...(params as never[])) as unknown[],
        run: (...params) => {
          const info = stmt.run(...(params as never[]))
          return {
            changes: Number(info.changes),
            lastInsertRowid: info.lastInsertRowid as number | bigint
          }
        }
      }
    },
    exec: sql => {
      db.exec(sql)
    },
    transaction: fn => {
      db.exec('BEGIN')
      try {
        const result = fn()
        db.exec('COMMIT')
        return result
      } catch (error) {
        try {
          db.exec('ROLLBACK')
        } catch {
          // ignore rollback failure; surface the original error
        }
        throw error
      }
    },
    // `node:sqlite` has no pragma() helper; PRAGMAs are issued via exec().
    pragma: clause => {
      db.exec(`PRAGMA ${clause}`)
      return undefined
    },
    close: () => db.close()
  }

  return wrapped
}

/**
 * Open a *fresh, uncached* synchronous SQLite connection at an explicit path,
 * creating the parent directory and applying the standard PRAGMAs. Throws if no
 * driver loads. Used for tests and ad-hoc multi-db scenarios; the app uses the
 * cached {@link getConnection} singleton instead.
 */
export function createConnection(path: string): Db {
  ensureParentDir(path)

  const db = openBetterSqlite(path) ?? openNodeSqlite(path)
  if (!db) {
    throw new Error(
      'No SQLite driver available (better-sqlite3 native binding failed and ' +
        'node:sqlite is not present). Install dependencies or use Node >= 22.5.'
    )
  }

  applyPragmas(db)
  return db
}

/**
 * Open (and cache) the synchronous SQLite connection at the configured path,
 * applying the standard PRAGMAs. Throws if no driver loads.
 */
export function getConnection(): Db {
  if (cached) return cached
  cached = createConnection(getDatabasePath())
  return cached
}

/** Close and reset the cached connection (used by tests and shutdown). */
export function closeConnection(): void {
  if (cached) {
    try {
      cached.close()
    } catch {
      // ignore close errors
    }
    cached = null
  }
}
