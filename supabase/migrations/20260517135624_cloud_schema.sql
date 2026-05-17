-- ─────────────────────────────────────────────────────────────────────────────
-- FlipTheScript Cloud — v1 schema
--
-- Access model:
--   owner        — created the production on the Mac app, pays £4.99/mo
--   dept_owner   — HOD who bought team licence (£49.99/mo), manages membership
--   collaborator — invited team member, free (read-only) or paid (£9.99/mo)
--
-- Data model:
--   Breakdown data (productions → episodes → scripts → scenes → sheets/elements)
--   is a published snapshot pushed from the Mac app.  It is NEVER written by
--   the web app — only the Mac app's "Publish" action can mutate it (via the
--   service role through a server-side API route).
--
--   To-dos live only in Supabase and are written by authenticated web/mobile
--   users.  They are NOT synced back to the Mac app.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Types ─────────────────────────────────────────────────────────────────────

create type member_role        as enum ('owner', 'dept_owner', 'collaborator');
create type member_tier        as enum ('free', 'paid');
create type subscription_tier  as enum ('cloud_solo', 'cloud_collaborator', 'cloud_team');
create type subscription_status as enum ('active', 'cancelled', 'past_due');

-- ── Profiles ──────────────────────────────────────────────────────────────────
-- Auto-created when a user signs up via Supabase Auth.

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  created_at  timestamptz default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Productions ───────────────────────────────────────────────────────────────
-- One row per Mac app production.  cloud_id matches the UUID stored in Core Data.

