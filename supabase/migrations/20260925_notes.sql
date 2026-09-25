-- Unified notes table — attachable to any entity in the hierarchy
create table if not exists notes (
  id            uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions(id) on delete cascade,
  author_id     uuid not null references auth.users(id) on delete cascade,
  body          text not null check (char_length(body) > 0),
  -- attach to at most one entity (null = production-level)
  series_id     uuid references series(id) on delete set null,
  block_id      uuid references blocks(id) on delete set null,
  episode_id    uuid references episodes(id) on delete set null,
  scene_id      uuid references scenes(id) on delete set null,
  element_id    uuid references elements(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists notes_production_idx on notes(production_id);
create index if not exists notes_series_idx    on notes(series_id)  where series_id  is not null;
create index if not exists notes_block_idx     on notes(block_id)   where block_id   is not null;
create index if not exists notes_episode_idx   on notes(episode_id) where episode_id is not null;
create index if not exists notes_scene_idx     on notes(scene_id)   where scene_id   is not null;
create index if not exists notes_element_idx   on notes(element_id) where element_id is not null;

alter table notes enable row level security;

-- Service role bypasses RLS; all access goes through the API layer.
create policy "service role manages notes"
  on notes for all using (true) with check (true);
