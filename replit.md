# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (workspace DB); Supabase (MochiMail app DB)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### MochiMail (`artifacts/mochi-mail`)
Digital stationery, drawing canvas, and mail app. Migrated from Next.js/Vercel to React+Vite.

- **Frontend**: React + Vite, Tailwind v4, wouter routing
- **Backend**: Express API server (`artifacts/api-server`)
- **Auth/DB**: Supabase (anon + named user sessions)
- **Port**: 23579 (set via `PORT` env var)

**Routes:**
- `/` — Studio with drawing canvas (main page)
- `/rooms` — Collaborative rooms list and join
- `/rooms/:inviteToken` — Room invite join
- `/space` — User profile/space page
- `/space/:username` — Redirects to `/space?u=:username`

**Environment variables required:**
- `VITE_SUPABASE_URL` — Supabase project URL (client-side)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key (client-side)
- `SUPABASE_URL` — Supabase project URL (server-side)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side, admin operations)

**API routes (served via Vite proxy → Express on port 8080):**
- `POST /api/auth/signup` — Create named user account
- `GET /api/gifs/search?q=...` — Search GIFs via Giphy or GifAPI

**Optional env vars for GIF search:**
- `GIF_PROVIDER` — `giphy` (default) or `gifapi`
- `GIPHY_API_KEY` — Giphy API key
- `GIFAPI_KEY` — GifAPI key
- `GIFAPI_BASE_URL` — GifAPI base URL

### API Server (`artifacts/api-server`)
Express 5 API server. Port 8080.
- MochiMail routes in `src/routes/mochimail.ts`
- Health check: `GET /api/healthz`

### Canvas (`artifacts/mockup-sandbox`)
Mockup/design sandbox for canvas exploration.
