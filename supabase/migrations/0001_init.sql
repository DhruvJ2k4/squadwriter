-- ============================================================================
-- SquadWriter — initial schema  (BUILD_SPEC Stage 2 · FREEZE POINT)
-- ----------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor on a fresh project.
-- It is re-runnable: enums are guarded, tables use IF NOT EXISTS, policies are
-- dropped-then-created, grants/indexes are idempotent.
--
-- Schema is FROZEN after this stage. `prompt_sections` is ONE table powering all
-- four prompt types. Do not split it or alter columns without sign-off.
--
-- RLS summary (from §3):
--   * read gated by project_members        * prompt_sections writes: prompt-owner only
--   * project_members writes: project-owner * checker/editor may insert comments
--   * owner resolves/applies comments       * admins (is_admin) read all
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Enum types
-- ----------------------------------------------------------------------------
do $$ begin create type public.member_role   as enum ('owner','editor','checker','viewer');                 exception when duplicate_object then null; end $$;
do $$ begin create type public.prompt_kind   as enum ('conversation','entity');                             exception when duplicate_object then null; end $$;
do $$ begin create type public.prompt_type   as enum ('monolithic','prompt_chaining','rag_enabled','entity'); exception when duplicate_object then null; end $$;
do $$ begin create type public.section_type  as enum ('main','stage','rag_json');                            exception when duplicate_object then null; end $$;
do $$ begin create type public.comment_type  as enum ('note','suggestion');                                  exception when duplicate_object then null; end $$;
do $$ begin create type public.comment_status as enum ('open','resolved','ignored','applied','text_changed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.session_status as enum ('active','ended');                                    exception when duplicate_object then null; end $$;
do $$ begin create type public.invite_status as enum ('pending','accepted','declined');                      exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. Tables (in FK-dependency order)
-- ----------------------------------------------------------------------------

-- profiles.id == auth.users.id
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique,
  email      text not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  client_name text,
  use_case    text,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.member_role not null,
  unique (project_id, user_id)
);

