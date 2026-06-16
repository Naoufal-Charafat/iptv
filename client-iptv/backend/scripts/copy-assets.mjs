// Copies non-TS runtime assets into dist/ after the TypeScript build.
// tsc only emits .js/.d.ts, so the SQL schema must be copied manually.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const assets = [['src/db/schema.sql', 'dist/db/schema.sql']]

for (const [from, to] of assets) {
  const src = resolve(root, from)
  const dest = resolve(root, to)
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  console.log(`copied ${from} -> ${to}`)
}
