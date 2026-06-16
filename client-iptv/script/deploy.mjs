#!/usr/bin/env node
/**
 * client-iptv — deploy local con panel de control interactivo.
 *
 * Arranque inicial:
 *   1. CLEAN    — borra artefactos previos (dist/, *.db, .gh-pages/).
 *   2. PLAYLIST — ejecuta `npm run playlist:generate` en el proyecto iptv padre.
 *   3. SEED     — puebla la BD SQLite del backend desde los datos locales (sin red).
 *   4. PUERTOS  — asegura que 3001 (backend) y 5173 (frontend) estan libres.
 *   5. UP       — levanta backend y frontend como procesos independientes.
 *
 * Despues queda un MENU interactivo SIEMPRE disponible:
 *   [1] Regenerar canales  -> playlist:generate + re-seed + reinicia el backend.
 *   [2] Reiniciar backend
 *   [3] Reiniciar frontend
 *   [4] Ver URLs / estado
 *   [5] Cerrar todo y salir (mata backend + frontend y libera los puertos).
 *
 * Nota: el backend sirve datos desde su BD SQLite (poblada por el SEED), NO desde
 * los .m3u de playlist:generate. Por eso "Regenerar canales" re-siembra la BD y
 * reinicia el backend para que sirva los datos frescos sin bloqueos.
 *
 * Uso:  node script/deploy.mjs   (o:  npm run deploy)
 * Env:  BACKEND_PORT (3001) · FRONTEND_PORT (5173) · SKIP_CLEAN/SKIP_PLAYLIST/SKIP_SEED=1
 *       VITE_USE_MOCKS / VITE_API_BASE_URL (por defecto el frontend apunta al backend real)
 *
 * Cross-platform (Windows / macOS / Linux). Requiere Node >= 22.
 */
import { spawn, spawnSync, execSync } from 'node:child_process'
import { existsSync, rmSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'
import net from 'node:net'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = resolve(SCRIPT_DIR, '..') // client-iptv/
const REPO_ROOT = resolve(CLIENT_DIR, '..') // proyecto iptv padre (tiene playlist:generate)
const BACKEND_DIR = join(CLIENT_DIR, 'backend')
const IS_WIN = process.platform === 'win32'
const NPM = IS_WIN ? 'npm.cmd' : 'npm'

const BACKEND_PORT = Number(process.env.BACKEND_PORT || 3001)
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 5173)

// ── estilo ──────────────────────────────────────────────────────────────────
const B = '\x1b[1m'
const R = '\x1b[0m'
const DIM = '\x1b[2m'
const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'

/** @type {{backend: import('node:child_process').ChildProcess | null, frontend: import('node:child_process').ChildProcess | null}} */
const children = { backend: null, frontend: null }
let rl = null
let shuttingDown = false

const delay = ms => new Promise(r => setTimeout(r, ms))

/** Imprime una linea respetando el prompt del menu (lo redibuja debajo). */
function printLine(text = '') {
  if (rl) {
    readline.clearLine(process.stdout, 0)
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(text + '\n')
    rl.prompt(true)
  } else {
    process.stdout.write(text + '\n')
  }
}
const banner = (step, msg) => printLine(`\n${B}${CYAN}[deploy ${step}]${R} ${msg}`)
const warn = msg => printLine(`${YELLOW}  ⚠ ${msg}${R}`)

/** Ejecuta un comando de forma sincrona mostrando su salida en vivo. */
function runSync(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: IS_WIN })
  return res.status === 0
}

function removeIfExists(p) {
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true })
    printLine(`  rm ${p}`)
  }
}

/** Borra recursivamente *.db / *.db-wal / *.db-shm bajo dir (salta node_modules). */
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

// ── puertos ───────────────────────────────────────────────────────────────
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

function killPidTree(pid) {
  if (!pid) return
  if (IS_WIN) {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' })
    } catch {
      /* ya no existe */
    }
    return
  }
  // POSIX: el hijo se lanza con detached, asi que su PID es lider del grupo.
  try {
    process.kill(-pid, 'SIGKILL') // mata todo el grupo (npm + node hijos)
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* ya no existe */
    }
  }
}

function killPortListeners(port) {
  listenersOnPort(port).forEach(killPidTree)
}

function isPortFree(port) {
  return new Promise(res => {
    const srv = net.createServer()
    srv.once('error', () => res(false))
    srv.once('listening', () => srv.close(() => res(true)))
    srv.listen(port, '127.0.0.1')
  })
}

