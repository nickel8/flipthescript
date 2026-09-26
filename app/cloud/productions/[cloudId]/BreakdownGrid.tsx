"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { SceneData, ProductionElement, SheetData, SceneElementData, FlagData, CategoryData } from "./types";
import { updateSynopsis, updateSheetNotes, addElement, removeElement, toggleComplete, ensureSheet } from "./actions";
import { useNotesContext } from "./NotesContext";
import { compareSceneNumbers } from "@/lib/sort-scenes";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColumnFilter {
  text?: string;                          // text search (location, synopsis, scene #)
  intExt?: string[];                      // INT/EXT multi-select
  status?: "complete" | "incomplete";
  elements?: string[];                    // category column: element names to include
  presence?: "any" | "empty";            // category column: scene has / has-no elements
}

interface GridView {
  id: string;
  name: string;
  visibleCols: string[];
  filters: Record<string, ColumnFilter>;
  sort: { col: string | null; dir: "asc" | "desc" };
  isShared: boolean;
  isOwn: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isFilterActive(f: ColumnFilter | undefined): boolean {
  if (!f) return false;
  return !!(f.text || f.intExt?.length || f.status || f.elements?.length || f.presence);
}

function activeFilterCount(filters: Record<string, ColumnFilter>): number {
  return Object.values(filters).filter(isFilterActive).length;
}

function applyFilters(scenes: SceneData[], filters: Record<string, ColumnFilter>): SceneData[] {
  return scenes.filter((s) => {
    for (const [col, f] of Object.entries(filters)) {
      if (!isFilterActive(f)) continue;
      if (col === "scene_number" && f.text)
        if (!s.scene_number.toLowerCase().includes(f.text.toLowerCase())) return false;
      if (col === "location" && f.text)
        if (!(s.location ?? "").toLowerCase().includes(f.text.toLowerCase())) return false;
      if (col === "synopsis" && f.text)
        if (!(s.sheet?.synopsis ?? "").toLowerCase().includes(f.text.toLowerCase())) return false;
      if (col === "int_ext" && f.intExt?.length)
        if (!f.intExt.includes(s.int_ext || "INT")) return false;
      if (col === "status") {
        if (f.status === "complete" && !s.is_complete) return false;
        if (f.status === "incomplete" && s.is_complete) return false;
      }
      // Category filters
      if (f.elements?.length) {
        const names = (s.sheet?.scene_elements ?? [])
          .filter((se) => se.element.category === col)
          .map((se) => se.element.name);
        if (!f.elements.some((n) => names.includes(n))) return false;
      }
      if (f.presence === "empty") {
        const n = (s.sheet?.scene_elements ?? []).filter((se) => se.element.category === col).length;
        if (n > 0) return false;
      }
    }
    return true;
  });
}

function applySort(
  scenes: SceneData[],
  sort: { col: string | null; dir: "asc" | "desc" }
): SceneData[] {
  if (!sort.col) return scenes;
  return [...scenes].sort((a, b) => {
    let cmp = 0;
    if (sort.col === "scene_number") cmp = compareSceneNumbers(a.scene_number, b.scene_number);
    else if (sort.col === "location") cmp = (a.location ?? "").localeCompare(b.location ?? "");
    else if (sort.col === "synopsis") cmp = (a.sheet?.synopsis ?? "").localeCompare(b.sheet?.synopsis ?? "");
    else if (sort.col === "status") cmp = Number(a.is_complete) - Number(b.is_complete);
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

function randomId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Column widths ─────────────────────────────────────────────────────────────

const COL_SCENE = 56;
const COL_CHECK = 44;

function defaultWidths(catNames: string[]): Record<string, number> {
  const w: Record<string, number> = { location: 160, synopsis: 200, notes: 200 };
  for (const cat of catNames) w[cat] = 140;
  return w;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  scenes: SceneData[];
  productionElements: ProductionElement[];
  categories: CategoryData[];
  categoryLibrary: CategoryData[];
  productionId: string;
  flags: Map<string, FlagData>;
  onCompleteToggle: (sceneId: string, isComplete: boolean) => void;
  onSheetChange: (sceneId: string, sheet: SheetData | null) => void;
  onElementCreated: (el: ProductionElement) => void;
  onCategoryCreate: (cat: CategoryData) => void;
  readOnly?: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BreakdownGrid({
  scenes,
  productionElements,
  categories,
  categoryLibrary,
  productionId,
  flags,
  onCompleteToggle,
  onSheetChange,
  onElementCreated,
  onCategoryCreate,
  readOnly = false,
}: Props) {
  const catNames = categories.map((c) => c.name);

  const [colOrder, setColOrder] = useState<string[]>(() => catNames);
  const dragColRef = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => defaultWidths(catNames));
  const colWidthsRef = useRef(colWidths);
  useEffect(() => { colWidthsRef.current = colWidths; }, [colWidths]);

  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => new Set(["synopsis", ...catNames]));

  const [sort, setSort] = useState<{ col: string | null; dir: "asc" | "desc" }>({ col: null, dir: "asc" });
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({});
  const [views, setViews] = useState<GridView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  // Active filter popover: tracks which column's filter is open + button position
  const [filterPopover, setFilterPopover] = useState<{ col: string; rect: DOMRect } | null>(null);

  // Load views from DB
  useEffect(() => {
    fetch(`/api/breakdown-views?productionId=${productionId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setViews(data); })
      .catch(() => {});
  }, [productionId]);

  // Sync new categories into colOrder, visibleCols, colWidths
  useEffect(() => {
    const names = categories.map((c) => c.name);
    setColOrder((prev) => {
      const added = names.filter((n) => !prev.includes(n));
      return added.length ? [...prev, ...added] : prev;
    });
    setVisibleCols((prev) => {
      const added = names.filter((c) => !prev.has(c));
      return added.length ? new Set([...prev, ...added]) : prev;
    });
    setColWidths((prev) => {
      const extra: Record<string, number> = {};
      for (const c of names) if (!(c in prev)) extra[c] = 140;
      return Object.keys(extra).length ? { ...prev, ...extra } : prev;
    });
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close col picker on outside click
  useEffect(() => {
    if (!colPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setColPickerOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [colPickerOpen]);

  // Close filter popover on scroll (stale rect)
  useEffect(() => {
    if (!filterPopover) return;
    const onScroll = () => setFilterPopover(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [filterPopover?.col]); // eslint-disable-line react-hooks/exhaustive-deps

  const locationLeft = COL_CHECK + COL_SCENE;

  const startResize = useCallback((col: string, startX: number) => {
    const startWidth = colWidthsRef.current[col] ?? 120;
    function onMove(e: MouseEvent) {
      setColWidths((prev) => ({ ...prev, [col]: Math.max(60, startWidth + e.clientX - startX) }));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  function cycleSort(col: string) {
    setSort((prev) => {
      if (prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return { col: null, dir: "asc" };
    });
    setActiveViewId(null);
  }

  function setFilter(col: string, update: Partial<ColumnFilter>) {
    setColumnFilters((prev) => {
      const merged = { ...(prev[col] ?? {}), ...update };
      if (!isFilterActive(merged)) {
        const { [col]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [col]: merged };
    });
    setActiveViewId(null);
  }

  function clearFilter(col: string) {
    setColumnFilters((prev) => { const { [col]: _, ...rest } = prev; return rest; });
  }

  function clearAllFilters() {
    setColumnFilters({});
    setSort({ col: null, dir: "asc" });
    setActiveViewId(null);
    setFilterPopover(null);
  }

  function openFilterPopover(col: string, btn: HTMLElement) {
    const rect = btn.getBoundingClientRect();
    setFilterPopover((prev) => (prev?.col === col ? null : { col, rect }));
    setColPickerOpen(false);
  }

  function applyView(view: GridView | null) {
    if (!view) {
      setVisibleCols(new Set(["synopsis", ...catNames]));
      setColumnFilters({});
      setSort({ col: null, dir: "asc" });
      setActiveViewId(null);
      return;
    }
    setVisibleCols(new Set(view.visibleCols));
    setColumnFilters(view.filters);
    setSort(view.sort);
    setActiveViewId(view.id);
  }

  async function saveView(name: string, isShared: boolean) {
    const res = await fetch("/api/breakdown-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productionId,
        name,
        isShared,
        visibleCols: [...visibleCols],
        filters: columnFilters,
        sort,
      }),
    });
    const data = await res.json();
    if (!data?.id) throw new Error(data?.error ?? "Failed to save view");
    setViews((prev) => [...prev, data as GridView]);
    setActiveViewId(data.id);
  }

  async function toggleViewSharing(id: string, isShared: boolean) {
    const res = await fetch("/api/breakdown-views", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isShared }),
    });
    const data = await res.json();
    if (data?.ok) {
      setViews((prev) => prev.map((v) => v.id === id ? { ...v, isShared } : v));
    }
  }

  async function deleteView(id: string) {
    await fetch("/api/breakdown-views", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setViews((prev) => prev.filter((v) => v.id !== id));
    if (activeViewId === id) setActiveViewId(null);
  }

  const filterCount = activeFilterCount(columnFilters);
  const showSynopsis = visibleCols.has("synopsis");
  const visibleCatCols = colOrder.filter((c) => visibleCols.has(c));

  function persistColOrder(order: string[]) {
    if (readOnly) return;
    fetch("/api/production-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productionId, order }),
    }).catch(() => {});
  }

  const processedScenes = useMemo(
    () => applySort(applyFilters(scenes, columnFilters), sort),
    [scenes, columnFilters, sort]
  );

  const sceneNumFilterActive =
    isFilterActive(columnFilters["scene_number"]) || isFilterActive(columnFilters["int_ext"]);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-black/10 min-h-[34px]">
        {activeViewId && (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-black text-white px-2 py-0.5">
            {views.find((v) => v.id === activeViewId)?.name}
            <button onClick={() => applyView(null)} className="opacity-50 hover:opacity-100 leading-none ml-0.5">×</button>
          </span>
        )}
        {filterCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] opacity-50">
            {filterCount} filter{filterCount !== 1 ? "s" : ""}
            <button onClick={clearAllFilters} className="hover:opacity-80 leading-none">×</button>
          </span>
        )}
        {(filterCount > 0 || sort.col) && (
          <span className="text-[10px] opacity-25 tabular-nums">
            {processedScenes.length} / {scenes.length}
          </span>
        )}

        <div className="relative ml-auto" ref={colPickerRef}>
          <button
            onClick={() => { setColPickerOpen((p) => !p); setFilterPopover(null); }}
            className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 border border-black/15 transition-colors ${
              colPickerOpen ? "bg-black text-white" : "opacity-40 hover:opacity-70"
            }`}
          >
            Columns
          </button>
          {colPickerOpen && (
            <ColPicker
              catNames={catNames}
              categoryLibrary={categoryLibrary}
              visibleCols={visibleCols}
              setVisibleCols={setVisibleCols}
              views={views}
              activeViewId={activeViewId}
              onApplyView={applyView}
              onSaveView={saveView}
              onToggleViewSharing={toggleViewSharing}
              onDeleteView={deleteView}
              productionId={productionId}
              onCategoryCreate={onCategoryCreate}
              onClose={() => setColPickerOpen(false)}
              readOnly={readOnly}
            />
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-auto select-none">
        <table className="border-collapse text-sm text-black" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: COL_CHECK }} />
            <col style={{ width: COL_SCENE }} />
            <col style={{ width: colWidths.location }} />
            {showSynopsis && <col style={{ width: colWidths.synopsis }} />}
            {visibleCatCols.map((cat) => (
              <col key={cat} style={{ width: colWidths[cat] ?? 140 }} />
            ))}
            <col style={{ width: colWidths.notes ?? 200 }} />
          </colgroup>

          <thead className="sticky top-0 z-20">
            <tr className="border-b border-black/10 bg-white">
              {/* Status column header */}
              <th className="sticky left-0 z-30 bg-white px-2 py-1.5 text-left font-normal border-r border-black/10">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => cycleSort("status")}
                    title="Sort by status"
                    className="text-[10px] opacity-30 hover:opacity-60 transition-opacity leading-none"
                  >
                    {sort.col === "status" ? (sort.dir === "asc" ? "↑" : "↓") : "○"}
                  </button>
                  <button
                    onClick={(e) => openFilterPopover("status", e.currentTarget)}
                    title="Filter by status"
                    className={`transition-opacity ${isFilterActive(columnFilters["status"]) ? "text-blue-500 opacity-90" : "opacity-15 hover:opacity-50"}`}
                  >
                    <FunnelIcon />
                  </button>
                </div>
              </th>

              {/* Scene # column */}
              <SortableTh
                label="#" col="scene_number"
                left={COL_CHECK} sticky
                sortDir={sort.col === "scene_number" ? sort.dir : undefined}
                filterActive={sceneNumFilterActive}
                onSort={() => cycleSort("scene_number")}
                onOpenFilter={(btn) => openFilterPopover("scene_number", btn)}
                onStartResize={startResize}
              />

              {/* Location */}
              <SortableTh
                label="Location" col="location"
                left={locationLeft} sticky borderRight shadow
                sortDir={sort.col === "location" ? sort.dir : undefined}
                filterActive={isFilterActive(columnFilters["location"])}
                onSort={() => cycleSort("location")}
                onOpenFilter={(btn) => openFilterPopover("location", btn)}
                onStartResize={startResize}
              />

              {/* Synopsis */}
              {showSynopsis && (
                <SortableTh
                  label="Synopsis" col="synopsis"
                  sortDir={sort.col === "synopsis" ? sort.dir : undefined}
                  filterActive={isFilterActive(columnFilters["synopsis"])}
                  onSort={() => cycleSort("synopsis")}
                  onOpenFilter={(btn) => openFilterPopover("synopsis", btn)}
                  onStartResize={startResize}
                />
              )}

              {/* Category columns */}
              {visibleCatCols.map((cat) => (
                <SortableTh
                  key={cat} label={cat} col={cat}
                  borderLeft={dragOverCol !== cat}
                  dragOver={dragOverCol === cat}
                  filterActive={isFilterActive(columnFilters[cat])}
                  onOpenFilter={(btn) => openFilterPopover(cat, btn)}
                  onStartResize={startResize}
                  draggable={!readOnly}
                  onDragStart={(e) => {
                    dragColRef.current = cat;
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverCol !== cat) setDragOverCol(cat);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = dragColRef.current;
                    setDragOverCol(null);
                    dragColRef.current = null;
                    if (!from || from === cat) return;
                    setColOrder((prev) => {
                      const order = [...prev];
                      const fromIdx = order.indexOf(from);
                      const toIdx = order.indexOf(cat);
                      if (fromIdx === -1 || toIdx === -1) return prev;
                      order.splice(fromIdx, 1);
                      order.splice(toIdx, 0, from);
                      persistColOrder(order);
                      return order;
                    });
                  }}
                  onDragEnd={() => {
                    setDragOverCol(null);
                    dragColRef.current = null;
                  }}
                />
              ))}

              {/* Notes — always rightmost */}
              <SortableTh
                label="Notes" col="notes"
                borderLeft
                onStartResize={startResize}
              />
            </tr>
          </thead>

          <tbody>
            {processedScenes.map((scene) => (
              <GridRow
                key={scene.id}
                scene={scene}
                categories={visibleCatCols}
                showSynopsis={showSynopsis}
                productionElements={productionElements}
                productionId={productionId}
                locationLeft={locationLeft}
                flags={flags}
                onCompleteToggle={onCompleteToggle}
                onSheetChange={onSheetChange}
                onElementCreated={onElementCreated}
                readOnly={readOnly}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Filter popover (fixed, outside overflow container) ── */}
      {filterPopover && (
        <FilterPopover
          col={filterPopover.col}
          rect={filterPopover.rect}
          columnFilters={columnFilters}
          productionElements={productionElements}
          catNames={catNames}
          onSetFilter={setFilter}
          onClearFilter={clearFilter}
          onClose={() => setFilterPopover(null)}
        />
      )}
    </div>
  );
}

// ── Funnel icon ───────────────────────────────────────────────────────────────

function FunnelIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M1 1.5h10L7 6.5v4l-2-1.5V6.5L1 1.5z" />
    </svg>
  );
}

// ── Filter popover ────────────────────────────────────────────────────────────

function FilterPopover({
  col, rect, columnFilters, productionElements, catNames,
  onSetFilter, onClearFilter, onClose,
}: {
  col: string;
  rect: DOMRect;
  columnFilters: Record<string, ColumnFilter>;
  productionElements: ProductionElement[];
  catNames: string[];
  onSetFilter: (col: string, update: Partial<ColumnFilter>) => void;
  onClearFilter: (col: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isCategory = catNames.includes(col);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [onClose]);

  // Position: below button; flip left if near right edge
  const style: React.CSSProperties = {
    position: "fixed",
    top: rect.bottom + 4,
    zIndex: 9999,
    ...(rect.left + 220 > window.innerWidth
      ? { right: window.innerWidth - rect.right }
      : { left: rect.left }),
  };

  // ── Category filter ──
  if (isCategory) {
    const filter = columnFilters[col];
    const allElements = productionElements.filter((el) => el.category === col);
    const selected = filter?.elements ?? [];
    const [search, setSearch] = useState("");

    const displayed = search
      ? allElements.filter((el) => el.name.toLowerCase().includes(search.toLowerCase()))
      : allElements;

    function toggleEl(name: string) {
      const next = selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name];
      onSetFilter(col, { elements: next.length ? next : undefined, presence: undefined });
    }

    const active = isFilterActive(filter);

    return (
      <div ref={ref} style={style} className="bg-white border border-black/15 shadow-lg w-52 flex flex-col max-h-72">
        <div className="px-2 pt-2 pb-1.5 border-b border-black/8">
          <input
            autoFocus type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full text-xs border border-black/15 px-2 py-1 focus:outline-none focus:border-black/40 placeholder:opacity-30"
          />
        </div>
        <div className="flex-1 overflow-y-auto py-0.5">
          {/* Empty option */}
          <button
            onClick={() => onSetFilter(col, {
              presence: filter?.presence === "empty" ? undefined : "empty",
              elements: undefined,
            })}
            className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5"
          >
            <span className="w-3 shrink-0 font-bold">{filter?.presence === "empty" ? "✓" : ""}</span>
            <span className="italic opacity-40">Empty</span>
          </button>
          {displayed.length > 0 && <div className="border-t border-black/5 my-0.5" />}
          {displayed.map((el) => (
            <button
              key={el.id}
              onClick={() => toggleEl(el.name)}
              className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5"
            >
              <span className="w-3 shrink-0 font-bold">{selected.includes(el.name) ? "✓" : ""}</span>
              {el.name}
            </button>
          ))}
          {displayed.length === 0 && !filter?.presence && (
            <div className="px-3 py-3 text-xs opacity-25 text-center">No elements yet</div>
          )}
        </div>
        {active && (
          <div className="border-t border-black/10 px-3 py-1.5">
            <button onClick={() => onClearFilter(col)} className="text-[10px] opacity-40 hover:opacity-70 transition-opacity">
              Clear filter
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Status filter ──
  if (col === "status") {
    const cur = columnFilters["status"]?.status;
    return (
      <div ref={ref} style={style} className="bg-white border border-black/15 shadow-lg w-36 py-1">
        {([
          { v: undefined as "complete" | "incomplete" | undefined, label: "All" },
          { v: "incomplete" as const, label: "Todo" },
          { v: "complete" as const, label: "Done" },
        ]).map(({ v, label }) => {
          const active = cur === v || (v === undefined && cur === undefined);
          return (
            <button
              key={label}
              onClick={() => { onSetFilter("status", { status: v }); if (v === undefined) onClearFilter("status"); onClose(); }}
              className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5"
            >
              <span className="w-3 shrink-0 font-bold">{active ? "●" : ""}</span>
              <span className={active ? "" : "opacity-50"}>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ── Scene # / INT/EXT filter ──
  if (col === "scene_number") {
    const [localText, setLocalText] = useState(columnFilters["scene_number"]?.text ?? "");
    const selectedIntExt = columnFilters["int_ext"]?.intExt ?? [];

    function toggleIntExt(val: string) {
      const next = selectedIntExt.includes(val)
        ? selectedIntExt.filter((v) => v !== val)
        : [...selectedIntExt, val];
      if (!next.length) onClearFilter("int_ext");
      else onSetFilter("int_ext", { intExt: next });
    }

    const active = isFilterActive(columnFilters["scene_number"]) || isFilterActive(columnFilters["int_ext"]);

    return (
      <div ref={ref} style={style} className="bg-white border border-black/15 shadow-lg w-44 py-1">
        <div className="px-2 pt-1.5 pb-1.5 border-b border-black/8">
          <input
            autoFocus type="text" value={localText}
            onChange={(e) => { setLocalText(e.target.value); onSetFilter("scene_number", { text: e.target.value || undefined }); }}
            placeholder="Scene #…"
            className="w-full text-xs border border-black/15 px-2 py-1 focus:outline-none focus:border-black/40 placeholder:opacity-30"
          />
        </div>
        <div className="px-3 pt-1.5 pb-0.5 text-[9px] font-bold uppercase tracking-widest opacity-30">INT / EXT</div>
        {(["INT", "EXT", "INT/EXT"] as const).map((val) => (
          <button
            key={val}
            onClick={() => toggleIntExt(val)}
            className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5"
          >
            <span className="w-3 shrink-0 font-bold">{selectedIntExt.includes(val) ? "✓" : ""}</span>
            <span className={selectedIntExt.includes(val) ? "" : "opacity-50"}>{val}</span>
          </button>
        ))}
        {active && (
          <div className="border-t border-black/10 px-3 py-1.5">
            <button
              onClick={() => { onClearFilter("scene_number"); onClearFilter("int_ext"); setLocalText(""); }}
              className="text-[10px] opacity-40 hover:opacity-70 transition-opacity"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Text filter (location, synopsis) ──
  const [localText, setLocalText] = useState(columnFilters[col]?.text ?? "");
  const label = col.charAt(0).toUpperCase() + col.slice(1);

  return (
    <div ref={ref} style={style} className="bg-white border border-black/15 shadow-lg w-48 p-2">
      <input
        autoFocus type="text" value={localText}
        onChange={(e) => { setLocalText(e.target.value); onSetFilter(col, { text: e.target.value || undefined }); }}
        placeholder={`Filter ${label}…`}
        className="w-full text-xs border border-black/15 px-2 py-1.5 focus:outline-none focus:border-black/40 placeholder:opacity-30"
      />
      {isFilterActive(columnFilters[col]) && (
        <button
          onClick={() => { onClearFilter(col); setLocalText(""); }}
          className="mt-1.5 text-[10px] opacity-40 hover:opacity-70 transition-opacity block"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}

// ── Columns picker + views ────────────────────────────────────────────────────

function ColPicker({
  catNames, categoryLibrary, visibleCols, setVisibleCols,
  views, activeViewId, onApplyView, onSaveView, onToggleViewSharing, onDeleteView,
  productionId, onCategoryCreate, onClose, readOnly,
}: {
  catNames: string[]; categoryLibrary: CategoryData[];
  visibleCols: Set<string>; setVisibleCols: React.Dispatch<React.SetStateAction<Set<string>>>;
  views: GridView[]; activeViewId: string | null;
  onApplyView: (v: GridView | null) => void;
  onSaveView: (name: string, isShared: boolean) => Promise<void>;
  onToggleViewSharing: (id: string, isShared: boolean) => Promise<void>;
  onDeleteView: (id: string) => Promise<void>;
  productionId: string; onCategoryCreate: (cat: CategoryData) => void;
  onClose: () => void;
  readOnly: boolean;
}) {
  const [newCatInput, setNewCatInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [viewName, setViewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function toggleCol(col: string) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });
  }

  async function handleAddCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed || catNames.includes(trimmed)) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/production-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, name: trimmed }),
      });
      const data = await res.json();
      if (data?.name) {
        onCategoryCreate({ name: data.name, display_order: data.display_order ?? 999 });
        setNewCatInput("");
        onClose();
      } else {
        setAddError(data?.error ?? "Failed to add column");
      }
    } catch {
      setAddError("Network error");
    } finally {
      setAdding(false);
    }
  }

  const libSuggestions = categoryLibrary.filter(
    (c) => !catNames.includes(c.name) && (!newCatInput || c.name.toLowerCase().includes(newCatInput.toLowerCase()))
  );

  return (
    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-black/15 shadow-lg w-56 py-1 max-h-[75vh] overflow-y-auto">
      {/* Views */}
      <div className="px-3 pt-1 pb-0.5 text-[9px] font-bold uppercase tracking-widest opacity-30">Views</div>
      <button onClick={() => onApplyView(null)} className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5">
        <span className="w-3 shrink-0 font-bold">{!activeViewId ? "●" : ""}</span>
        Default
      </button>
      {views.map((v) => (
        <div key={v.id} className="flex items-center group/view">
          <button
            onClick={() => onApplyView(v)}
            className="flex-1 min-w-0 text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5"
          >
            <span className="w-3 shrink-0 font-bold">{activeViewId === v.id ? "●" : ""}</span>
            <span className="truncate flex-1">{v.name}</span>
          </button>
          {v.isOwn ? (
            <div className="flex items-center gap-1 pr-2 opacity-0 group-hover/view:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => onToggleViewSharing(v.id, !v.isShared)}
                title={v.isShared ? "Make private" : "Share with team"}
                className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border transition-colors ${
                  v.isShared
                    ? "border-black bg-black text-white"
                    : "border-black/20 opacity-50 hover:opacity-100"
                }`}
              >
                {v.isShared ? "Shared" : "Private"}
              </button>
              <button
                onClick={() => onDeleteView(v.id)}
                className="text-xs opacity-40 hover:opacity-80 transition-opacity"
              >
                ×
              </button>
            </div>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-25 pr-3 shrink-0">
              Shared
            </span>
          )}
        </div>
      ))}

      {/* Save form */}
      <div className="px-3 pt-1 pb-2 border-t border-black/10 mt-1">
        <div className="flex gap-1.5">
          <input
            type="text" value={viewName} onChange={(e) => setViewName(e.target.value)}
            placeholder="Save current view as…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && viewName.trim() && !saving) {
                setSaving(true);
                setSaveError(null);
                onSaveView(viewName.trim(), false)
                  .then(() => setViewName(""))
                  .catch((err: Error) => setSaveError(err.message))
                  .finally(() => setSaving(false));
              }
            }}
            className="flex-1 text-[10px] border border-black/15 px-2 py-1 focus:outline-none focus:border-black/40 placeholder:opacity-30"
          />
          <button
            onClick={() => {
              if (!viewName.trim() || saving) return;
              setSaving(true);
              setSaveError(null);
              onSaveView(viewName.trim(), false)
                .then(() => setViewName(""))
                .catch((err: Error) => setSaveError(err.message))
                .finally(() => setSaving(false));
            }}
            disabled={!viewName.trim() || saving}
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-black text-white disabled:opacity-25 shrink-0"
          >
            {saving ? "…" : "Save"}
          </button>
        </div>
        {saveError && (
          <p className="text-[10px] text-red-600 mt-1">{saveError}</p>
        )}
      </div>

      <div className="border-t border-black/10 my-1" />

      {/* Show / Hide */}
      <div className="px-3 pt-0.5 pb-0.5 text-[9px] font-bold uppercase tracking-widest opacity-30">Show / Hide</div>
      <button onClick={() => toggleCol("synopsis")} className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5">
        <span className="w-3 shrink-0 font-bold">{visibleCols.has("synopsis") ? "✓" : ""}</span>
        Synopsis
      </button>
      {catNames.map((cat) => (
        <button key={cat} onClick={() => toggleCol(cat)} className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5">
          <span className="w-3 shrink-0 font-bold">{visibleCols.has(cat) ? "✓" : ""}</span>
          {cat}
        </button>
      ))}

      {!readOnly && (
        <>
          <div className="border-t border-black/10 my-1" />
          <div className="px-3 pt-0.5 pb-0.5 text-[9px] font-bold uppercase tracking-widest opacity-30">Add column</div>
          <div className="px-3 pb-2">
            <input
              type="text" value={newCatInput} onChange={(e) => { setNewCatInput(e.target.value); setAddError(null); }}
              placeholder="Category name…" disabled={adding}
              onKeyDown={(e) => { if (e.key === "Enter" && newCatInput.trim()) { e.preventDefault(); handleAddCategory(newCatInput); } }}
              className="w-full text-xs border border-black/15 px-2 py-1 focus:outline-none focus:border-black/40 placeholder:opacity-30 disabled:opacity-40"
            />
            {addError && (
              <p className="text-[10px] text-red-600 mt-1">{addError}</p>
            )}
          </div>
          {libSuggestions.length > 0 && (
            <div className="border-t border-black/5">
              {libSuggestions.slice(0, 6).map((c) => (
                <button key={c.name} onClick={() => handleAddCategory(c.name)} disabled={adding}
                  className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5 opacity-50 hover:opacity-100 disabled:opacity-20">
                  <span className="w-3 opacity-40 shrink-0">+</span>{c.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sortable column header ────────────────────────────────────────────────────

function SortableTh({
  label, col, left, sticky, borderRight, borderLeft, shadow,
  sortDir, filterActive, onSort, onOpenFilter, onStartResize,
  draggable, dragOver, onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  label: string; col: string; left?: number;
  sticky?: boolean; borderRight?: boolean; borderLeft?: boolean; shadow?: boolean;
  sortDir?: "asc" | "desc"; filterActive?: boolean;
  onSort?: () => void;
  onOpenFilter?: (btn: HTMLButtonElement) => void;
  onStartResize: (col: string, startX: number) => void;
  draggable?: boolean;
  dragOver?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLTableCellElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLTableCellElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLTableCellElement>) => void;
  onDragEnd?: () => void;
}) {
  return (
    <th
      draggable={draggable}
      className={[
        "relative px-2 py-1.5 text-left bg-white font-normal select-none",
        sticky ? "sticky z-30" : "",
        borderRight ? "border-r border-black/15" : "",
        dragOver ? "border-l-2 border-black" : borderLeft ? "border-l border-black/5" : "",
        shadow ? "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]" : "",
        draggable ? "cursor-grab active:cursor-grabbing" : "",
      ].join(" ")}
      style={left !== undefined ? { left } : undefined}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center gap-1 pr-2">
        <button
          onClick={onSort}
          className={`flex-1 text-left flex items-center gap-1 ${onSort ? "cursor-pointer" : "cursor-default"}`}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {label}
          </span>
          {sortDir && <span className="text-[10px] opacity-40">{sortDir === "asc" ? "↑" : "↓"}</span>}
        </button>
        {onOpenFilter && (
          <button
            onClick={(e) => onOpenFilter(e.currentTarget)}
            title="Filter"
            className={`shrink-0 transition-opacity ${filterActive ? "text-blue-500" : "opacity-30 hover:opacity-70"}`}
          >
            <FunnelIcon />
          </button>
        )}
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group"
        onMouseDown={(e) => { e.preventDefault(); onStartResize(col, e.clientX); }}
      >
        <div className="absolute right-0 top-1/4 bottom-1/4 w-px bg-black/0 group-hover:bg-black/20 transition-colors" />
      </div>
    </th>
  );
}

// ── Grid row ──────────────────────────────────────────────────────────────────

function GridRow({
  scene, categories, showSynopsis, productionElements, productionId,
  locationLeft, flags, onCompleteToggle, onSheetChange, onElementCreated, readOnly,
}: {
  scene: SceneData; categories: string[]; showSynopsis: boolean;
  productionElements: ProductionElement[]; productionId: string; locationLeft: number;
  flags: Map<string, FlagData>;
  onCompleteToggle: (sceneId: string, isComplete: boolean) => void;
  onSheetChange: (sceneId: string, sheet: SheetData | null) => void;
  onElementCreated: (el: ProductionElement) => void;
  readOnly: boolean;
}) {
  const { setFocus } = useNotesContext();
  const [sheet, setSheet] = useState<SheetData | null>(scene.sheet);
  const sheetRef = useRef<SheetData | null>(scene.sheet);
  const [isComplete, setIsComplete] = useState(scene.is_complete);

  useEffect(() => {
    sheetRef.current = scene.sheet;
    setSheet(scene.sheet);
    setIsComplete(scene.is_complete);
  }, [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function applySheet(next: SheetData | null) {
    sheetRef.current = next;
    setSheet(next);
    onSheetChange(scene.id, next);
  }

  async function getOrCreateSheet(): Promise<string> {
    if (sheetRef.current?.id) return sheetRef.current.id;
    const id = await ensureSheet(scene.id);
    const newSheet: SheetData = { id, synopsis: "", notes: "", is_reviewed: false, scene_elements: [] };
    applySheet(newSheet);
    return id;
  }

  async function handleToggleComplete() {
    const next = !isComplete;
    setIsComplete(next);
    onCompleteToggle(scene.id, next);
    await toggleComplete(scene.id, next);
  }

  async function handleAddElement(category: string, name: string) {
    const sheetId = await getOrCreateSheet();
    const result = await addElement(sheetId, productionId, name, category);
    const newSE: SceneElementData = { id: result.sceneElementId, element: { id: result.elementId, name: result.name, category } };
    const current = sheetRef.current;
    if (!current || current.scene_elements.some((se) => se.id === newSE.id)) return;
    applySheet({ ...current, scene_elements: [...current.scene_elements, newSE] });
    onElementCreated({ id: result.elementId, name: result.name, category });
  }

  async function handleRemoveElement(sceneElementId: string) {
    const current = sheetRef.current;
    if (!current) return;
    applySheet({ ...current, scene_elements: current.scene_elements.filter((se) => se.id !== sceneElementId) });
    await removeElement(sceneElementId);
  }

  return (
    <tr
      className={`border-b border-black/5 transition-colors cursor-pointer ${isComplete ? "opacity-40" : "hover:bg-black/[0.015]"}`}
      onClick={() => setFocus("scene", scene.id, `Scene ${scene.scene_number} — ${scene.location ?? ""}`)}
    >
      <td className="sticky left-0 z-10 bg-white px-2 border-r border-black/10" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={isComplete} onChange={handleToggleComplete}
          disabled={readOnly} className="cursor-pointer disabled:cursor-default" />
      </td>
      <td className="sticky z-10 bg-white px-2 py-2 align-top" style={{ left: COL_CHECK }}>
        <div className="font-mono text-xs font-bold leading-none truncate">{scene.scene_number}</div>
        <div className={`text-[9px] font-bold mt-1 ${
          scene.int_ext === "EXT" ? "text-green-700" : scene.int_ext === "INT/EXT" ? "text-orange-600" : "text-blue-700"
        }`}>{scene.int_ext || "INT"}</div>
      </td>
      <td className="sticky z-10 bg-white px-3 py-2 align-top border-r border-black/15 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] overflow-hidden" style={{ left: locationLeft }}>
        <div className="max-h-16 overflow-hidden">
          <div className="text-xs font-medium leading-snug truncate">{scene.location}</div>
          {scene.time_of_day && scene.time_of_day !== "UNSPECIFIED" && (
            <div className="text-[10px] opacity-50 mt-0.5">{scene.time_of_day}</div>
          )}
        </div>
      </td>
      {showSynopsis && (
        <SynopsisCell sceneId={scene.id} sheet={sheet} sheetRef={sheetRef}
          getOrCreateSheet={getOrCreateSheet} applySheet={applySheet} readOnly={readOnly} />
      )}
      {categories.map((cat) => (
        <GridElementCell
          key={cat} category={cat}
          sceneElements={(sheet?.scene_elements ?? []).filter((se) => se.element.category === cat)}
          allElements={productionElements.filter((el) => el.category === cat)}
          flags={flags}
          onAdd={(name) => handleAddElement(cat, name)}
          onRemove={handleRemoveElement}
          readOnly={readOnly}
        />
      ))}
      {/* Notes — always rightmost */}
      <NotesCell sheet={sheet} sheetRef={sheetRef}
        getOrCreateSheet={getOrCreateSheet} applySheet={applySheet} readOnly={readOnly} />
    </tr>
  );
}

// ── Synopsis cell ─────────────────────────────────────────────────────────────

function SynopsisCell({
  sceneId: _sceneId, sheet, sheetRef, getOrCreateSheet, applySheet, readOnly,
}: {
  sceneId: string; sheet: SheetData | null; sheetRef: React.RefObject<SheetData | null>;
  getOrCreateSheet: () => Promise<string>; applySheet: (s: SheetData | null) => void; readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(sheet?.synopsis ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (!editing) setText(sheet?.synopsis ?? ""); }, [sheet?.synopsis, editing]);

  async function handleChange(val: string) {
    setText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const id = await getOrCreateSheet();
      await updateSynopsis(id, val);
      const current = sheetRef.current;
      if (current) applySheet({ ...current, synopsis: val });
    }, 600);
  }

  if (readOnly) {
    return (
      <td className="px-3 py-2 align-top overflow-hidden">
        <div className="max-h-16 overflow-hidden text-xs leading-snug">
          {text || <span className="opacity-40">—</span>}
        </div>
      </td>
    );
  }

  return (
    <td className="px-0 py-0 align-top overflow-hidden" onClick={() => !editing && setEditing(true)}>
      {editing ? (
        <textarea autoFocus value={text} onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setEditing(false)} rows={4}
          className="w-full h-full px-3 py-2 text-xs focus:outline-none resize-none bg-amber-50 leading-snug" />
      ) : (
        <div className="max-h-16 overflow-hidden px-3 py-2 text-xs leading-snug min-h-[36px] hover:bg-black/[0.03] cursor-text">
          {text || <span className="text-black/50">Add synopsis…</span>}
        </div>
      )}
    </td>
  );
}

// ── Notes cell ────────────────────────────────────────────────────────────────

function NotesCell({
  sheet, sheetRef, getOrCreateSheet, applySheet, readOnly,
}: {
  sheet: SheetData | null; sheetRef: React.RefObject<SheetData | null>;
  getOrCreateSheet: () => Promise<string>; applySheet: (s: SheetData | null) => void; readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(sheet?.notes ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (!editing) setText(sheet?.notes ?? ""); }, [sheet?.notes, editing]);

  async function handleChange(val: string) {
    setText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const id = await getOrCreateSheet();
      await updateSheetNotes(id, val);
      const current = sheetRef.current;
      if (current) applySheet({ ...current, notes: val });
    }, 600);
  }

  if (readOnly) {
    return (
      <td className="px-3 py-2 align-top border-l border-black/5 overflow-hidden">
        <div className="max-h-16 overflow-hidden text-xs leading-snug">
          {text || <span className="opacity-40">—</span>}
        </div>
      </td>
    );
  }

  return (
    <td className="px-0 py-0 align-top border-l border-black/5 overflow-hidden" onClick={() => !editing && setEditing(true)}>
      {editing ? (
        <textarea autoFocus value={text} onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setEditing(false)} rows={4}
          className="w-full h-full px-3 py-2 text-xs focus:outline-none resize-none bg-amber-50 leading-snug" />
      ) : (
        <div className="max-h-16 overflow-hidden px-3 py-2 text-xs leading-snug min-h-[36px] hover:bg-black/[0.03] cursor-text">
          {text || <span className="text-black/50">Add notes…</span>}
        </div>
      )}
    </td>
  );
}

// ── Element cell ──────────────────────────────────────────────────────────────

function GridElementCell({
  category, sceneElements, allElements, flags, onAdd, onRemove, readOnly,
}: {
  category: string; sceneElements: SceneElementData[]; allElements: ProductionElement[];
  flags: Map<string, FlagData>; onAdd: (name: string) => Promise<void>;
  onRemove: (sceneElementId: string) => Promise<void>; readOnly: boolean;
}) {
  const { setFocus } = useNotesContext();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const linkedMap = new Map(sceneElements.map((se) => [se.element.id, se.id]));
  const filtered = allElements.filter((el) => !input || el.name.toLowerCase().includes(input.toLowerCase()));
  const typedIsNew = input.trim().length > 0 && !allElements.some((el) => el.name.toLowerCase() === input.trim().toLowerCase());
  const showDropdown = open && (filtered.length > 0 || typedIsNew);

  async function toggle(el: ProductionElement) {
    if (pendingIds.has(el.id)) return;
    setPendingIds((p) => new Set([...p, el.id]));
    try {
      const seId = linkedMap.get(el.id);
      if (seId) await onRemove(seId); else await onAdd(el.name);
    } finally {
      setPendingIds((p) => { const n = new Set(p); n.delete(el.id); return n; });
    }
  }

  async function addNew(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setInput("");
    await onAdd(trimmed);
    inputRef.current?.focus();
  }

  return (
    <td className="px-2 py-1.5 align-top border-l border-black/5 relative overflow-hidden">
      {sceneElements.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mb-1 max-h-16 overflow-hidden">
          {sceneElements.map((se) => {
            const flagged = flags.has(se.id);
            return (
              <span key={se.id} className={`group/chip inline-flex items-center gap-0.5 text-[11px] border px-1.5 py-px whitespace-nowrap ${flagged ? "border-amber-400 bg-amber-50" : "border-black/15 bg-white"}`}>
                <button
                  onClick={(e) => { e.stopPropagation(); setFocus("element", se.element.id, `${se.element.name} (${category})`); }}
                  className="hover:underline underline-offset-2 leading-none"
                  title={`Note on ${se.element.name}`}
                >
                  {se.element.name}
                </button>
                {!readOnly && (
                  <button onClick={(e) => { e.stopPropagation(); onRemove(se.id); }}
                    className="opacity-0 group-hover/chip:opacity-40 hover:!opacity-80 leading-none transition-opacity"
                    aria-label={`Remove ${se.element.name}`}>×</button>
                )}
              </span>
            );
          })}
        </div>
      )}
      {!readOnly && (
        <div className="relative">
          <input ref={inputRef} type="text" value={input}
            placeholder={sceneElements.length === 0 ? "+" : ""}
            onChange={(e) => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => { setOpen(false); setInput(""); }, 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                e.preventDefault();
                if (typedIsNew) addNew(input);
                else if (filtered.length > 0) { toggle(filtered[0]); setInput(""); }
              } else if (e.key === "Escape") { setOpen(false); setInput(""); }
            }}
            className="text-xs border-0 border-b border-black/30 focus:outline-none focus:border-black/60 placeholder:text-black/40 bg-transparent w-5 focus:w-full transition-[width] duration-150"
          />
          {showDropdown && (
            <div className="absolute top-full left-0 z-40 bg-white border border-black/20 shadow-md min-w-[140px] max-h-48 overflow-y-auto"
              onMouseDown={(e) => e.preventDefault()}>
              {filtered.map((el) => {
                const isLinked = linkedMap.has(el.id);
                const isPending = pendingIds.has(el.id);
                return (
                  <button key={el.id} onClick={() => { toggle(el); setInput(""); }} disabled={isPending}
                    className={`w-full text-left text-xs px-2.5 py-1.5 flex items-center gap-2 hover:bg-black/5 ${isPending ? "opacity-30" : ""}`}>
                    <span className="w-3 shrink-0 text-green-600 font-bold">{isLinked ? "✓" : ""}</span>
                    <span className={isLinked ? "opacity-40" : ""}>{el.name}</span>
                  </button>
                );
              })}
              {typedIsNew && (
                <button onClick={() => addNew(input)} className="w-full text-left text-xs px-2.5 py-1.5 hover:bg-black/5 opacity-40 italic flex items-center gap-2">
                  <span className="w-3 shrink-0" />Add &ldquo;{input.trim()}&rdquo;
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </td>
  );
}
