-- ============================================================================
-- SquadWriter — CHANGESET_01 §2.4: live-updating comments & suggestions
-- ----------------------------------------------------------------------------
-- Adds comments + comment_replies to the `supabase_realtime` publication so the
-- prompt page can subscribe to inserts/updates/deletes and reflect other users'
-- comments in real time without a reload. This is realtime-subscription CONFIG
-- only — no table or column changes. RLS still gates which change events each
-- user is allowed to receive.
--
-- Run once in the Supabase SQL editor. The guards make it re-runnable.
-- ============================================================================

begin;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comment_replies'
  ) then
    alter publication supabase_realtime add table public.comment_replies;
  end if;
end $$;

commit;