async function ensurePortFree(port, label) {
  if (await isPortFree(port)) {
    printLine(`  puerto ${port} (${label}) libre ✓`)
    return
  }
  const pids = listenersOnPort(port)
  if (pids.length) {
    printLine(`  puerto ${port} (${label}) ocupado por PID ${pids.join(', ')} — liberando…`)
    pids.forEach(killPidTree)
  }
  for (let i = 0; i < 20 && !(await isPortFree(port)); i++) await delay(150)
  if (await isPortFree(port)) printLine(`  puerto ${port} (${label}) libre ✓`)
  else warn(`no se pudo liberar el puerto ${port} (${label})`)
}

// ── procesos backend / frontend ─────────────────────────────────────────────
function attachOutput(name, child, color) {
  const onData = buf => {
    for (const ln of buf.toString().split(/\r?\n/)) {
      if (ln.trim() !== '') printLine(`${color}${DIM}[${name}]${R} ${ln}`)
    }
  }
  child.stdout?.on('data', onData)
  child.stderr?.on('data', onData)
}

function startBackend() {
  if (children.backend) {
    printLine('backend ya esta corriendo')
    return
  }
  killPortListeners(BACKEND_PORT)
  const env = { ...process.env, PORT: String(BACKEND_PORT), HOST: process.env.HOST || '0.0.0.0' }
  const c = spawn(NPM, ['run', 'dev'], {
    cwd: BACKEND_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: IS_WIN, // Windows: necesario para lanzar npm.cmd (Node 22 / CVE-2024-27980)
    detached: !IS_WIN // POSIX: grupo propio para poder matar el arbol entero
  })
  attachOutput('backend', c, CYAN)
  c.on('exit', code => {
    if (children.backend === c) {
      children.backend = null
      if (!shuttingDown) printLine(`${YELLOW}[backend] termino (code ${code})${R}`)
    }
  })
  children.backend = c
  printLine(`${CYAN}▶ backend${R} lanzado (PID ${c.pid}) → http://localhost:${BACKEND_PORT}`)
}

function startFrontend() {
  if (children.frontend) {
    printLine('frontend ya esta corriendo')
    return
  }
  killPortListeners(FRONTEND_PORT)
  const env = {
    ...process.env,
    VITE_USE_MOCKS: process.env.VITE_USE_MOCKS ?? 'false',
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? `http://localhost:${BACKEND_PORT}/api`
  }
  const c = spawn(NPM, ['run', 'dev'], {
    cwd: join(CLIENT_DIR, 'frontend'),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: IS_WIN,
    detached: !IS_WIN
  })
  attachOutput('frontend', c, MAGENTA)
  c.on('exit', code => {
    if (children.frontend === c) {
      children.frontend = null
      if (!shuttingDown) printLine(`${YELLOW}[frontend] termino (code ${code})${R}`)
    }
  })
  children.frontend = c
  printLine(`${MAGENTA}▶ frontend${R} lanzado (PID ${c.pid}) → http://localhost:${FRONTEND_PORT}`)
}

function stopProc(name) {
  const c = children[name]
  if (!c) return false
  children[name] = null
  killPidTree(c.pid)
  return true
}

async function restart(name) {
  printLine(`Reiniciando ${name}…`)
  stopProc(name)
  await delay(700)
  if (name === 'backend') startBackend()
  else startFrontend()
}

async function regenerate() {
  printLine(`\n${B}Regenerando canales…${R}`)
  stopProc('backend') // libera la BD antes de re-sembrar
  await delay(500)
  if (rl) rl.pause()
  printLine(`${DIM}› npm run playlist:generate (${REPO_ROOT})${R}`)
  if (!runSync(NPM, ['run', 'playlist:generate'], REPO_ROOT)) warn('playlist:generate fallo')
  removeDbFiles(BACKEND_DIR)
  printLine(`${DIM}› npm run seed (backend)${R}`)
  if (!runSync(NPM, ['run', 'seed'], BACKEND_DIR)) warn('seed fallo; el backend podria ir vacio')
  if (rl) rl.resume()
  startBackend()
  printLine(`${GREEN}✓ Canales regenerados y backend reiniciado${R}`)
}

// ── menu ────────────────────────────────────────────────────────────────────
function printUrls() {
  printLine('')
  printLine(`${B}${GREEN}  App  →${R} http://localhost:${FRONTEND_PORT}`)
  printLine(`${B}  API  →${R} http://localhost:${BACKEND_PORT}/api/health`)
  printLine(
    `  ${DIM}estado:${R} backend ${children.backend ? GREEN + 'on' + R : YELLOW + 'off' + R}` +
      ` · frontend ${children.frontend ? GREEN + 'on' + R : YELLOW + 'off' + R}`
  )
  printLine('')
}