create table if not exists public.prompts (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  title           text not null,
  prompt_kind     public.prompt_kind not null,
  prompt_type     public.prompt_type not null,
  has_json_tab    boolean not null default false,
  archived        boolean not null default false,
  version_counter integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ONE table for all four prompt types (monolithic / rag / chaining / entity).
create table if not exists public.prompt_sections (
  id           uuid primary key default gen_random_uuid(),
  prompt_id    uuid not null references public.prompts (id) on delete cascade,
  section_type public.section_type not null,
  title        text,
  content      text not null default '',
  position     integer not null default 0,
  archived     boolean not null default false
);

create table if not exists public.prompt_versions (
  id         uuid primary key default gen_random_uuid(),
  prompt_id  uuid not null references public.prompts (id) on delete cascade,
  snapshot   jsonb not null,
  saved_by   uuid not null references public.profiles (id) on delete cascade,
  label      text,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id            uuid primary key default gen_random_uuid(),
  prompt_id     uuid not null references public.prompts (id) on delete cascade,
  version_id    uuid not null references public.prompt_versions (id) on delete cascade,
  section_id    uuid not null references public.prompt_sections (id) on delete cascade,
  author_id     uuid not null references public.profiles (id) on delete cascade,
  comment_type  public.comment_type not null,
  anchor_start  integer not null,
  anchor_end    integer not null,
  anchored_text text not null,
  body          text not null,
  status        public.comment_status not null default 'open',
  created_at    timestamptz not null default now()
);

create table if not exists public.comment_replies (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id               uuid primary key default gen_random_uuid(),
  prompt_id        uuid not null references public.prompts (id) on delete cascade,
  host_id          uuid not null references public.profiles (id) on delete cascade,
  duration_minutes integer not null,
  started_at       timestamptz not null default now(),
  ends_at          timestamptz not null,
  status           public.session_status not null default 'active',
  before_snapshot  jsonb,
  after_snapshot   jsonb
);

-- ephemeral: rows are deleted when the session ends (working copies discarded).
create table if not exists public.session_participants (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  working_copy jsonb,
  joined_at    timestamptz not null default now(),
  unique (session_id, user_id)
);

create table if not exists public.session_invites (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  status     public.invite_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.activity (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  verb       text not null,
  target     text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Indexes (FK lookups + common orderings)
-- ----------------------------------------------------------------------------
create index if not exists idx_projects_owner            on public.projects (owner_id);
create index if not exists idx_project_members_user      on public.project_members (user_id);
create index if not exists idx_prompts_project           on public.prompts (project_id);
create index if not exists idx_prompts_owner             on public.prompts (owner_id);
create index if not exists idx_prompt_sections_prompt    on public.prompt_sections (prompt_id, position);
create index if not exists idx_prompt_versions_prompt    on public.prompt_versions (prompt_id, created_at desc);
create index if not exists idx_comments_prompt           on public.comments (prompt_id);
create index if not exists idx_comments_section          on public.comments (section_id);
create index if not exists idx_comments_version          on public.comments (version_id);
create index if not exists idx_comment_replies_comment   on public.comment_replies (comment_id, created_at);
create index if not exists idx_sessions_prompt           on public.sessions (prompt_id);
create index if not exists idx_sessions_host             on public.sessions (host_id);
create index if not exists idx_session_invites_session   on public.session_invites (session_id);
create index if not exists idx_session_invites_invitee   on public.session_invites (invitee_id);
create index if not exists idx_activity_project          on public.activity (project_id, created_at desc);
create index if not exists idx_activity_actor            on public.activity (actor_id);

-- ----------------------------------------------------------------------------
-- 4. Helper functions (SECURITY DEFINER → bypass RLS to prevent recursion)
--    All set search_path='' and fully-qualify objects (Supabase-recommended).
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p_project and pr.owner_id = auth.uid()
  );
$$;

-- owner OR editor may author new prompts in a project
create or replace function public.can_author_in_project(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = auth.uid()
      and m.role in ('owner'::public.member_role, 'editor'::public.member_role)
  );
$$;

create or replace function public.is_prompt_owner(p_prompt uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.prompts pr
    where pr.id = p_prompt and pr.owner_id = auth.uid()
  );
$$;

-- current user is a member of the project that owns this prompt
create or replace function public.can_read_prompt(p_prompt uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.prompts pr
    join public.project_members m on m.project_id = pr.project_id
    where pr.id = p_prompt and m.user_id = auth.uid()
  );
$$;

-- owner / editor / checker on the prompt's project may comment
create or replace function public.can_comment_on_prompt(p_prompt uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.prompts pr
    join public.project_members m on m.project_id = pr.project_id
    where pr.id = p_prompt and m.user_id = auth.uid()
      and m.role in ('owner'::public.member_role,'editor'::public.member_role,'checker'::public.member_role)
  );
$$;

create or replace function public.can_read_comment(p_comment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.comments c
    join public.prompts pr on pr.id = c.prompt_id
    join public.project_members m on m.project_id = pr.project_id
    where c.id = p_comment and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_owner_of_comment_prompt(p_comment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.comments c
    join public.prompts pr on pr.id = c.prompt_id
    where c.id = p_comment and pr.owner_id = auth.uid()
  );
$$;

-- owner / editor / checker may reply in a comment thread
create or replace function public.can_reply_to_comment(p_comment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.comments c
    join public.prompts pr on pr.id = c.prompt_id
    join public.project_members m on m.project_id = pr.project_id
    where c.id = p_comment and m.user_id = auth.uid()
      and m.role in ('owner'::public.member_role,'editor'::public.member_role,'checker'::public.member_role)
  );
$$;

create or replace function public.can_read_session(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.sessions s
    join public.prompts pr on pr.id = s.prompt_id
    join public.project_members m on m.project_id = pr.project_id
    where s.id = p_session and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_session_host(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sessions s where s.id = p_session and s.host_id = auth.uid());
$$;

create or replace function public.is_session_invitee(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.session_invites i where i.session_id = p_session and i.invitee_id = auth.uid());
$$;

-- keep prompts.updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prompts_set_updated_at on public.prompts;
create trigger prompts_set_updated_at
  before update on public.prompts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Enable Row-Level Security on every table
-- ----------------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.projects             enable row level security;
alter table public.project_members      enable row level security;
alter table public.prompts              enable row level security;
alter table public.prompt_sections      enable row level security;
alter table public.prompt_versions      enable row level security;
alter table public.comments             enable row level security;
alter table public.comment_replies      enable row level security;
alter table public.sessions             enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_invites      enable row level security;
alter table public.activity             enable row level security;

-- ----------------------------------------------------------------------------
-- 6. Policies
-- ----------------------------------------------------------------------------

-- profiles: everyone authenticated can read (user search + display); self-write only.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- projects: members read; owner writes.
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated using (public.is_project_member(id) or public.is_admin());

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated using (owner_id = (select auth.uid()));

-- project_members: members read; PROJECT OWNER writes only.
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select to authenticated using (public.is_project_member(project_id) or public.is_admin());

drop policy if exists project_members_insert on public.project_members;
create policy project_members_insert on public.project_members
  for insert to authenticated with check (public.is_project_owner(project_id));

drop policy if exists project_members_update on public.project_members;
create policy project_members_update on public.project_members
  for update to authenticated using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

drop policy if exists project_members_delete on public.project_members;
create policy project_members_delete on public.project_members
  for delete to authenticated using (public.is_project_owner(project_id));

-- prompts: project members read; owner/editor create (owning it); prompt owner edits.
drop policy if exists prompts_select on public.prompts;
create policy prompts_select on public.prompts
  for select to authenticated using (public.is_project_member(project_id) or public.is_admin());

drop policy if exists prompts_insert on public.prompts;
create policy prompts_insert on public.prompts
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.can_author_in_project(project_id));

drop policy if exists prompts_update on public.prompts;
create policy prompts_update on public.prompts
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists prompts_delete on public.prompts;
create policy prompts_delete on public.prompts
  for delete to authenticated using (owner_id = (select auth.uid()));

-- prompt_sections: project members read; DIRECT WRITES = prompt owner only.
drop policy if exists prompt_sections_select on public.prompt_sections;
create policy prompt_sections_select on public.prompt_sections
  for select to authenticated using (public.can_read_prompt(prompt_id) or public.is_admin());

drop policy if exists prompt_sections_insert on public.prompt_sections;
create policy prompt_sections_insert on public.prompt_sections
  for insert to authenticated with check (public.is_prompt_owner(prompt_id));

drop policy if exists prompt_sections_update on public.prompt_sections;
create policy prompt_sections_update on public.prompt_sections
  for update to authenticated using (public.is_prompt_owner(prompt_id)) with check (public.is_prompt_owner(prompt_id));

drop policy if exists prompt_sections_delete on public.prompt_sections;
create policy prompt_sections_delete on public.prompt_sections
  for delete to authenticated using (public.is_prompt_owner(prompt_id));

-- prompt_versions: project members read; prompt owner writes; immutable (no update/delete).
drop policy if exists prompt_versions_select on public.prompt_versions;
create policy prompt_versions_select on public.prompt_versions
  for select to authenticated using (public.can_read_prompt(prompt_id) or public.is_admin());

drop policy if exists prompt_versions_insert on public.prompt_versions;
create policy prompt_versions_insert on public.prompt_versions
  for insert to authenticated
  with check (public.is_prompt_owner(prompt_id) and saved_by = (select auth.uid()));

-- comments: project members read; owner/editor/checker insert; PROMPT OWNER resolves/applies.
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated using (public.can_read_prompt(prompt_id) or public.is_admin());

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_comment_on_prompt(prompt_id));

drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments
  for update to authenticated using (public.is_prompt_owner(prompt_id)) with check (public.is_prompt_owner(prompt_id));

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to authenticated using (public.is_prompt_owner(prompt_id) or author_id = (select auth.uid()));

-- comment_replies: readable with the comment; owner/editor/checker reply; author or owner delete.
drop policy if exists comment_replies_select on public.comment_replies;
create policy comment_replies_select on public.comment_replies
  for select to authenticated using (public.can_read_comment(comment_id) or public.is_admin());

drop policy if exists comment_replies_insert on public.comment_replies;
create policy comment_replies_insert on public.comment_replies
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_reply_to_comment(comment_id));

drop policy if exists comment_replies_update on public.comment_replies;
create policy comment_replies_update on public.comment_replies
  for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

drop policy if exists comment_replies_delete on public.comment_replies;
create policy comment_replies_delete on public.comment_replies
  for delete to authenticated using (author_id = (select auth.uid()) or public.is_owner_of_comment_prompt(comment_id));

-- sessions: project members read; host (= prompt owner) creates and manages.
drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions
  for select to authenticated using (public.can_read_prompt(prompt_id) or public.is_admin());

drop policy if exists sessions_insert on public.sessions;
create policy sessions_insert on public.sessions
  for insert to authenticated
  with check (host_id = (select auth.uid()) and public.is_prompt_owner(prompt_id));

drop policy if exists sessions_update on public.sessions;
create policy sessions_update on public.sessions
  for update to authenticated using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));

