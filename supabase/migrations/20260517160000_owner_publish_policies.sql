-- ─────────────────────────────────────────────────────────────────────────────
-- Allow the Mac app owner to publish (upsert) breakdown snapshot data.
--
-- The initial schema restricted all writes to service-role only.
-- These policies open INSERT + UPDATE to the production owner so the Mac app
-- can call the PostgREST upsert endpoint directly with the user's JWT.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Fix production_members bootstrap ─────────────────────────────────────────
-- The original "owners can add members" policy called is_production_owner(),
-- which checks production_members — so the very first INSERT (creating the
-- owner row) always fails.  Add a fallback that allows the production owner
-- (identified via productions.owner_id) to insert their own owner row.

drop policy if exists "owners can add members" on production_members;

create policy "owners can add members"
  on production_members for insert
  with check (
    is_production_owner(production_id)
    or (
      auth.uid() = user_id
      and role = 'owner'
      and exists (
        select 1 from productions
        where id = production_id
        and owner_id = auth.uid()
      )
    )
  );

-- ── Episodes ──────────────────────────────────────────────────────────────────

create policy "owners can publish episodes"
  on episodes for insert
  with check (is_production_owner(production_id));

create policy "owners can update episodes"
  on episodes for update
  using (is_production_owner(production_id));

-- ── Scripts ───────────────────────────────────────────────────────────────────

create policy "owners can publish scripts"
  on scripts for insert
  with check (
    exists (
      select 1 from episodes e
      where e.id = episode_id
      and is_production_owner(e.production_id)
    )
  );

create policy "owners can update scripts"
  on scripts for update
  using (
    exists (
      select 1 from episodes e
      where e.id = episode_id
      and is_production_owner(e.production_id)
    )
  );

-- ── Scenes ────────────────────────────────────────────────────────────────────

create policy "owners can publish scenes"
  on scenes for insert
  with check (
    exists (
      select 1 from scripts s
      join episodes e on e.id = s.episode_id
      where s.id = script_id
      and is_production_owner(e.production_id)
    )
  );

create policy "owners can update scenes"
  on scenes for update
  using (
    exists (
      select 1 from scripts s
      join episodes e on e.id = s.episode_id
      where s.id = script_id
      and is_production_owner(e.production_id)
    )
  );

-- ── Breakdown sheets ──────────────────────────────────────────────────────────

create policy "owners can publish breakdown sheets"
  on breakdown_sheets for insert
  with check (
    exists (
      select 1 from scenes sc
      join scripts s  on s.id  = sc.script_id
      join episodes e on e.id  = s.episode_id
      where sc.id = scene_id
      and is_production_owner(e.production_id)
    )
  );

create policy "owners can update breakdown sheets"
  on breakdown_sheets for update
  using (
    exists (
      select 1 from scenes sc
      join scripts s  on s.id  = sc.script_id
      join episodes e on e.id  = s.episode_id
      where sc.id = scene_id
      and is_production_owner(e.production_id)
    )
  );

-- ── Elements ──────────────────────────────────────────────────────────────────

create policy "owners can publish elements"
  on elements for insert
  with check (is_production_owner(production_id));

create policy "owners can update elements"
  on elements for update
  using (is_production_owner(production_id));

-- ── Scene elements ────────────────────────────────────────────────────────────

create policy "owners can publish scene elements"
  on scene_elements for insert
  with check (
    exists (
      select 1 from breakdown_sheets bd
      join scenes sc  on sc.id = bd.scene_id
      join scripts s  on s.id  = sc.script_id
      join episodes e on e.id  = s.episode_id
      where bd.id = breakdown_sheet_id
      and is_production_owner(e.production_id)
    )
  );

create policy "owners can update scene elements"
  on scene_elements for update
  using (
    exists (
      select 1 from breakdown_sheets bd
      join scenes sc  on sc.id = bd.scene_id
      join scripts s  on s.id  = sc.script_id
      join episodes e on e.id  = s.episode_id
      where bd.id = breakdown_sheet_id
      and is_production_owner(e.production_id)
    )
  );
