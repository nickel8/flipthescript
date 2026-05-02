create table if not exists license_keys (
  id                    uuid primary key default gen_random_uuid(),
  key                   text unique not null,
  email                 text not null,
  paddle_transaction_id text unique not null,
  created_at            timestamptz default now(),
  activated_at          timestamptz,
  machine_id            text
);

-- Only the service role (server-side) can read/write — no public access
alter table license_keys enable row level security;
