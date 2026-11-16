-- XPRTY Interview Platform: intentional destructive reset.
-- This migration drops every application table and all application data in the
-- public schema, then recreates the production relational model and RLS.
-- It does NOT delete Supabase Auth users; remove those separately in the
-- Supabase Auth dashboard if a completely blank tenant is required.

drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('super_admin', 'interviewer', 'candidate');
create type public.membership_role as enum ('org_admin', 'interviewer');
create type public.interviewer_verification as enum ('pending', 'verified', 'suspended');
create type public.interview_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
create type public.waiting_room_status as enum ('waiting', 'admitted', 'left');
create type public.proctoring_severity as enum ('low', 'medium', 'high', 'critical');
create type public.recommendation as enum ('strong_hire', 'hire', 'neutral', 'reject');

-- auth.users owns credentials. Profiles holds only application identity data.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null check (char_length(trim(full_name)) between 1 and 255),
  role public.app_role not null default 'candidate',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 255),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  logo_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.interviewer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  title text not null default 'Technical Interviewer',
  skills text[] not null default '{}',
  verification_status public.interviewer_verification not null default 'pending',
  total_interviews_conducted integer not null default 0 check (total_interviews_conducted >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone text,
  resume_url text,
  portfolio_url text,
  skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  session_code text not null unique check (session_code ~ '^[A-Z0-9-]{6,32}$'),
  title text not null check (char_length(trim(title)) between 1 and 255),
  description text not null default '',
  interviewer_id uuid not null references public.profiles(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  jitsi_room_name text unique,
  jitsi_room_url text,
  meeting_provider text not null default 'jitsi',
  status public.interview_status not null default 'scheduled',
  scheduled_start_time timestamptz not null,
  scheduled_end_time timestamptz not null,
  actual_start_time timestamptz,
  actual_end_time timestamptz,
  require_screen_share boolean not null default true,
  require_fullscreen boolean not null default true,
  require_webcam boolean not null default true,
  require_audio boolean not null default true,
  code_workspace_enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (candidate_id <> interviewer_id),
  check (scheduled_end_time > scheduled_start_time),
  check (actual_end_time is null or actual_start_time is null or actual_end_time >= actual_start_time)
);

-- Candidate readiness, presence, and explicit interviewer admission are durable.
create table public.interview_waiting_rooms (
  session_id uuid primary key references public.interview_sessions(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  status public.waiting_room_status not null default 'waiting',
  joined_at timestamptz,
  last_heartbeat_at timestamptz,
  admitted_at timestamptz,
  admitted_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.interview_resources (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  domain text not null check (domain ~ '^[A-Za-z0-9.-]+$'),
  title text not null,
  include_subdomains boolean not null default true,
  is_active boolean not null default true,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(session_id, domain)
);

create table public.proctoring_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (char_length(event_type) between 1 and 100),
  severity public.proctoring_severity not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now()
);

create table public.interview_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.interview_sessions(id) on delete cascade,
  interviewer_id uuid not null references public.profiles(id) on delete restrict,
  technical_score smallint not null check (technical_score between 1 and 5),
  problem_solving_score smallint not null check (problem_solving_score between 1 and 5),
  communication_score smallint not null check (communication_score between 1 and 5),
  overall_rating smallint not null check (overall_rating between 1 and 5),
  recommendation public.recommendation not null,
  summary_notes text not null default '',
  detailed_scores jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create table public.interview_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  id boolean primary key default true check (id),
  require_interviewer_verification boolean not null default true,
  max_concurrent_interviews_per_host smallint not null default 1 check (max_concurrent_interviews_per_host between 1 and 10),
  default_proctoring_strictness public.proctoring_severity not null default 'high',
  recording_retention_days integer not null default 30 check (recording_retention_days between 1 and 3650),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (true);

create index sessions_interviewer_schedule_idx on public.interview_sessions(interviewer_id, scheduled_start_time desc);
create index sessions_candidate_schedule_idx on public.interview_sessions(candidate_id, scheduled_start_time desc);
create index sessions_org_schedule_idx on public.interview_sessions(organization_id, scheduled_start_time desc);
create index proctoring_events_session_time_idx on public.proctoring_events(session_id, detected_at desc);
create index waiting_rooms_presence_idx on public.interview_waiting_rooms(last_heartbeat_at) where status = 'waiting';
create index audit_logs_org_time_idx on public.audit_logs(organization_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'super_admin' and is_active);
$$;

create or replace function public.is_org_admin(org_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists(
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid() and role = 'org_admin'
  );
$$;

create or replace function public.can_manage_session(target_session_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists(
    select 1 from public.interview_sessions s
    where s.id = target_session_id and (s.interviewer_id = auth.uid() or public.is_org_admin(s.organization_id))
  );
$$;

create or replace function public.can_access_session(target_session_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.can_manage_session(target_session_id) or exists(
    select 1 from public.interview_sessions where id = target_session_id and candidate_id = auth.uid()
  );
$$;

create or replace function public.validate_session_assignment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.interviewer_profiles ip
    join public.profiles p on p.id = ip.user_id
    where ip.user_id = new.interviewer_id and ip.organization_id = new.organization_id
      and p.role = 'interviewer' and p.is_active and ip.verification_status <> 'suspended'
  ) then raise exception 'interviewer must be an active member of the session organization'; end if;
  if not exists (select 1 from public.profiles where id = new.candidate_id and role = 'candidate' and is_active) then
    raise exception 'candidate must be an active candidate account';
  end if;
  return new;
end; $$;

create or replace function public.sync_session_lifecycle() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'in_progress' and old.status <> 'in_progress' then
    new.actual_start_time := coalesce(new.actual_start_time, now());
  elsif new.status in ('completed', 'cancelled') and old.status not in ('completed', 'cancelled') then
    new.actual_end_time := coalesce(new.actual_end_time, now());
  end if;
  return new;
end; $$;

create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'Candidate'), '@', 1)), 'candidate');
  insert into public.candidate_profiles (user_id) values (new.id);
  return new;
