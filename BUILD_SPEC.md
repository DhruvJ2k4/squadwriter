# BUILD_SPEC.md — SquadWriter

This is the authoritative specification. Build it in numbered stages (1–13). Read `CLAUDE.md` for operating rules. Build one stage, stop, let me verify, then I will tell you to proceed.

---

## 0. Product summary

SquadWriter is an internal-only web app where SquadStack PMs write, store, version, review, and co-edit LLM prompts. Prompts live inside client projects. Editing is **owner-only** in normal use; everyone else contributes via **Maker-Checker** (async comments/suggestions) or **Live Sessions** (separate working copies merged line-by-line at the end).

## 1. Architecture & stack (fixed)

- Frontend: React + Vite + TypeScript
- UI: Tailwind + shadcn/ui; animation: Framer Motion (transform/opacity only)
- Editor: CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`, `@codemirror/lang-json`, theme packages)
- Backend/DB/Auth/Realtime: Supabase (`@supabase/supabase-js`)
- Diff/merge: `diff` (jsdiff)
- Emoji: `emoji-mart`; stickers: small hosted image set
- Hosting: Vercel (frontend) + Supabase (backend)
- Env: Supabase URL + anon key from `.env.local` (gitignored)

## 2. Folder structure (create exactly this)

```
src/
  lib/        supabase.ts, types.ts, diff.ts, config.ts
  components/
    editor/   PromptEditor, ThemeSelector, MarkdownPreview, TabView, ScrollView,
              StageDropdown, JsonTab, VariableHighlighter, SlashCommands, TokenCounter
    comments/ CommentLayer, CommentSidebar, SuggestionCard
    session/  SessionRoom, PresenceBar, ChatPanel, SessionTimer, MergeView
    projects/ ProjectList, ProjectCard, NewProjectModal, MembersModal
    prompts/  PromptList, NewPromptModal, VersionHistory, VersionDiff, ForkModal
    admin/    AdminConsole
    ui/       shadcn + animated wrappers
  hooks/      usePrompt, useVersions, useComments, useSession, usePresence, useActivity
  pages/      Login, Dashboard, ProjectPage, PromptPage, SessionPage
  App.tsx
