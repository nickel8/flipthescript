-- 1-to-many notes per breakdown sheet
create table sheet_notes (
  id         uuid primary key default gen_random_uuid(),
  sheet_id   uuid not null references breakdown_sheets(id) on delete cascade,
  body       text not null default '',
  author_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index on sheet_notes(sheet_id, created_at);

alter table sheet_notes enable row level security;

-- Service role bypasses RLS; direct client access is not used.
-- Permissive policy so any authenticated user can read/write via the API layer.
create policy "service role manages sheet notes"
  on sheet_notes for all
  using (true)
  with check (true);