create table productions (
  id            uuid primary key default gen_random_uuid(),
  cloud_id      uuid unique not null,   -- stable UUID from Core Data
  name          text not null,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  published_at  timestamptz,            -- last time Mac app pushed a snapshot
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── Production members ────────────────────────────────────────────────────────
-- Scopes every user's access to a specific production.
-- A user can be a member of many productions with different roles/tiers.

create table production_members (
  id             uuid primary key default gen_random_uuid(),
  production_id  uuid not null references productions(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  role           member_role not null default 'collaborator',
  tier           member_tier not null default 'free',
  invited_by     uuid references auth.users(id),
  created_at     timestamptz default now(),
  unique (production_id, user_id)
);

-- ── Subscriptions ─────────────────────────────────────────────────────────────
-- Tracks Paddle subscription state per user.
-- production_id is null for account-level tiers (cloud_solo, cloud_collaborator).
-- For cloud_team, production_id scopes it to that production only.

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  production_id          uuid references productions(id) on delete cascade,
  tier                   subscription_tier not null,
  status                 subscription_status not null default 'active',
  paddle_subscription_id text unique,
  current_period_end     timestamptz,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

-- ── Breakdown snapshot tables ─────────────────────────────────────────────────
-- Written only by the Mac app publish action (service role via API route).
-- All use cloud_id as the stable upsert key matching Core Data UUIDs.

create table episodes (
  id             uuid primary key default gen_random_uuid(),
  cloud_id       uuid unique not null,
  production_id  uuid not null references productions(id) on delete cascade,
  name           text not null,
  number         int not null default 0,
  is_default     boolean not null default false
);

create table scripts (
  id            uuid primary key default gen_random_uuid(),
  cloud_id      uuid unique not null,
  episode_id    uuid not null references episodes(id) on delete cascade,
  version       text not null,
  filename      text not null,
  imported_at   timestamptz not null,
  color_hex     text,
  is_current    boolean not null default true,
  published_at  timestamptz default now()
);

create table scenes (
  id               uuid primary key default gen_random_uuid(),
  cloud_id         uuid unique not null,
  script_id        uuid not null references scripts(id) on delete cascade,
  scene_number     text not null,
  slug_line        text not null,
  int_ext          text not null default '',
  location         text not null default '',
  time_of_day      text not null default '',
  page_start       int not null default 1,
  raw_text         text not null default '',
  revision_status  text not null default 'Unchanged',
  shoot_day        int not null default 0,
  shoot_order      int not null default 0,
  is_complete      boolean not null default false,
  is_deleted       boolean not null default false,  -- soft delete: never hard-remove
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table breakdown_sheets (
  id           uuid primary key default gen_random_uuid(),
  cloud_id     uuid unique not null,
  scene_id     uuid not null references scenes(id) on delete cascade,
  synopsis     text not null default '',
  notes        text not null default '',
  is_reviewed  boolean not null default false,
  updated_at   timestamptz default now()
);

create table elements (
  id             uuid primary key default gen_random_uuid(),
  cloud_id       uuid unique not null,
  production_id  uuid not null references productions(id) on delete cascade,
  name           text not null,
  category       text not null,  -- matches ElementCategory rawValue from Mac app
  notes          text not null default ''
);

create table scene_elements (
  id                  uuid primary key default gen_random_uuid(),
  cloud_id            uuid unique not null,
  breakdown_sheet_id  uuid not null references breakdown_sheets(id) on delete cascade,
  element_id          uuid not null references elements(id) on delete cascade,
  notes               text not null default '',
  unique (breakdown_sheet_id, element_id)
);

-- ── To-dos ────────────────────────────────────────────────────────────────────
-- Supabase-only. Not synced to the Mac app.
-- scene_id is nullable: null = production-level to-do, set = scene-level.
-- On scene soft-delete, scene_id becomes null (set null) so the to-do survives.

create table todos (
  id             uuid primary key default gen_random_uuid(),
  production_id  uuid not null references productions(id) on delete cascade,
  scene_id       uuid references scenes(id) on delete set null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  is_done        boolean not null default false,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ── RLS helper functions ──────────────────────────────────────────────────────

create or replace function is_production_member(prod_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from production_members
    where production_id = prod_id
    and user_id = auth.uid()
  )
$$;

create or replace function is_production_owner(prod_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from production_members
    where production_id = prod_id
    and user_id = auth.uid()
    and role in ('owner', 'dept_owner')
  )
$$;

create or replace function is_paid_member(prod_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from production_members
    where production_id = prod_id
    and user_id = auth.uid()
    and tier = 'paid'
  )
$$;

-- ── RLS policies ──────────────────────────────────────────────────────────────

-- profiles
alter table profiles enable row level security;
create policy "users can view own profile"    on profiles for select  using (auth.uid() = id);
create policy "users can update own profile"  on profiles for update  using (auth.uid() = id);

-- productions
alter table productions enable row level security;
create policy "members can view production"
  on productions for select using (is_production_member(id));
create policy "authenticated users can create productions"
  on productions for insert with check (auth.uid() = owner_id);
create policy "owners can update production"
  on productions for update using (auth.uid() = owner_id);
create policy "owners can delete production"
  on productions for delete using (auth.uid() = owner_id);

-- production_members
alter table production_members enable row level security;
create policy "members see own membership and owners see all"
  on production_members for select
  using (user_id = auth.uid() or is_production_owner(production_id));
create policy "owners can add members"
  on production_members for insert
  with check (is_production_owner(production_id));
create policy "owners can update member roles"
  on production_members for update
  using (is_production_owner(production_id));
create policy "owners and self can remove members"
  on production_members for delete
  using (is_production_owner(production_id) or auth.uid() = user_id);

-- subscriptions
alter table subscriptions enable row level security;
create policy "users can view own subscriptions"
  on subscriptions for select using (auth.uid() = user_id);

-- breakdown snapshot tables: members can SELECT, writes are service-role only
alter table episodes        enable row level security;
alter table scripts         enable row level security;
alter table scenes          enable row level security;
alter table breakdown_sheets enable row level security;
alter table elements        enable row level security;
alter table scene_elements  enable row level security;

create policy "members can view episodes"
  on episodes for select using (is_production_member(production_id));

create policy "members can view scripts"
  on scripts for select using (
    exists (
      select 1 from episodes e
      where e.id = episode_id
      and is_production_member(e.production_id)
    )
  );

create policy "members can view scenes"
  on scenes for select using (
    exists (
      select 1 from scripts s
      join episodes e on e.id = s.episode_id
      where s.id = script_id
      and is_production_member(e.production_id)
    )
  );

create policy "members can view breakdown sheets"
  on breakdown_sheets for select using (
    exists (
      select 1 from scenes sc
      join scripts s  on s.id  = sc.script_id
      join episodes e on e.id  = s.episode_id
      where sc.id = scene_id
      and is_production_member(e.production_id)
    )
  );

create policy "members can view elements"
  on elements for select using (is_production_member(production_id));

create policy "members can view scene elements"
  on scene_elements for select using (
    exists (
      select 1 from breakdown_sheets bd
      join scenes sc  on sc.id  = bd.scene_id
      join scripts s  on s.id   = sc.script_id
      join episodes e on e.id   = s.episode_id
      where bd.id = breakdown_sheet_id
      and is_production_member(e.production_id)
    )
  );

-- todos: paid members manage their own; owners see all
alter table todos enable row level security;
create policy "owners see all todos, paid members see own"
  on todos for select using (
    is_production_owner(production_id)
    or (auth.uid() = user_id and is_paid_member(production_id))
  );
create policy "paid members can create todos"
  on todos for insert with check (
    auth.uid() = user_id
    and is_paid_member(production_id)
  );
create policy "users can update own todos"
  on todos for update using (
    auth.uid() = user_id
    and is_paid_member(production_id)
  );
create policy "users can delete own todos"
  on todos for delete using (auth.uid() = user_id);
