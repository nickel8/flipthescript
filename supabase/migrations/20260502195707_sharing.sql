-- shared_breakdowns: one row per published breakdown snapshot
create table shared_breakdowns (
  id                uuid primary key default gen_random_uuid(),
  blob_key          text not null,           -- Vercel Blob key (private)
  production_name   text not null,
  script_version    text not null,
  scene_count       int not null default 0,
  ad_email          text not null,           -- Art Director who published
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- breakdown_access: who is allowed to view a breakdown
create table breakdown_access (
  id              uuid primary key default gen_random_uuid(),
  breakdown_id    uuid not null references shared_breakdowns(id) on delete cascade,
  email           text not null,
  invited_at      timestamptz default now(),
  last_accessed   timestamptz,
  unique(breakdown_id, email)
);

-- magic_tokens: single-use, expiring tokens for passwordless access
create table magic_tokens (
  id            uuid primary key default gen_random_uuid(),
  token         text unique not null default gen_random_uuid()::text,
  breakdown_id  uuid not null references shared_breakdowns(id) on delete cascade,
  email         text not null,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz default now()
);

-- RLS: service role only — all access is via server endpoints
alter table shared_breakdowns  enable row level security;
alter table breakdown_access   enable row level security;
alter table magic_tokens        enable row level security;
