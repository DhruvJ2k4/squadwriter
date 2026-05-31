-- ============================================================================
-- SquadWriter — CHANGESET_01 §2.3: retire the RAG-enabled prompt type
-- ----------------------------------------------------------------------------
-- The UI no longer offers `rag_enabled`. Existing rag_enabled prompts are
-- converted to `monolithic` with has_json_tab = true; their existing rag_json
-- section is left untouched (preserved). The enum VALUE is intentionally NOT
-- dropped — Postgres can't drop an enum value that columns may still reference,
-- and the spec says not to drop it until rows are migrated.
--
-- ⚠ Review BEFORE running. Run once in the Supabase SQL editor. Idempotent.
-- ============================================================================

begin;

update public.prompts
   set prompt_type  = 'monolithic',
       has_json_tab = true
 where prompt_type = 'rag_enabled';

commit;
