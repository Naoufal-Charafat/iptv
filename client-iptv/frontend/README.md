# client-iptv · frontend

Personal IPTV web client. React + Vite + TypeScript + Tailwind (Cinematic
Glassmorphism design system) + shadcn/ui + TanStack Query + hls.js + React
Router, with MSW mocks for backend-less development.

## Requirements

- Node.js 22+
- npm 10+

## Getting started

```bash
npm install
cp .env.example .env   # then edit if needed
npm run dev            # http://localhost:5173
```

By default `.env.example` sets `VITE_USE_MOCKS=true`, so the app runs
end-to-end against in-memory MSW fixtures with **no backend required**.

## Scripts

| Script              | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the Vite dev server                    |
| `npm run build`     | Type-check (`tsc -b`) and build for prod     |
| `npm run preview`   | Preview the production build                 |
| `npm run typecheck` | Type-check without emitting                  |
| `npm run lint`      | Run ESLint                                   |
| `npm run format`    | Format with Prettier                         |

## Environment

| Variable             | Description                                              |
| -------------------- | ------------------------------------------------------- |
| `VITE_API_BASE_URL`  | Base URL of the backend API (mocks intercept this too)  |
| `VITE_USE_MOCKS`     | `"true"` starts MSW before render (develop offline)     |

Switching `VITE_API_BASE_URL` repoints all requests without code changes.
Set `VITE_USE_MOCKS=false` to talk to a real backend.

## Mock scenarios (MSW)

Any endpoint accepts query params to simulate conditions:

- `?delay=2000` — add latency (ms)
- `?error=500` — simulated server error
- `?error=404` — simulated not found

The first mock channel serves a real, playable HLS test stream so the player
route works out of the box.

## Project structure

```
src/
  app/          Router + providers (TanStack Query, tooltips)
  components/    Shared components
    layout/     App shell (sidebar, bottom tabs, layouts)
    ui/         shadcn/ui primitives (themed to the design system)
  features/     Data layer per resource (api.ts + hooks.ts)
  hooks/        Reusable hooks (useHls)
  lib/          apiClient, queryClient, queryKeys, utils
  mocks/        MSW worker, handlers, fixtures
  pages/        Route pages
  styles/       globals.css (Tailwind + glass utilities)
  types/        contract.ts (shared API types — stands in for @client-iptv/shared)
```

## Design system

Tokens (colors, Inter typography scales, radii, 8px spacing) are ported from
`DESIGN.md` into `tailwind.config.ts`, with glass utilities and the ambient
light-leak background in `globals.css`. Dark mode is always on (`class`).
