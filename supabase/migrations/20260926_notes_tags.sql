-- Add tag and on_breakdown flag to notes
alter table notes
  add column if not exists tag          text    default null,
  add column if not exists on_breakdown boolean not null default false;

-- Index for fetching breakdown-flagged notes per scene efficiently
create index if not exists notes_on_breakdown_idx
  on notes(production_id, scene_id)
  where on_breakdown = true;
