import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Resolve the backend package version once at module load, for the healthcheck.
 * Falls back to `0.0.0` if package.json cannot be read (e.g. unusual packaging).
 */
function resolveVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    // src/lib -> package root is two levels up at runtime (dist/lib too).
    const pkgPath = resolve(here, '..', '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export const APP_VERSION = resolveVersion()