function showMenu() {
  printLine(
    [
      '',
      `${B}── client-iptv · menú ─────────────────────────${R}`,
      '  [1] Regenerar canales (playlist + seed + reinicia backend)',
      '  [2] Reiniciar backend',
      '  [3] Reiniciar frontend',
      '  [4] Ver URLs / estado',
      '  [5] Cerrar todo y salir',
      `  ${DIM}[m] menú · [Ctrl+C] salir${R}`,
      '────────────────────────────────────────────────'
    ].join('\n')
  )
}

async function onCommand(cmd) {
  switch (cmd) {
    case '1':
    case 'r':
      await regenerate()
      break
    case '2':
    case 'b':
      await restart('backend')
      break
    case '3':
    case 'f':
      await restart('frontend')
      break
    case '4':
    case 'u':
    case 's':
      printUrls()
      break
    case '5':
    case 'q':
    case 'quit':
    case 'exit':
      shutdown(0)
      return
    case '':
    case 'm':
    case 'h':
    case 'menu':
      showMenu()
      break
    default:
      printLine(`Opción no reconocida: "${cmd}"  (pulsa ${B}m${R} para el menú)`)
  }
  if (rl) rl.prompt()
}

function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true
  printLine(`\n${B}Cerrando todo…${R}`)
  stopProc('backend')
  stopProc('frontend')
  killPortListeners(BACKEND_PORT)
  killPortListeners(FRONTEND_PORT)
  printLine(
    `${GREEN}✓ backend y frontend detenidos · puertos ${BACKEND_PORT}/${FRONTEND_PORT} liberados${R}`
  )
  if (rl) rl.close()
  process.exit(code)
}

async function main() {
  console.log(
    `${B}client-iptv · deploy local${R}  (backend :${BACKEND_PORT} · frontend :${FRONTEND_PORT})`
  )

  if (process.env.SKIP_CLEAN) banner('1/5 clean', 'omitido (SKIP_CLEAN)')
  else {
    banner('1/5 clean', 'borrando artefactos previos')
    // OJO: NO borrar shared/dist — el backend lo importa en runtime desde
    // node_modules/@client-iptv/shared/dist. Solo limpiamos los dist de los apps.
    for (const ws of ['backend', 'frontend']) removeIfExists(join(CLIENT_DIR, ws, 'dist'))
    removeDbFiles(BACKEND_DIR)
    removeIfExists(join(REPO_ROOT, '.gh-pages'))
  }

  // El backend y el seed importan @client-iptv/shared desde su dist compilado.
  // Lo (re)compilamos siempre para evitar ERR_MODULE_NOT_FOUND.
  banner('2/5 shared', 'compilando @client-iptv/shared (lo usa el backend)')
  if (!runSync(NPM, ['run', 'build', '--workspace', '@client-iptv/shared'], CLIENT_DIR))
    warn('no se pudo compilar shared; el backend fallara al importarlo')

  if (process.env.SKIP_PLAYLIST) banner('3/5 playlists', 'omitido (SKIP_PLAYLIST)')
  else {
    banner('3/5 playlists', `npm run playlist:generate  (en ${REPO_ROOT})`)
    if (!runSync(NPM, ['run', 'playlist:generate'], REPO_ROOT))
      warn('playlist:generate fallo (¿faltan deps/datos del proyecto iptv?). Continuo.')
  }

  if (process.env.SKIP_SEED) banner('4/5 seed', 'omitido (SKIP_SEED)')
  else {
    banner('4/5 seed', 'poblando la BD SQLite del backend (npm run seed)')
    if (!runSync(NPM, ['run', 'seed'], BACKEND_DIR)) warn('seed fallo; el backend podria ir vacio.')
  }

  banner('5/5 puertos', 'asegurando que los puertos estan libres')
  await ensurePortFree(BACKEND_PORT, 'backend')
  await ensurePortFree(FRONTEND_PORT, 'frontend')

  banner('up', 'levantando backend + frontend')
  startBackend()
  startFrontend()

  rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'deploy> ' })
  rl.on('line', line => {
    onCommand(line.trim().toLowerCase())
  })
  rl.on('SIGINT', () => shutdown(0))

  printUrls()
  showMenu()
  rl.prompt()
}

process.on('SIGTERM', () => shutdown(0))
process.on('uncaughtException', err => {
  printLine(`\x1b[31m[deploy] error: ${err?.message || err}\x1b[0m`)
})

main().catch(err => {
  console.error('\x1b[31m[deploy] error inesperado:\x1b[0m', err)
  shutdown(1)
})
