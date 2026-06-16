# client-iptv

Personal web IPTV client built on top of the [iptv-org](https://github.com/iptv-org/iptv)
dataset. It is a **local, single-user** application (no login, not intended for
production hosting): browse channels across 8 navigation dimensions, search with
full-text search, and play live streams in the browser.

This package lives inside the `iptv` repository as a self-contained monorepo under
`client-iptv/`. It does not interfere with the parent repo's playlist tooling.

## Architecture

A monorepo with three npm workspaces:

| Workspace                 | Stack                                                                      | Role                                                    |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `@client-iptv/frontend`   | React + Vite + TypeScript + Tailwind CSS + shadcn/ui + hls.js + TanStack Query + React Router | Web UI ("Cinematic Glassmorphism" design system) |
| `@client-iptv/backend`    | Node.js + TypeScript + Fastify + SQLite (better-sqlite3 / FTS5) + Zod      | REST API over `iptv.db`, plus the ETL that builds it    |
| `@client-iptv/shared`     | TypeScript                                                                 | Shared types and the API contract                       |

The frontend calls the backend at `/api/*`. During development Vite proxies
`/api` to the Fastify server, so there are no CORS issues.

```
client-iptv/
├── package.json            # root workspace + tooling scripts (dev/build/lint/format/typecheck)
├── tsconfig.base.json      # shared TS compiler options (extended by every package)
├── eslint.config.mjs       # shared flat ESLint config
├── .prettierrc             # shared Prettier config (matches parent iptv repo)
├── .prettierignore
├── .env.example            # documented environment variables
├── README.md               # you are here
├── shared/                 # @client-iptv/shared — types + API contract (see shared/README.md)
├── backend/                # @client-iptv/backend — Fastify API + ETL
│   └── src/
└── frontend/               # @client-iptv/frontend — React app
    ├── DESIGN.md           # design system ("Cinematic Glassmorphism")
    ├── mockups/            # reference PNGs (Inicio / Explorar / Reproductor, desktop + mobile)
    └── src/
```

## Prerequisites

- **Node.js >= 22** (the ETL and `node:sqlite` fallback rely on Node 22).
- **npm >= 10** (the repo uses npm workspaces; `packageManager` is pinned in `package.json`).

> SQLite driver: the backend uses **`better-sqlite3`**. If its native build fails
> on Windows, the backend falls back to the built-in **`node:sqlite`** module that
> ships with Node 22. See the backend README for details.

## Installation

```bash
# from the repository root
cd client-iptv
npm install
```

`npm install` installs all three workspaces at once.

## Data (ETL → `iptv.db`)

The app reads from a local SQLite database, `iptv.db`, populated by an ETL that
reuses [`@iptv-org/sdk`](https://www.npmjs.com/package/@iptv-org/sdk) to fetch the
iptv-org API (channels, streams, feeds, logos, categories, countries, languages,
regions, subdivisions, cities, guides, blocklist).

```bash
# build the database (run from client-iptv/)
npm run etl
```

- The output database path is controlled by `DATABASE_PATH` (default: `backend/iptv.db`).
- `iptv.db` is **not** committed (it is gitignored) and is **not** required to
  build or lint the project — only to run the app with real data.
- For offline development and tests there are 13 real dataset snapshots under the
  repo's `temp/data/` (reachable from the backend as `../../temp/data/`) used for
  seeding/tests without network access.

## Development

```bash
# from client-iptv/
npm run dev
```

This starts both servers concurrently:

| Service  | URL                     | Port |
| -------- | ----------------------- | ---- |
| Frontend | http://localhost:5173   | 5173 |
| Backend  | http://localhost:3001   | 3001 |

Open http://localhost:5173 in your browser. Frontend requests to `/api/*` are
proxied to the backend, so `GET /api/health` returns `{ "status": "ok" }` with no
CORS configuration needed.

A failure in one process does not silently stop the other (the parallel runner
surfaces both).

## Environment variables

Copy `.env.example` to `.env` and adjust as needed. All configuration is read from
the environment — there are no hardcoded ports or paths scattered through the code.

| Variable               | Used by  | Default            | Description                                                  |
| ---------------------- | -------- | ------------------ | ------------------------------------------------------------ |
| `PORT`                 | backend  | `3001`             | Fastify listen port.                                         |
| `HOST`                 | backend  | `127.0.0.1`        | Fastify bind host.                                           |
| `DATABASE_PATH`        | backend  | `backend/iptv.db`  | Path to the SQLite database produced by the ETL.            |
| `STREAM_PROXY_ENABLED` | backend  | `false`            | Enable the optional stream proxy.                            |
| `VITE_API_BASE_URL`    | frontend | `/api`             | Single place to point the frontend at the API.              |

> The frontend proxy target (`http://localhost:3001`) is derived from the backend
> port; changing `PORT` and the Vite proxy target is enough to reconfigure.

## Available scripts

Run from `client-iptv/`:

| Script                 | Description                                                          |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run dev`          | Start backend (3001) + frontend (5173) concurrently.               |
| `npm run build`        | Build all three packages (shared → backend → frontend).            |
| `npm run typecheck`    | Run `tsc --noEmit` across every workspace.                         |
| `npm run lint`         | Lint the whole monorepo with ESLint.                               |
| `npm run lint:fix`     | Lint and auto-fix.                                                  |
| `npm run format`       | Apply Prettier across the repo.                                    |
| `npm run format:check` | Verify formatting without writing.                                 |
| `npm run etl`          | Build `iptv.db` from the iptv-org API (`@iptv-org/sdk`).           |
| `npm run seed`         | Seed the database from the local `temp/data/` snapshots (offline). |

Code style matches the parent `iptv` repo: single quotes, no semicolons,
`printWidth` 100, no trailing commas, arrow parens avoided. Prettier owns
formatting; ESLint owns correctness.

## Continuous integration

`.github/workflows/client-iptv-ci.yml` runs on pushes and pull requests **only**
when files under `client-iptv/**` change. It installs the workspace and runs
`lint`, `typecheck`, and `build`. The CI build does **not** download data or
require `iptv.db` to be present, and it does not interfere with the parent repo's
`check` / `format` / `update` workflows.

## Reference

- **API contract & shared types:** [`shared/README.md`](./shared/README.md)
- **Design system:** [`frontend/DESIGN.md`](./frontend/DESIGN.md)