supabase/migrations/
.env.local
```

## 3. Data model (FROZEN after Stage 2)

`profiles`: id(=auth uid), username(unique), email, is_admin(bool), created_at
`projects`: id, name, client_name, use_case, owner_id→profiles, archived, created_at
`project_members`: id, project_id→projects, user_id→profiles, role(`owner|editor|checker|viewer`); unique(project_id,user_id) — **written only by project owner**
`prompts`: id, project_id, owner_id→profiles, title, prompt_kind(`conversation|entity`), prompt_type(`monolithic|prompt_chaining|rag_enabled|entity`), has_json_tab(bool; false when entity), archived, version_counter(int), created_at, updated_at
`prompt_sections`: id, prompt_id, section_type(`main|stage|rag_json`), title, content(text; JSON string for rag_json), position(int), archived — **ONE table for all four types**; direct writes **owner-only**
  - Monolithic=1 main · RAG=main+rag_json · Chaining=main+N stage · Entity=1 main
`prompt_versions`: id, prompt_id, snapshot(jsonb of all sections), saved_by→profiles, label(text?), created_at
`comments`: id, prompt_id, version_id→prompt_versions, section_id→prompt_sections, author_id, comment_type(`note|suggestion`), anchor_start(int), anchor_end(int), anchored_text(text), body(text), status(`open|resolved|ignored|applied|text_changed`), created_at
`comment_replies`: id, comment_id→comments, author_id, body, created_at
`sessions`: id, prompt_id, host_id, duration_minutes, started_at, ends_at, status(`active|ended`), before_snapshot(jsonb), after_snapshot(jsonb)
`session_participants`: id, session_id, user_id, working_copy(jsonb), joined_at — **ephemeral, deleted on session end**
`session_invites`: id, session_id, invitee_id, status(`pending|accepted|declined`), created_at
`activity`: id, project_id, actor_id, verb(text), target(text), created_at

**RLS:** read gated by project_members; direct prompt_sections writes owner-only; project_members writes project-owner-only; checker/editor may insert comments; owner resolves/applies; admins(is_admin) read all.

---

# STAGES

### Stage 1 — Scaffold
Init React+Vite+TS. Add Tailwind, shadcn/ui, Framer Motion, supabase-js, CodeMirror 6 packages, diff, emoji-mart. Create the folder tree in §2. Build `lib/supabase.ts` (env vars), `lib/config.ts` (allowed domains: `@squadstack.ai`, `@squadstack.com`). Add `.gitignore` covering `.env.local` and `node_modules`.
**Accept:** `npm run dev` serves a blank themed shell; folders exist; no type errors.

### Stage 2 — Database (FREEZE POINT)
Generate the full Supabase SQL migration for every table/enum/FK in §3, plus all RLS policies. Generate `lib/types.ts` matching the schema. Provide the SQL so I can run it in the Supabase SQL editor.
**Accept:** migration runs clean in Supabase; types compile. **I will test this thoroughly before you proceed.**

### Stage 3 — Auth + domain lock
Login/Signup via Supabase Auth (email+password). Reject emails not in `config.ts` domains. Force unique username post-signup; create `profiles` row. Animated login screen (Framer Motion).
**Accept:** only allowed-domain emails register; username enforced; profile row created; logged-in users reach Dashboard.

### Stage 4 — Projects + membership
Dashboard + ProjectPage. Owner creates projects (name, client_name, use_case) → auto owner in project_members. **Only project owner** opens MembersModal to search users and assign editor/checker/viewer. Archive support. List only the user's projects. Add "Recently edited by me" and a per-project activity feed.
**Accept:** non-owners cannot open MembersModal; activity logs on create/edit.

### Stage 5 — Prompts + four types
Create prompts (pick kind; conversation picks type). Create matching prompt_sections per §3 mapping. Add/remove/archive/duplicate + fork-from-template (clone across projects). Entity = single plain markdown section, no JSON/stage options. Only the prompt owner sees edit controls.
**Accept:** each type creates correct sections; entity stays plain; non-owners are read-only.

### Stage 6 — The Editor (CHECKPOINT)
CodeMirror 6 PromptEditor: (1) multiple decorative themes on editor text; (2) side-by-side live markdown preview toggle, themed; (3) `{{variable}}` highlighting that does NOT affect copy-paste; (4) live token/char counter; (5) slash commands (`/section`, `/stage`); (6) chaining: dropdown to add/remove/archive stage sections, each as a tab; (7) `has_json_tab`: pretty-printed JSON tab; (8) two view modes — tab-wise and scrollable with left jump-links. Subtle transitions on switches only.
**Accept:** all 8 behaviors work; copy-paste clean; no per-character animation. **I will test this thoroughly.**

### Stage 7 — Versions + diff
Save snapshots all sections to prompt_versions (explicit Save only) and bumps version_counter. VersionHistory (time, author, label) with restore + duplicate-as-new-prompt. VersionDiff: pick any two versions, line-level diff. Optimistic-lock: warn on Save if version_counter changed since open.
**Accept:** one row per Save; restore/duplicate/diff work; stale-save warns.

### Stage 8 — Deploy core
Push to GitHub; walk me through Vercel connection and env vars.
**Accept:** app live on Vercel URL; auth + CRUD work in production.

### Stage 9 — Maker-Checker: comments (CHECKPOINT)
Checker/editor highlights a selection → `note` anchored to current version_id with char offsets + copy of anchored_text. Render CommentLayer over text + scroll-synced CommentSidebar. Lifecycle: comment removed only on resolve/ignore OR when the entire anchored span is deleted; if span partially edited, set status `text_changed` and flag visually. Highlights never affect copy-paste.
**Accept:** anchoring survives unrelated edits; full-span delete removes comment; partial edit flags `text_changed`. **I will test edge cases.**

### Stage 10 — Maker-Checker: suggestions + log
Add `suggestion` type (proposed replacement text). Prompt owner can Apply (replace span) or Ignore. Maker replies to any note/suggestion → comment_replies thread = Maker-Checker log per prompt. Animate apply/resolve.
**Accept:** apply replaces correct span; ignore closes; reply thread persists.

### Stage 11 — Live Session: room, presence, chat
Host invites a project member (search → session_invites) with duration (40m/1h/custom). On accept, create session_participants with per-person working_copy from current prompt state. Two-pane SessionRoom: each edits own working copy (full editor). Supabase Realtime presence (PresenceBar) + ChatPanel (realtime messages + emoji-mart picker + small sticker set). SessionTimer with ending-soon warning + extend/end buttons.
**Accept:** invite/accept works; two independent copies; chat + emoji live; timer warns/extends.

### Stage 12 — Live Session: merge + finalize (CHECKPOINT)
MergeView via jsdiff at line level: compare the two working copies, host picks per-line which side wins or drop. On session end (timer or manual): save merged result as a new prompt_version, store before/after snapshots on sessions, set status ended, DELETE all working copies + ephemeral history. Decline-merge still saves host's own copy.
**Accept:** merge produces correct final; only before/after kept; working copies gone. **I will test the merge logic.**

### Stage 13 — Admin console + polish
Hidden `/admin` route for is_admin only (not linked in normal UI). Dense read-only: all users/projects/prompts + view any prompt content/versions. Polish pass: theme tokens, Framer Motion page transitions, loading skeletons, empty states, user-settings theme picker. Keep animations GPU-friendly.
**Accept:** admin sees all, invisible to others; UI polished; latency smooth.

---

## Final acceptance
All stage accept-lines true; schema never diverged from §3; security rules intact; deployed and usable.