end; $$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger interviewer_profiles_updated_at before update on public.interviewer_profiles for each row execute function public.set_updated_at();
create trigger candidate_profiles_updated_at before update on public.candidate_profiles for each row execute function public.set_updated_at();
create trigger sessions_updated_at before update on public.interview_sessions for each row execute function public.set_updated_at();
create trigger waiting_rooms_updated_at before update on public.interview_waiting_rooms for each row execute function public.set_updated_at();
create trigger notes_updated_at before update on public.interview_notes for each row execute function public.set_updated_at();
create trigger platform_settings_updated_at before update on public.platform_settings for each row execute function public.set_updated_at();
create trigger validate_session_assignment before insert or update of organization_id, interviewer_id, candidate_id on public.interview_sessions for each row execute function public.validate_session_assignment();
create trigger sync_session_lifecycle before update of status on public.interview_sessions for each row execute function public.sync_session_lifecycle();
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

-- Auth users live outside the public schema and are intentionally retained by
-- this reset. Recreate minimal candidate profiles for existing identities;
-- promote the first platform administrator manually in the SQL Editor after
-- applying this migration: update public.profiles set role = 'super_admin'
-- where email = 'admin@your-company.com';
insert into public.profiles (id, email, full_name, role)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)), 'candidate'
from auth.users
where email is not null
on conflict (id) do nothing;
insert into public.candidate_profiles (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.interviewer_profiles enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_waiting_rooms enable row level security;
alter table public.interview_resources enable row level security;
alter table public.proctoring_events enable row level security;
alter table public.interview_feedback enable row level security;
alter table public.interview_notes enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

-- Identity and organization policies.
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_platform_admin());
create policy organizations_select on public.organizations for select to authenticated using (public.is_org_admin(id) or exists(select 1 from public.organization_members m where m.organization_id = id and m.user_id = auth.uid()));
create policy organizations_manage on public.organizations for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy memberships_select on public.organization_members for select to authenticated using (user_id = auth.uid() or public.is_org_admin(organization_id));
create policy memberships_manage on public.organization_members for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy interviewer_profiles_select on public.interviewer_profiles for select to authenticated using (user_id = auth.uid() or public.is_org_admin(organization_id) or public.is_platform_admin());
create policy candidate_profiles_select on public.candidate_profiles for select to authenticated using (user_id = auth.uid() or public.is_platform_admin() or exists(select 1 from public.interview_sessions s where s.candidate_id = candidate_profiles.user_id and public.can_manage_session(s.id)));

-- Session policies: candidates see only their session; an interviewer/org admin sees managed sessions.
create policy sessions_select on public.interview_sessions for select to authenticated using (public.can_access_session(id));
create policy sessions_insert on public.interview_sessions for insert to authenticated with check (public.is_org_admin(organization_id));
create policy sessions_update on public.interview_sessions for update to authenticated using (public.can_manage_session(id)) with check (public.can_manage_session(id));
create policy waiting_rooms_select on public.interview_waiting_rooms for select to authenticated using (candidate_id = auth.uid() or public.can_manage_session(session_id));
create policy waiting_rooms_candidate_upsert on public.interview_waiting_rooms for insert to authenticated with check (candidate_id = auth.uid() and public.can_access_session(session_id));
create policy waiting_rooms_candidate_update on public.interview_waiting_rooms for update to authenticated using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());
create policy waiting_rooms_manager_update on public.interview_waiting_rooms for update to authenticated using (public.can_manage_session(session_id)) with check (public.can_manage_session(session_id));
create policy resources_select on public.interview_resources for select to authenticated using (public.can_access_session(session_id));
create policy resources_manage on public.interview_resources for all to authenticated using (public.can_manage_session(session_id)) with check (public.can_manage_session(session_id));
create policy proctoring_select on public.proctoring_events for select to authenticated using (public.can_manage_session(session_id) or user_id = auth.uid());
create policy proctoring_candidate_insert on public.proctoring_events for insert to authenticated with check (user_id = auth.uid() and public.can_access_session(session_id));
create policy feedback_select on public.interview_feedback for select to authenticated using (public.can_manage_session(session_id));
create policy feedback_manage on public.interview_feedback for all to authenticated using (public.can_manage_session(session_id)) with check (public.can_manage_session(session_id));
create policy notes_owner_select on public.interview_notes for select to authenticated using (author_id = auth.uid() or public.is_platform_admin());
create policy notes_owner_manage on public.interview_notes for all to authenticated using (author_id = auth.uid() and public.can_manage_session(session_id)) with check (author_id = auth.uid() and public.can_manage_session(session_id));
create policy audit_admin_select on public.audit_logs for select to authenticated using (public.is_platform_admin());
create policy settings_admin_manage on public.platform_settings for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Direct browser access is limited to what the RLS policies allow. The Express
-- server uses the service-role key and remains the privileged admin boundary.
grant select on public.profiles, public.organizations, public.organization_members, public.interviewer_profiles, public.candidate_profiles, public.interview_sessions, public.interview_waiting_rooms, public.interview_resources, public.proctoring_events, public.interview_feedback, public.interview_notes, public.audit_logs, public.platform_settings to authenticated;
grant insert, update on public.interview_waiting_rooms, public.proctoring_events, public.interview_resources, public.interview_feedback, public.interview_notes, public.interview_sessions to authenticated;

-- The server uses the service-role key. It bypasses RLS but still requires
-- PostgreSQL table privileges after a schema recreation.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
