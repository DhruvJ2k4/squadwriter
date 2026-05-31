# CHANGESET_01.md — SquadWriter Fixes & Features

This is the authoritative spec for the next change cycle. Same rules as `CLAUDE.md`: build **one phase at a time**, commit after each, **never alter the frozen schema in §3 of `BUILD_SPEC.md` without asking** (this changeset adds new tables/columns — those additions are listed explicitly below and are the ONLY schema changes permitted). Stop after each phase for verification.

---

## Pre-flight (do before Phase 1 — investigate, don't assume)

**Admin access issue.** The `/admin` route at squadwriter-eight.vercel.app/admin appears read-only/blocked for the project author. First determine the cause:
1. Check whether the logged-in user's `profiles.is_admin` is actually `true`. If NOT, the fix is data, not code — tell me to set it in Supabase, do not change code.
2. If `is_admin` IS true but the page still blocks edit/visibility, then it's a code bug in the admin route guard or RLS — report exactly which, then fix.
Report findings before proceeding.

---

## PHASE 1 — Bug fixes & quick wins (low risk)

**1.1 Three-dots menu broken (projects & prompts).** The options button (⋯) on project and prompt cards does nothing. Diagnose (likely an unbound handler, event propagation, or a missing menu component) and fix so the menu opens with its actions (rename/archive/duplicate/delete as applicable).

**1.2 Prompt Chaining — add/rename stages.** There is currently no way to add or rename stages on a PC prompt. Add: an "Add Stage" action and inline rename for each stage, wired to `prompt_sections` (section_type `stage`, with `title` and `position`). Keep existing remove/archive.

**1.3 Recently-viewed & Activity feed — limit to 5.** Cap both the "Recently edited/viewed by you" list and the per-project activity feed to the 5 most recent entries.

**1.4 GPT-4 token counter.** The current counter is inaccurate. Replace the counting logic with a proper GPT-4 tokenizer (`js-tiktoken` with the `cl100k_base` encoding). Count tokens for the visible prompt content. Keep it debounced so it never runs per-keystroke synchronously (latency rule).

**1.5 Button hover animation.** All clickable buttons get a subtle hover animation (scale/opacity via transform only — no layout shift). Apply consistently through the shared button component so it's one change, not many.

**1.6 Version history — delete versions.** Add a delete action per version in VersionHistory (with a confirm). Deleting a version removes that `prompt_versions` row. Never allow deleting the only remaining version.

**Phase 1 accept:** ⋯ menus work; PC stages can be added/renamed; both feeds show max 5; token count matches GPT-4 tokenization; buttons animate on hover; versions can be deleted (except the last).

---

## PHASE 2 — Editor & collaboration upgrades (medium risk)

**Schema additions permitted in this phase:** none required (reuses existing tables) EXCEPT realtime subscriptions config. If a `comments` change-feed needs a column, ask first.

**2.1 Width-resizable editor panes.** Make the prompt text box width-resizable (drag handle) for ALL prompt types (entity included), and likewise for the Markdown Preview pane. Works in both tab view and scroll view. Persist the chosen width in component state for the session.

**2.2 Theme applies to Markdown Preview.** The selected editor theme must also style the Markdown Preview pane (background, text, code blocks) so both panes match. Currently the theme only hits the editor.

**2.3 RAG simplification — remove RAG-enabled type; add JSON box to Monolithic & PC.** Remove `rag_enabled` as a selectable prompt_type. Instead, Monolithic and Prompt Chaining prompts get an optional "Add RAG JSON" toggle (`prompts.has_json_tab`) that adds ONE `rag_json` section with the existing pretty-format option. Entity prompts still get nothing.
- **Migration note:** existing `rag_enabled` prompts must be converted to `monolithic` with `has_json_tab=true`, preserving their `rag_json` section. Write a one-time data migration for this and show it to me before running. Do NOT drop the enum value until existing rows are migrated.

