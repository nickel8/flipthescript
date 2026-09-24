-- Global admin-curated category library
create table category_library (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order int not null default 999,
  is_default boolean not null default false
);

insert into category_library (name, display_order, is_default) values
  ('Characters',    10,  true),
  ('Action Props',  20,  true),
  ('Standby Props', 30,  true),
  ('Set Dressing',  40,  true),
  ('Graphics',      50,  true),
  ('Vehicles',      60,  true),
  ('Weapons',      100, false),
  ('Animals',      110, false),
  ('Greens',       120, false),
  ('SFX',          130, false),
  ('VFX',          140, false),
  ('Costume',      150, false),
  ('Clearance',    160, false),
  ('Other',        200, false);

-- Per-production categories (copied from library on creation)
create table production_categories (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions(id) on delete cascade,
  name text not null,
  display_order int not null default 999,
  unique(production_id, name)
);

create index production_categories_production_id_idx on production_categories(production_id);

-- Backfill all existing productions with the default categories
insert into production_categories (production_id, name, display_order)
select p.id, cl.name, cl.display_order
from productions p
cross join category_library cl
where cl.is_default = true
on conflict (production_id, name) do nothing;
