-- ─────────────────────────────────────────────────────────────────────────────
-- Web breakdown editor — write permissions
--
-- Lifts the read-only constraint on breakdown data for paid production members.
-- The Mac app remains the only writer of scenes/scripts/episodes.
-- Web owns: breakdown_sheets, elements, scene_elements.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── breakdown_sheets ──────────────────────────────────────────────────────────
-- Paid members can update synopsis/notes/is_reviewed on sheets for their scenes.
-- INSERT is needed in case a scene was published without a sheet (edge case).

create policy "paid members can insert breakdown sheets"
  on breakdown_sheets for insert
  with check (
    exists (
      select 1 from scenes sc
      join scripts s  on s.id  = sc.script_id
      join episodes e on e.id  = s.episode_id
      where sc.id = scene_id
      and is_paid_member(e.production_id)
    )
  );

create policy "paid members can update breakdown sheets"
  on breakdown_sheets for update
  using (
    exists (
      select 1 from scenes sc
      join scripts s  on s.id  = sc.script_id
      join episodes e on e.id  = s.episode_id
      where sc.id = scene_id
      and is_paid_member(e.production_id)
    )
  );

-- ── elements ──────────────────────────────────────────────────────────────────
-- Paid members can create and rename elements within their production.

create policy "paid members can insert elements"
  on elements for insert
  with check (is_paid_member(production_id));

create policy "paid members can update elements"
  on elements for update
  using (is_paid_member(production_id));

create policy "paid members can delete elements"
  on elements for delete
  using (is_paid_member(production_id));

-- ── scene_elements ────────────────────────────────────────────────────────────
-- Paid members can link and unlink elements to/from breakdown sheets.

create policy "paid members can insert scene elements"
  on scene_elements for insert
  with check (
    exists (
      select 1 from breakdown_sheets bd
      join scenes sc  on sc.id  = bd.scene_id
      join scripts s  on s.id   = sc.script_id
      join episodes e on e.id   = s.episode_id
      where bd.id = breakdown_sheet_id
      and is_paid_member(e.production_id)
    )
  );

create policy "paid members can delete scene elements"
  on scene_elements for delete
  using (
    exists (
      select 1 from breakdown_sheets bd
      join scenes sc  on sc.id  = bd.scene_id
      join scripts s  on s.id   = sc.script_id
      join episodes e on e.id   = s.episode_id
      where bd.id = breakdown_sheet_id
      and is_paid_member(e.production_id)
    )
  );

-- ── scenes — is_complete ──────────────────────────────────────────────────────
-- Paid members can tick a scene as complete from the web.

create policy "paid members can update scene completion"
  on scenes for update
  using (
    exists (
      select 1 from scripts s
      join episodes e on e.id = s.episode_id
      where s.id = script_id
      and is_paid_member(e.production_id)
    )
  )
  with check (
    exists (
      select 1 from scripts s
      join episodes e on e.id = s.episode_id
      where s.id = script_id
      and is_paid_member(e.production_id)
    )
  );