**2.4 Live-updating comments/suggestions.** Comments and suggestions made by one user must appear on every other user's open prompt page in real time (Supabase Realtime subscription on `comments`/`comment_replies` for that prompt), no reload. Respect the existing comment lifecycle rules.

**2.5 Inline comment composer.** The add-comment/suggestion box must appear beside the selected text (anchored near the selection), not force the user to scroll to a panel at the top. Keep the side list as the persistent log; the composer is the inline quick-entry.

**2.6 Version diff — side-by-side colored.** Upgrade VersionDiff: two selected versions shown side by side, with green highlighting for additions and red for removals on each side (line/word level via jsdiff). Replace any single-column diff.

**2.7 Live Session real-time highlighting + chat-comment.**
- In a Live Session, show green/red highlighting for additions/removals as they happen in real time across the two working copies.
- Add the ability to select text in the prompt and post that selection as a comment into the chat panel alongside (a "comment on this selection" → drops a quoted reference into chat).

**2.8 Stickers — admin-managed.** If not too complex: let an admin add stickers (upload a small image to a hosted set) that then appear in the session chat sticker picker. If it adds meaningful complexity, implement a fixed built-in sticker set instead and tell me.

**Phase 2 accept:** panes resize; preview matches theme; RAG type gone and old rows migrated cleanly; comments live-update without reload; composer appears inline by selection; version diff is side-by-side red/green; live session shows real-time add/remove colors + select-to-chat works; stickers usable.

---

## PHASE 3 — Client HTML Reports (highest risk — isolated)

**Goal:** Each project can hold ONE HTML report that renders as a public, shareable web page for clients.

**Schema additions (NEW — these are approved):**
`reports`: id, project_id→projects, author_id→profiles, title, html_source(text, the editable source), html_published(text, sanitized published copy), public_token(text, unique, unguessable), status(`draft|published`), created_at, updated_at, published_at
- Constraint/logic: **one report per project**; an admin-only flag allows more (e.g. `projects.report_limit` int default 1, only project... no — keep it simple: a separate admin override, e.g. `projects.max_reports` default 1, editable only by admins).

**3.1 Report editor.** In a project, the project owner/editor can create/edit ONE report: a title + an HTML source text box (reuse the resizable editor + format option). Live preview of the rendered HTML inside a **sandboxed iframe** while editing.

**3.2 Security — sanitize AND sandbox (mandatory).**
- On save/publish, sanitize `html_source` (strip `<script>`, inline event handlers like `onclick`, `javascript:` URIs) into `html_published` using DOMPurify.
- Render BOTH the edit-preview and the public page inside an iframe with `sandbox` (no allow-scripts). The client sees only the final rendered page.

**3.3 Draft vs published.** Editing changes `html_source` only. A "Publish" action sanitizes into `html_published`, sets status `published`, sets `published_at`, and generates `public_token` if absent. Clients always see the published copy, never live drafts.

**3.4 Public shareable link.** Public route `/r/{public_token}` renders `html_published` in the sandboxed iframe. This route is OUTSIDE the auth wall. Add an RLS policy allowing anonymous SELECT of a `reports` row ONLY by matching `public_token` AND status=`published`. No other report data is exposed publicly. Provide a copy-link button in the editor.

**3.5 One-per-project limit + admin extend.** Enforce one report per project unless `projects.max_reports` (admin-only editable) is higher. Show a clear message when the limit is hit.

**Phase 3 accept:** owner can author one report; preview + public page both sandboxed; published link works for a logged-out user; drafts never public; `<script>` in source never executes on the public page; one-per-project enforced; admin can raise the limit.

---

## Notes on holes I flagged (for your awareness)
- Reports are public-by-link with no expiry/password (your choice). Anyone with the link sees it; treat links as semi-private. Expiry/password can be added later without schema pain.
- Sanitization can occasionally strip legitimate interactive HTML (e.g. embedded forms/scripts). For static visual reports this is fine; if clients ever need interactive reports, that's a separate, larger discussion.
