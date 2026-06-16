#!/usr/bin/env node
/**
 * client-iptv — deploy local.
 *
 * Orquesta un arranque local limpio del cliente IPTV:
 *   1. CLEAN          — borra artefactos previos (dist/, *.db, .gh-pages/).
 *   2. PLAYLIST       — ejecuta `npm run playlist:generate` en el proyecto iptv padre.
 *   3. SEED           — puebla la BD SQLite del backend desde los datos locales (sin red).
 *   4. FREE PORTS     — asegura que los puertos del backend (3001) y frontend (5173)
 *                       estan LIBRES antes de levantar (mata cualquier proceso que los ocupe).
 *   5. UP             — levanta backend + frontend en paralelo (queda en primer plano).
 *
 * Uso:   node script/deploy.mjs        (o:  npm run deploy)
 *
 * Variables de entorno opcionales:
 *   BACKEND_PORT (3001) · FRONTEND_PORT (5173)
 *   SKIP_PLAYLIST=1 · SKIP_SEED=1 · SKIP_CLEAN=1   (saltan el paso correspondiente)
 *   VITE_USE_MOCKS / VITE_API_BASE_URL              (por defecto se cablea el frontend al backend real)
 *
 * Cross-platform (Windows / macOS / Linux). Requiere Node >= 22 y que el
 * proyecto iptv padre tenga sus dependencias instaladas (para playlist:generate).
 */
import { spawnSync, execSync } from 'node:child_process'
import { existsSync, rmSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = resolve(SCRIPT_DIR, '..') // client-iptv/
const REPO_ROOT = resolve(CLIENT_DIR, '..') // proyecto iptv padre (tiene playlist:generate)
const IS_WIN = process.platform === 'win32'

const BACKEND_PORT = Number(process.env.BACKEND_PORT || 3001)
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 5173)

function banner(step, msg) {
  console.log(`\n\x1b[1m\x1b[36m[deploy ${step}]\x1b[0m ${msg}`)
}
function warn(msg) {
  console.log(`\x1b[33m  ⚠ ${msg}\x1b[0m`)
}

/** Ejecuta un comando de forma sincrona mostrando su salida en vivo. */
function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true })
  return res.status === 0
}

/** Borra una ruta (fichero o carpeta) si existe. */
function removeIfExists(p) {
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true })
    console.log(`  rm ${p}`)
  }
}

/** Borra recursivamente ficheros que terminan en .db / .db-wal / .db-shm bajo dir. */
function removeDbFiles(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue
    const full = join(dir, entry)
    let s
    try {
      s = statSync(full)
    } catch {
      continue
    }
    if (s.isDirectory()) removeDbFiles(full)
    else if (/\.db(-wal|-shm)?$/.test(entry)) removeIfExists(full)
  }
}

/** PIDs que escuchan en un puerto TCP (cross-platform). */
function listenersOnPort(port) {
  const pids = new Set()
  try {
    if (IS_WIN) {
      const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' })
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i)
        if (m && Number(m[1]) === port) pids.add(m[2])
      }
    } else {
      const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN 2>/dev/null || true`, {
        encoding: 'utf8'
      })
      out.split(/\s+/).filter(Boolean).forEach(p => pids.add(p))
    }
  } catch {
    /* sin listeners o herramienta no disponible */
  }
  return [...pids].filter(p => p && p !== '0')
}

function killPid(pid) {
  try {
    if (IS_WIN) execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' })
    else execSync(`kill -9 ${pid}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** Comprueba (probando a escuchar) si un puerto esta libre. */
function isPortFree(port) {
  return new Promise(resolve_ => {
    const srv = net.createServer()
    srv.once('error', () => resolve_(false))
    srv.once('listening', () => srv.close(() => resolve_(true)))
    srv.listen(port, '127.0.0.1')
  })
}

async function ensurePortFree(port, label) {
  if (await isPortFree(port)) {
    console.log(`  puerto ${port} (${label}) libre ✓`)
    return
  }
  const pids = listenersOnPort(port)
  if (pids.length === 0) {
    warn(`puerto ${port} (${label}) ocupado pero no se identifico el proceso; intento continuar`)
    return
  }
  console.log(`  puerto ${port} (${label}) ocupado por PID ${pids.join(', ')} — liberando…`)
  pids.forEach(killPid)
  // pequeña espera activa a que el SO libere el socket
  for (let i = 0; i < 20 && !(await isPortFree(port)); i++) {
    await new Promise(r => setTimeout(r, 150))
  }
  if (await isPortFree(port)) console.log(`  puerto ${port} (${label}) liberado ✓`)
  else warn(`no se pudo liberar el puerto ${port} (${label}); el arranque podria fallar`)
}

async function main() {
  console.log(`\x1b[1mclient-iptv · deploy local\x1b[0m  (backend :${BACKEND_PORT} · frontend :${FRONTEND_PORT})`)

  // 1) CLEAN ------------------------------------------------------------------
  if (process.env.SKIP_CLEAN) {
    banner('1/5 clean', 'omitido (SKIP_CLEAN)')
  } else {
    banner('1/5 clean', 'borrando artefactos previos')
    for (const ws of ['shared', 'backend', 'frontend']) {
      removeIfExists(join(CLIENT_DIR, ws, 'dist'))
    }
    removeDbFiles(join(CLIENT_DIR, 'backend'))
    removeIfExists(join(REPO_ROOT, '.gh-pages'))
  }

  // 2) PLAYLIST:GENERATE (proyecto iptv padre) --------------------------------
  if (process.env.SKIP_PLAYLIST) {
    banner('2/5 playlists', 'omitido (SKIP_PLAYLIST)')
  } else {
    banner('2/5 playlists', `npm run playlist:generate  (en ${REPO_ROOT})`)
    if (!run('npm', ['run', 'playlist:generate'], REPO_ROOT)) {
      warn('playlist:generate fallo (¿faltan dependencias/datos del proyecto iptv?). Continuo: el cliente no depende de .gh-pages.')
    }
  }

  // 3) SEED de la BD del backend (datos locales, sin red) ----------------------
  if (process.env.SKIP_SEED) {
    banner('3/5 seed', 'omitido (SKIP_SEED)')
  } else {
    banner('3/5 seed', 'poblando la BD SQLite del backend (npm run seed)')
    if (!run('npm', ['run', 'seed'], join(CLIENT_DIR, 'backend'))) {
      warn('seed fallo; el backend arrancara pero podria servir datos vacios.')
    }
  }

  // 4) FREE PORTS -------------------------------------------------------------
  banner('4/5 puertos', 'asegurando que los puertos estan libres')
  await ensurePortFree(BACKEND_PORT, 'backend')
  await ensurePortFree(FRONTEND_PORT, 'frontend')

  // 5) UP ---------------------------------------------------------------------
  banner('5/5 up', 'levantando backend + frontend (Ctrl+C para parar)')
  // Cablea el frontend al backend real salvo que el usuario lo sobreescriba.
  process.env.VITE_USE_MOCKS = process.env.VITE_USE_MOCKS ?? 'false'
  process.env.VITE_API_BASE_URL = process.env.VITE_API_BASE_URL ?? `http://localhost:${BACKEND_PORT}`
  process.env.PORT = String(BACKEND_PORT)
  const ok = run('npm', ['run', 'dev'], CLIENT_DIR)
  process.exit(ok ? 0 : 1)
}

main().catch(err => {
  console.error('\x1b[31m[deploy] error inesperado:\x1b[0m', err)
  process.exit(1)
})
