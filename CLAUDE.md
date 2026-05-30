# CLAUDE.md — Operating Rules for This Repository

You are building **SquadWriter**, an internal prompt-editor and store for SquadStack. The full specification is in `BUILD_SPEC.md`. Read it before acting.

## Non-negotiable rules

1. **Build ONE stage at a time.** Stages are numbered 1–13 in `BUILD_SPEC.md`. Never start the next stage until I explicitly say "proceed to stage N." After finishing a stage, STOP and report what you did and how I can verify it.

2. **The schema is frozen after Stage 2.** `prompt_sections` is a single table that powers all four prompt types. Do NOT split it into per-type tables. Do NOT add, rename, or drop columns after Stage 2 without asking me first and explaining why.

3. **Commit after every stage.** Use a clear message: `feat: stage N — <name>`. Never leave the tree dirty across stages.

4. **When ambiguous, STOP and ask.** If a file path, table, role, or behavior is unclear, do not guess or invent. Ask one concise question.

5. **Never weaken security.** Row-Level Security rules in the spec are mandatory. Direct writes to `prompt_sections` are owner-only. Membership writes are project-owner-only. Do not relax these for convenience.

6. **No secrets in code or git.** Supabase keys come from `.env.local` (gitignored). Never hardcode keys. Never commit `.env.local`.

7. **Latency discipline.** Animate only `transform` and `opacity`. Never animate layout, blur, or shadows on keystroke. The editor never animates per character.

8. **Verify before claiming done.** Ensure `npm run dev` compiles with no type errors at the end of each stage. Report any you cannot resolve instead of hiding them.

## Tech stack (do not substitute without asking)
React + Vite + TypeScript · Tailwind + shadcn/ui · Framer Motion · CodeMirror 6 · Supabase (Postgres + Auth + RLS + Realtime) · jsdiff · Vercel hosting.

## Definition of done for a stage
Code compiles, the stage's acceptance bullet in the spec is demonstrably true in the running app, and the work is committed to git.
