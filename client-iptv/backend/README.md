# client-iptv backend

Backend API for the personal IPTV web client. Built with **Node.js 22 +
TypeScript + Fastify + SQLite**. Personal use, no authentication.

## Requirements

- Node.js **>= 22** (the `node:sqlite` fallback requires Node 22)
- npm

`better-sqlite3` is the default SQLite driver. If its native binding fails to
build on your platform (common on Windows without build tools), the backend
automatically falls back to Node 22's built-in `node:sqlite`.

## Environment variables

Copy `.env.example` to `.env` and adjust. All have sensible defaults.

| Variable            | Default                          | Description                                  |
| ------------------- | -------------------------------- | -------------------------------------------- |
| `NODE_ENV`          | `development`                    | `development` \| `test` \| `production`      |
| `HOST`              | `0.0.0.0`                        | Bind address                                 |
| `PORT`              | `3001`                           | HTTP port                                    |
| `CORS_ORIGIN`       | `http://localhost:5173`          | Allowed origin (Vite frontend)               |
| `DATABASE_PATH`     | `./data/iptv.db`                 | SQLite file path (`DB_PATH` is an alias)     |
| `DATA_DIR`          | `./data/raw`                     | Raw iptv-org JSON snapshots for the ETL      |
| `IPTV_API_BASE_URL` | `https://iptv-org.github.io/api` | iptv-org API base used by the ETL            |
| `LOG_LEVEL`         | `info`                           | `fatal`\|`error`\|`warn`\|`info`\|`debug`\|`trace`\|`silent` |

Invalid configuration aborts startup with a readable message naming the bad
variable.

## Getting started

```bash
npm install        # install dependencies
npm run setup      # migrate the db + run the ETL (loads data)
npm run dev        # start Fastify with hot reload (tsx watch)
```

Starting without a populated database does **not** crash: the server logs a
warning telling you to run `npm run setup`, and `GET /api/health/db` returns
`503` until the data is loaded.

`npm run setup` uses the **offline seed** (the repo's `temp/data` JSON
snapshots) so it never touches the network. To pull fresh data from iptv-org
instead, run `npm run etl` (download + load via `@iptv-org/sdk`).

## Scripts

| Script               | Description                                                          |
| -------------------- | ------------------------------------------------------------------- |
| `npm run dev`        | Start with hot reload (`tsx watch src/server.ts`)                   |
| `npm run build`      | Compile TypeScript to `dist/` + copy `schema.sql` into `dist/`      |
| `npm start`          | Run the compiled server (`node dist/server.js`)                     |
| `npm run db:migrate` | Apply the schema idempotently (`_meta.schema_version` guard)        |
| `npm run etl`        | Full ETL: download via SDK -> migrate -> load -> rebuild FTS        |
| `npm run etl:download` | Download the 13 datasets to `DATA_DIR` (network)                  |
| `npm run etl:load`   | Load datasets into SQLite (`-- --skip-download` to reuse files)     |
| `npm run seed`       | Offline load from `temp/data` (no network) — used by `setup`        |
| `npm run setup`      | `db:migrate` + `seed` in one command                               |
| `npm test`           | Run the test suite (Vitest)                                         |
| `npm run typecheck`  | Type-check without emitting                                         |
| `npm run lint`       | Lint `src/**/*.ts`                                                  |

## Endpoints

| Method | Path              | Description                                                              |
| ------ | ----------------- | ----------------------------------------------------------------------- |
| `GET`  | `/api/health`     | Liveness. `200` always. `{ status, uptime, version, timestamp }`        |
| `GET`  | `/api/health/db`  | Readiness. `SELECT 1` + channel count. `503` (not a crash) if no db.    |

Domain routes (channels, the 8 navigation dimensions, streams, search) are added
by their respective tasks via `src/routes/index.ts`.

## Architecture

```
src/
  server.ts        # entrypoint: builds app, warns if db not set up, listens
  app.ts           # buildApp() factory (CORS, sensible, request-id, errors, routes)
  config/env.ts    # Zod-validated, immutable config
  db/
    client.ts        # async SQLite handle used by the health route
    connection.ts    # sync connection singleton (PRAGMAs: WAL, FK on, sync NORMAL)
    schema.sql       # relational schema (11 tables + 3 bridges + favorites)
    migrate.ts       # idempotent migration runner (_meta.schema_version)
    fts.ts           # FTS5 channels_fts (rebuild + bm25 search helper)
    mappers.ts       # row -> DTO mappers (parse JSON columns)
    repositories/    # channels / dimensions / search / favorites repos
  etl/
    download.ts      # SDK DataManager download (per-file error handling)
    load.ts          # SDK load+process -> SQL rows -> FTS rebuild (1 txn)
    run.ts           # orchestrator: download -> migrate -> load -> counts
  lib/
    errors.ts      # AppError + global error/404 handlers (ApiError envelope)
    logger.ts      # pino config (pino-pretty in dev)
    version.ts     # package version for the healthcheck
  routes/
    index.ts       # central route registration
    health.ts      # /api/health, /api/health/db
  types/
    contract.ts    # ApiError / health types (mirror @client-iptv/shared)
```

`buildApp()` does not call `listen`, so it is reused directly by the tests via
`app.inject()`.

## Docker (optional)

```bash
docker build -t client-iptv-backend .
docker run -p 3001:3001 -v iptv-data:/app/data client-iptv-backend
# or:
docker compose up --build
```

The SQLite database is persisted in the `iptv-data` volume mounted at
`/app/data`.

## Notes

- `src/types/contract.ts` mirrors the canonical contract from the foundation
  task (`@client-iptv/shared`). Once that workspace package exists, re-export
  from it and drop the local copy.
- `db/migrate.ts` and `etl/run.ts` are runnable placeholders owned by the
  database and ETL tasks respectively.
