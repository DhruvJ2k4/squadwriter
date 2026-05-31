-- ============================================================================
-- SquadWriter — CHANGESET_01 §3: Client HTML Reports (APPROVED schema additions)
-- ----------------------------------------------------------------------------
-- Adds projects.max_reports (admin-only), the reports table, RLS, the
-- one-per-project limit, and a token-gated public read path.
-- Run once in the Supabase SQL editor (idempotent / re-runnable).
--
-- SECURITY MODEL
--   * Authenticated: project members read their project's reports; owner/editor
--     create / edit / delete. (anon gets NO table access whatsoever.)
--   * Public (logged-out): reads ONE published report ONLY through the
--     get_published_report(token) SECURITY DEFINER RPC. There is deliberately NO
--     anon SELECT policy on the table — a plain `using (status='published')`
--     policy would let anyone enumerate every published report (tokens + html).
--     The RPC requires the exact unguessable token and returns only
--     title / html_published / published_at, so nothing else is ever exposed and
--     reports can't be enumerated.
-- ============================================================================

begin;

do $$ begin
  create type public.report_status as enum ('draft','published');
exception when duplicate_object then null; end $$;

-- §3.5 — admin-only per-project report limit
alter table public.projects add column if not exists max_reports integer not null default 1;

create table if not exists public.reports (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  author_id      uuid not null references public.profiles (id) on delete cascade,
  title          text not null default 'Untitled report',
  html_source    text not null default '',
  html_published text not null default '',
  public_token   text unique,                       -- multiple NULL drafts allowed
  status         public.report_status not null default 'draft',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  published_at   timestamptz
);

create index if not exists idx_reports_project on public.reports (project_id);

-- keep reports.updated_at fresh (reuses the Stage-2 helper)
drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- One report per project unless an admin raised projects.max_reports (§3.5)
-- ----------------------------------------------------------------------------
create or replace function public.enforce_report_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cnt integer; lim integer;
begin
  select count(*) into cnt from public.reports where project_id = new.project_id;
  select max_reports into lim from public.projects where id = new.project_id;
  if cnt >= coalesce(lim, 1) then
    raise exception 'Report limit reached for this project (max %).', coalesce(lim, 1);
  end if;
  return new;
end $$;

drop trigger if exists reports_enforce_limit on public.reports;
create trigger reports_enforce_limit before insert on public.reports
  for each row execute function public.enforce_report_limit();

-- max_reports is ADMIN-ONLY editable: silently revert any non-admin change.
create or replace function public.guard_max_reports()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.max_reports is distinct from old.max_reports and not public.is_admin() then
    new.max_reports := old.max_reports;
  end if;
  return new;
end $$;

drop trigger if exists projects_guard_max_reports on public.projects;
create trigger projects_guard_max_reports before update on public.projects
  for each row execute function public.guard_max_reports();

-- ----------------------------------------------------------------------------
-- RLS — authenticated only; anon has no policy and no grant.
-- ----------------------------------------------------------------------------
alter table public.reports enable row level security;

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
  for select to authenticated using (public.is_project_member(project_id) or public.is_admin());

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_author_in_project(project_id));

drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports
  for update to authenticated
  using (public.can_author_in_project(project_id)) with check (public.can_author_in_project(project_id));

drop policy if exists reports_delete on public.reports;
create policy reports_delete on public.reports
  for delete to authenticated using (public.can_author_in_project(project_id));

grant select, insert, update, delete on public.reports to authenticated;

-- ----------------------------------------------------------------------------
-- §3.4 — token-gated public read. SECURITY DEFINER bypasses RLS, but the WHERE
-- clause + limited return columns mean a caller must present the exact token and
-- can never enumerate or see drafts / source / ids.
-- ----------------------------------------------------------------------------
create or replace function public.get_published_report(p_token text)
returns table (title text, html_published text, published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.title, r.html_published, r.published_at
  from public.reports r
  where r.public_token = p_token and r.status = 'published'
  limit 1;
$$;
revoke all on function public.get_published_report(text) from public;
grant execute on function public.get_published_report(text) to anon, authenticated;

-- §3.5 — admin raises a project's report limit.
create or replace function public.admin_set_max_reports(p_project uuid, p_max integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_max < 1 then raise exception 'max_reports must be >= 1'; end if;
  update public.projects set max_reports = p_max where id = p_project;
end $$;
revoke all on function public.admin_set_max_reports(uuid, integer) from public;
grant execute on function public.admin_set_max_reports(uuid, integer) to authenticated;

commit;
