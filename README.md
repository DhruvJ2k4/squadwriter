# SquadWriter

Internal prompt-editor and store for SquadStack. PMs write, store, version, review, and co-edit LLM prompts inside client projects.

See [`BUILD_SPEC.md`](./BUILD_SPEC.md) for the full specification and [`CLAUDE.md`](./CLAUDE.md) for build rules. Built in numbered stages (1–13).

## Stack

React + Vite + TypeScript · Tailwind v4 + shadcn/ui · Framer Motion · CodeMirror 6 · Supabase (Postgres + Auth + RLS + Realtime) · jsdiff · emoji-mart · Vercel.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
npm run dev
```

Open the printed URL (default http://localhost:5173).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Type-check only, no emit |

## Environment

Frontend reads Supabase config from `.env.local` (gitignored). Vite only exposes
variables prefixed with `VITE_`:

- `VITE_SUPABASE_URL` — `https://<project-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY` — anon/public key (data is protected by Row-Level Security)

## Build status

- **Stage 1 — Scaffold** ✅ project scaffolded; folder tree, theme shell, Supabase client, config.
