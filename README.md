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

## Deploy (Vercel)

1. Push to GitHub — a **private** repo is recommended (internal tool).
2. On Vercel: **Add New → Project**, import the repo. The **Vite** preset is auto-detected
   (build `npm run build`, output `dist`).
3. Add **Environment Variables** (Production + Preview):
   - `VITE_SUPABASE_URL` — `https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon/public key
4. Deploy. `vercel.json` rewrites all routes to `index.html`, so client-side routes
   (e.g. `/projects/:id`) work on refresh and deep links.
5. In **Supabase → Authentication → URL Configuration**, set **Site URL** to your Vercel
   URL (and add it under Redirect URLs) so email-confirmation links resolve in production.

## Build status

Stages 1–8 complete: scaffold · database + RLS · auth + domain lock · projects + membership ·
prompts (four types) · the editor · versions + diff · deploy config.
