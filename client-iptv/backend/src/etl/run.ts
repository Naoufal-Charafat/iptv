import { resolve } from 'node:path'
import { config } from '../config/env.js'
import { logger } from '../lib/logger.js'
import { closeConnection } from '../db/connection.js'
import { downloadAll } from './download.js'
import { load } from './load.js'

/**
 * ETL orchestrator (BE-05 / issue #15).
 *
 * Pipeline: download -> migrate (handled inside load) -> load -> report counts.
 *
 * Flags:
 *   --skip-download   reuse datasets already in DATA_DIR (no network).
 *   --seed            offline mode: read the local snapshots in temp/data and
 *                     skip downloading entirely (used by `npm run seed`).
 *   --data-dir <dir>  override the dataset directory.
 *
 * `npm run etl`   -> full pipeline (download + load) into DATA_DIR.
 * `npm run seed`  -> offline load from ../../temp/data (no network).
 */

interface Options {
  skipDownload: boolean
  seed: boolean
  dataDir: string
}

function parseArgs(argv: string[]): Options {
  const seed = argv.includes('--seed')
  const skipDownload = seed || argv.includes('--skip-download')

  const idx = argv.indexOf('--data-dir')
  const explicitDir = idx >= 0 ? argv[idx + 1] : undefined

  // In seed mode default to the repo's local snapshots (relative to backend cwd).
  const dataDir = explicitDir ?? (seed ? '../../temp/data' : config.DATA_DIR)

  return { skipDownload, seed, dataDir }
}

export async function run(options: Options): Promise<void> {
  const absDir = resolve(process.cwd(), options.dataDir)
  logger.info(
    { dataDir: absDir, seed: options.seed, skipDownload: options.skipDownload },
    'ETL pipeline starting'
  )

  if (!options.skipDownload) {
    const summary = await downloadAll(options.dataDir)
    if (summary.failed.length > 0) {
      logger.warn({ failed: summary.failed }, 'continuing with partial download')
    }
  } else {
    logger.info('skip-download: reusing existing datasets')
  }

  const counts = await load(options.dataDir)

  // Final per-table report (issue #15 acceptance criterion).
  console.log('\nETL finished. Row counts per table:')
  console.table(counts)
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  try {
    await run(options)
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'ETL failed'
    )
    process.exitCode = 1
  } finally {
    closeConnection()
  }
}

void main()
