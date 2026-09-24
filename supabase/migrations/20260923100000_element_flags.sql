create table element_flags (
  id               uuid primary key default gen_random_uuid(),
  scene_element_id uuid not null references scene_elements(id) on delete cascade,
  production_id    uuid not null references productions(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  note             text not null default '',
  due_date         date,
  is_done          boolean not null default false,
  created_at       timestamptz default now(),
  unique (scene_element_id, user_id)
);

create index element_flags_user_production_idx on element_flags(user_id, production_id);