drop policy if exists sessions_delete on public.sessions;
create policy sessions_delete on public.sessions
  for delete to authenticated using (host_id = (select auth.uid()));

-- session_participants: readable by session members; you write your own working copy.
drop policy if exists session_participants_select on public.session_participants;
create policy session_participants_select on public.session_participants
  for select to authenticated using (public.can_read_session(session_id) or public.is_admin());

drop policy if exists session_participants_insert on public.session_participants;
create policy session_participants_insert on public.session_participants
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (public.is_session_host(session_id) or public.is_session_invitee(session_id)));

drop policy if exists session_participants_update on public.session_participants;
create policy session_participants_update on public.session_participants
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- host deletes all copies on session end; a participant may remove their own.
drop policy if exists session_participants_delete on public.session_participants;
create policy session_participants_delete on public.session_participants
  for delete to authenticated using (public.is_session_host(session_id) or user_id = (select auth.uid()));

-- session_invites: invitee & host read; host invites; invitee responds; host cancels.
drop policy if exists session_invites_select on public.session_invites;
create policy session_invites_select on public.session_invites
  for select to authenticated
  using (invitee_id = (select auth.uid()) or public.is_session_host(session_id) or public.is_admin());

drop policy if exists session_invites_insert on public.session_invites;
create policy session_invites_insert on public.session_invites
  for insert to authenticated with check (public.is_session_host(session_id));

