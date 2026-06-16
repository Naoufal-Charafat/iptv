import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DataManager } from '@iptv-org/sdk'
import { config } from '../config/env.js'
import { logger } from '../lib/logger.js'

/**
 * ETL download stage (BE-05 / issue #15).
 *
 * Uses `@iptv-org/sdk`'s `DataManager` to fetch the 13 iptv-org JSON datasets
 * into `config.DATA_DIR`. Each file is downloaded independently so one failure
 * does not abort the rest; a summary is logged at the end.
 *
 * NOTE: This performs network I/O and is only invoked by `etl:download` /
 * `etl` (full). The offline `seed` path reads the local snapshots in
 * `temp/data` instead and never calls this.
 */

/** The 13 dataset basenames the SDK manages. */
export const DATA_FILES = [
  'blocklist',
  'categories',
  'channels',
  'cities',
  'countries',
  'feeds',
  'guides',
  'languages',
  'logos',
  'regions',
  'streams',
  'subdivisions',
  'timezones'
] as const

export interface DownloadSummary {
  ok: string[]
  failed: { file: string; error: string }[]
}

/**
 * Download all datasets to `dataDir`. Returns a per-file summary. Never throws
 * for individual file failures; only a misconfigured environment throws.
 */
export async function downloadAll(dataDir = config.DATA_DIR): Promise<DownloadSummary> {
  const absDir = resolve(process.cwd(), dataDir)
  logger.info({ dataDir: absDir }, 'ETL download: fetching iptv-org datasets')

  const manager = new DataManager({ dataDir: absDir })
  const summary: DownloadSummary = { ok: [], failed: [] }

  for (const file of DATA_FILES) {
    try {
      await manager.downloadFileToDisk(file)
      summary.ok.push(file)
      logger.debug({ file }, 'downloaded')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      summary.failed.push({ file, error: message })
      logger.warn({ file, error: message }, 'download failed (continuing)')
    }
  }

  logger.info(
    { ok: summary.ok.length, failed: summary.failed.length },
    'ETL download complete'
  )
  return summary
}

/** CLI entrypoint for `npm run etl:download`. */
async function main(): Promise<void> {
  const summary = await downloadAll()
  if (summary.failed.length > 0) {
    logger.error({ failed: summary.failed }, 'some datasets failed to download')
    process.exitCode = 1
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (invokedDirectly) {
  void main()
}

/** Whether the expected dataset files already exist in `dataDir`. */
export function datasetsExist(dataDir: string): boolean {
  const absDir = resolve(process.cwd(), dataDir)
  return existsSync(resolve(absDir, 'channels.json'))
}
