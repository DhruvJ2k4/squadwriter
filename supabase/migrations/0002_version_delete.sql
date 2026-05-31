-- ============================================================================
-- SquadWriter — CHANGESET_01 §1.6: allow deleting prompt_versions rows
-- ----------------------------------------------------------------------------
-- Stage 2 deliberately made prompt_versions immutable (it had no update/delete
-- policy or grant). §1.6 requires a per-version delete action, so this migration
-- adds an OWNER-ONLY delete path. It does NOT add, rename, or drop any column or
-- table — the frozen schema is untouched. It only adds one grant + one policy,
-- scoped to the prompt owner (consistent with every other prompt_* write rule,
-- so it does not weaken security).
--
-- ⚠ SIDE EFFECT: comments.version_id references prompt_versions ON DELETE CASCADE,
-- so deleting a version also deletes any comments anchored to that version's
-- snapshot. The UI confirms this and refuses to delete the only remaining version.
--
-- Run once in the Supabase SQL editor (it is idempotent / re-runnable). Until it
-- is run, the delete button will surface a "permission denied" error.
-- ============================================================================

begin;

grant delete on public.prompt_versions to authenticated;

drop policy if exists prompt_versions_delete on public.prompt_versions;
create policy prompt_versions_delete on public.prompt_versions
  for delete to authenticated using (public.is_prompt_owner(prompt_id));

commit;