drop policy if exists session_invites_update on public.session_invites;
create policy session_invites_update on public.session_invites
  for update to authenticated using (invitee_id = (select auth.uid())) with check (invitee_id = (select auth.uid()));

drop policy if exists session_invites_delete on public.session_invites;
create policy session_invites_delete on public.session_invites
  for delete to authenticated using (public.is_session_host(session_id));

-- activity: project members read; actor appends (append-only — no update/delete).
drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity
  for select to authenticated using (public.is_project_member(project_id) or public.is_admin());

drop policy if exists activity_insert on public.activity;
create policy activity_insert on public.activity
  for insert to authenticated
  with check (actor_id = (select auth.uid()) and public.is_project_member(project_id));

-- ----------------------------------------------------------------------------
-- 7. Grants (least-privilege for the `authenticated` role; RLS still gates rows).
--    `anon` gets nothing (no policies + no grants). is_admin is NOT grantable to
--    users, so it can only be set by service_role / SQL editor — no self-promotion.
-- ----------------------------------------------------------------------------
grant usage on schema public to authenticated;

revoke all on public.profiles from authenticated, anon;
grant select on public.profiles to authenticated;
grant insert (id, username, email) on public.profiles to authenticated;
grant update (username, email) on public.profiles to authenticated;

grant select, insert, update, delete on public.projects             to authenticated;
grant select, insert, update, delete on public.project_members      to authenticated;
grant select, insert, update, delete on public.prompts              to authenticated;
grant select, insert, update, delete on public.prompt_sections      to authenticated;
grant select, insert                 on public.prompt_versions      to authenticated;
grant select, insert, update, delete on public.comments             to authenticated;
grant select, insert, update, delete on public.comment_replies      to authenticated;
grant select, insert, update, delete on public.sessions             to authenticated;
grant select, insert, update, delete on public.session_participants to authenticated;
grant select, insert, update, delete on public.session_invites      to authenticated;
grant select, insert                 on public.activity             to authenticated;

commit;
