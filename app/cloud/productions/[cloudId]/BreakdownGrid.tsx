"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { SceneData, ProductionElement, SheetData, SceneElementData, FlagData, CategoryData } from "./types";
import { updateSynopsis, addElement, removeElement, toggleComplete, ensureSheet } from "./actions";
import { compareSceneNumbers } from "@/lib/sort-scenes";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColumnFilter {
  text?: string;
  intExt?: string[];                      // subset of INT/EXT values; undefined = all
  status?: "complete" | "incomplete";     // undefined = all
  presence?: "any" | "empty";             // category columns only
}

interface GridView {
  id: string;
  name: string;
  visibleCols: string[];
  filters: Record<string, ColumnFilter>;
  sort: { col: string | null; dir: "asc" | "desc" };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isFilterActive(f: ColumnFilter | undefined): boolean {
  if (!f) return false;
  return !!(f.text || f.intExt?.length || f.status || f.presence);
}

function activeFilterCount(filters: Record<string, ColumnFilter>): number {
  return Object.values(filters).filter(isFilterActive).length;
}

const VIEWS_KEY = (id: string) => `fts:views:${id}`;

function loadViews(productionId: string): GridView[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY(productionId)) ?? "[]"); }
  catch { return []; }
}

function persistViews(productionId: string, views: GridView[]) {
  try { localStorage.setItem(VIEWS_KEY(productionId), JSON.stringify(views)); } catch {}
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
      if (f.presence) {
        const n = (s.sheet?.scene_elements ?? []).filter((se) => se.element.category === col).length;
        if (f.presence === "any" && n === 0) return false;
        if (f.presence === "empty" && n > 0) return false;
      }
    }
    return true;
  });
}

function applySort(scenes: SceneData[], sort: { col: string | null; dir: "asc" | "desc" }): SceneData[] {
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
  const w: Record<string, number> = { location: 160, synopsis: 200 };
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

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => defaultWidths(catNames));
  const colWidthsRef = useRef(colWidths);
  useEffect(() => { colWidthsRef.current = colWidths; }, [colWidths]);

  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => new Set(["synopsis", ...catNames]));
  const [sort, setSort] = useState<{ col: string | null; dir: "asc" | "desc" }>({ col: null, dir: "asc" });
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({});
  const [views, setViews] = useState<GridView[]>(() => loadViews(productionId));
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { persistViews(productionId, views); }, [views, productionId]);

  // Auto-show new categories
  useEffect(() => {
    setVisibleCols((prev) => {
      const added = catNames.filter((c) => !prev.has(c));
      if (!added.length) return prev;
      return new Set([...prev, ...added]);
    });
    setColWidths((prev) => {
      const extra: Record<string, number> = {};
      for (const c of catNames) if (!(c in prev)) extra[c] = 140;
      return Object.keys(extra).length ? { ...prev, ...extra } : prev;
    });
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!colPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setColPickerOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [colPickerOpen]);

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
  }

  function toggleIntExt(val: string) {
    const current = columnFilters["int_ext"]?.intExt ?? [];
    const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
    if (!next.length) clearFilter("int_ext");
    else setFilter("int_ext", { intExt: next });
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

  function saveView(name: string) {
    const view: GridView = {
      id: randomId(),
      name,
      visibleCols: [...visibleCols],
      filters: columnFilters,
      sort,
    };
    setViews((prev) => [...prev, view]);
    setActiveViewId(view.id);
  }

  function deleteView(id: string) {
    setViews((prev) => prev.filter((v) => v.id !== id));
    if (activeViewId === id) setActiveViewId(null);
  }

  const filterCount = activeFilterCount(columnFilters);
  const showSynopsis = visibleCols.has("synopsis");
  const visibleCatCols = catNames.filter((c) => visibleCols.has(c));

  const processedScenes = useMemo(
    () => applySort(applyFilters(scenes, columnFilters), sort),
    [scenes, columnFilters, sort]
  );

  const sortDir = (col: string) => (sort.col === col ? sort.dir : undefined);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-black/10 min-h-[34px]">
        {activeViewId && (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-black text-white px-2 py-0.5">
            {views.find((v) => v.id === activeViewId)?.name}
            <button onClick={() => applyView(null)} className="opacity-50 hover:opacity-100 leading-none">×</button>
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
            onClick={() => setColPickerOpen((p) => !p)}
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
              onDeleteView={deleteView}
              productionId={productionId}
              onCategoryCreate={onCategoryCreate}
              readOnly={readOnly}
            />
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-auto select-none">
        <table className="border-collapse text-sm" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: COL_CHECK }} />
            <col style={{ width: COL_SCENE }} />
            <col style={{ width: colWidths.location }} />
            {showSynopsis && <col style={{ width: colWidths.synopsis }} />}
            {visibleCatCols.map((cat) => (
              <col key={cat} style={{ width: colWidths[cat] ?? 140 }} />
            ))}
          </colgroup>

          <thead className="sticky top-0 z-20">
            {/* ── Column header row ── */}
            <tr className="border-b border-black/10 bg-white">
              <th className="sticky left-0 z-30 bg-white px-2 py-1.5 text-left font-normal border-r border-black/10">
                <button
                  onClick={() => cycleSort("status")}
                  className="text-[10px] opacity-30 hover:opacity-60 transition-opacity"
                  title="Sort by status"
                >
                  {sort.col === "status" ? (sort.dir === "asc" ? "↑" : "↓") : "○"}
                </button>
              </th>
              <SortableTh
                label="#"
                col="scene_number"
                left={COL_CHECK}
                sticky
                sortDir={sortDir("scene_number")}
                onSort={() => cycleSort("scene_number")}
                onStartResize={startResize}
              />
              <SortableTh
                label="Location"
                col="location"
                left={locationLeft}
                sticky
                borderRight
                shadow
                sortDir={sortDir("location")}
                onSort={() => cycleSort("location")}
                onStartResize={startResize}
              />
              {showSynopsis && (
                <SortableTh
                  label="Synopsis"
                  col="synopsis"
                  sortDir={sortDir("synopsis")}
                  onSort={() => cycleSort("synopsis")}
                  onStartResize={startResize}
                />
              )}
              {visibleCatCols.map((cat) => (
                <SortableTh
                  key={cat}
                  label={cat}
                  col={cat}
                  borderLeft
                  filterActive={isFilterActive(columnFilters[cat])}
                  onStartResize={startResize}
                />
              ))}
            </tr>

            {/* ── Filter row ── */}
            <tr className="border-b border-black/10 bg-black/[0.015]">
              {/* Status filter */}
              <td className="sticky left-0 z-30 bg-white px-1 py-1 border-r border-black/10">
                <div className="flex flex-col gap-px">
                  {(["incomplete", "complete"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() =>
                        setFilter("status", {
                          status: columnFilters["status"]?.status === v ? undefined : v,
                        })
                      }
                      className={`text-[8px] font-bold px-1 py-px transition-colors leading-none ${
                        columnFilters["status"]?.status === v
                          ? "bg-black text-white"
                          : "opacity-25 hover:opacity-60"
                      }`}
                    >
                      {v === "complete" ? "✓" : "○"}
                    </button>
                  ))}
                </div>
              </td>

              {/* Scene # + INT/EXT filter */}
              <td className="sticky z-30 bg-white px-1 py-1" style={{ left: COL_CHECK }}>
                <input
                  type="text"
                  value={columnFilters["scene_number"]?.text ?? ""}
                  onChange={(e) =>
                    setFilter("scene_number", { text: e.target.value || undefined })
                  }
                  placeholder="#"
                  className="w-full text-[10px] bg-transparent border-b border-black/15 focus:outline-none focus:border-black/40 placeholder:opacity-25 mb-0.5 leading-none pb-px"
                />
                <div className="flex gap-px flex-wrap mt-0.5">
                  {(["INT", "EXT", "INT/EXT"] as const).map((val) => {
                    const label = val === "INT/EXT" ? "I/E" : val;
                    const active = columnFilters["int_ext"]?.intExt?.includes(val);
                    return (
                      <button
                        key={val}
                        onClick={() => toggleIntExt(val)}
                        className={`text-[7px] font-bold px-0.5 py-px transition-colors leading-none ${
                          active ? "bg-black text-white" : "opacity-25 hover:opacity-60"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </td>

              {/* Location filter */}
              <td
                className="sticky z-30 bg-white px-2 py-1 border-r border-black/15"
                style={{ left: locationLeft }}
              >
                <input
                  type="text"
                  value={columnFilters["location"]?.text ?? ""}
                  onChange={(e) =>
                    setFilter("location", { text: e.target.value || undefined })
                  }
                  placeholder="Filter…"
                  className="w-full text-[10px] bg-transparent border-b border-black/15 focus:outline-none focus:border-black/40 placeholder:opacity-25"
                />
              </td>

              {/* Synopsis filter */}
              {showSynopsis && (
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={columnFilters["synopsis"]?.text ?? ""}
                    onChange={(e) =>
                      setFilter("synopsis", { text: e.target.value || undefined })
                    }
                    placeholder="Filter…"
                    className="w-full text-[10px] bg-transparent border-b border-black/15 focus:outline-none focus:border-black/40 placeholder:opacity-25"
                  />
                </td>
              )}

              {/* Category filters */}
              {visibleCatCols.map((cat) => {
                const f = columnFilters[cat];
                return (
                  <td key={cat} className="px-2 py-1 border-l border-black/5">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={f?.text ?? ""}
                        onChange={(e) =>
                          setFilter(cat, { text: e.target.value || undefined, presence: undefined })
                        }
                        placeholder="Filter…"
                        className="flex-1 min-w-0 text-[10px] bg-transparent border-b border-black/15 focus:outline-none focus:border-black/40 placeholder:opacity-25"
                      />
                      <button
                        onClick={() =>
                          setFilter(cat, {
                            presence: f?.presence === "empty" ? undefined : "empty",
                            text: undefined,
                          })
                        }
                        title="Show empty only"
                        className={`shrink-0 text-[10px] transition-opacity ${
                          f?.presence === "empty" ? "opacity-80" : "opacity-20 hover:opacity-50"
                        }`}
                      >
                        ∅
                      </button>
                    </div>
                  </td>
                );
              })}
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
    </div>
  );
}

// ── Column picker + views ─────────────────────────────────────────────────────

function ColPicker({
  catNames,
  categoryLibrary,
  visibleCols,
  setVisibleCols,
  views,
  activeViewId,
  onApplyView,
  onSaveView,
  onDeleteView,
  productionId,
  onCategoryCreate,
  readOnly,
}: {
  catNames: string[];
  categoryLibrary: CategoryData[];
  visibleCols: Set<string>;
  setVisibleCols: React.Dispatch<React.SetStateAction<Set<string>>>;
  views: GridView[];
  activeViewId: string | null;
  onApplyView: (view: GridView | null) => void;
  onSaveView: (name: string) => void;
  onDeleteView: (id: string) => void;
  productionId: string;
  onCategoryCreate: (cat: CategoryData) => void;
  readOnly: boolean;
}) {
  const [newCatInput, setNewCatInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [viewName, setViewName] = useState("");

  function toggleCol(col: string) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }

  async function handleAddCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed || catNames.includes(trimmed)) return;
    setAdding(true);
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
      }
    } finally {
      setAdding(false);
    }
  }

  const libSuggestions = categoryLibrary.filter(
    (c) =>
      !catNames.includes(c.name) &&
      (!newCatInput || c.name.toLowerCase().includes(newCatInput.toLowerCase()))
  );

  return (
    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-black/15 shadow-lg w-56 py-1 max-h-[75vh] overflow-y-auto">

      {/* ── Views ── */}
      <div className="px-3 pt-1 pb-0.5 text-[9px] font-bold uppercase tracking-widest opacity-30">Views</div>

      {/* Default */}
      <button
        onClick={() => onApplyView(null)}
        className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5"
      >
        <span className="w-3 shrink-0 font-bold text-black">{!activeViewId ? "●" : ""}</span>
        Default
      </button>

      {views.map((v) => (
        <div key={v.id} className="flex items-center group/view">
          <button
            onClick={() => onApplyView(v)}
            className="flex-1 text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5"
          >
            <span className="w-3 shrink-0 font-bold text-black">{activeViewId === v.id ? "●" : ""}</span>
            <span className="truncate">{v.name}</span>
          </button>
          <button
            onClick={() => onDeleteView(v.id)}
            className="pr-3 text-xs opacity-0 group-hover/view:opacity-30 hover:!opacity-70 transition-opacity"
          >
            ×
          </button>
        </div>
      ))}

      {/* Save current view */}
      <div className="px-3 py-2 mt-0.5">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="Save current as…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && viewName.trim()) {
                onSaveView(viewName.trim());
                setViewName("");
              }
            }}
            className="flex-1 text-[10px] border border-black/15 px-2 py-1 focus:outline-none focus:border-black/40 placeholder:opacity-30"
          />
          <button
            onClick={() => { if (viewName.trim()) { onSaveView(viewName.trim()); setViewName(""); } }}
            disabled={!viewName.trim()}
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-black text-white disabled:opacity-25 hover:opacity-80 transition-opacity shrink-0"
          >
            Save
          </button>
        </div>
      </div>

      <div className="border-t border-black/10 my-1" />

      {/* ── Show / Hide ── */}
      <div className="px-3 pt-0.5 pb-0.5 text-[9px] font-bold uppercase tracking-widest opacity-30">Show / Hide</div>

      <button
        onClick={() => toggleCol("synopsis")}
        className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5"
      >
        <span className="w-3 shrink-0 font-bold text-black">{visibleCols.has("synopsis") ? "✓" : ""}</span>
        Synopsis
      </button>

      {catNames.map((cat) => (
        <button
          key={cat}
          onClick={() => toggleCol(cat)}
          className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5"
        >
          <span className="w-3 shrink-0 font-bold text-black">{visibleCols.has(cat) ? "✓" : ""}</span>
          {cat}
        </button>
      ))}

      {!readOnly && (
        <>
          <div className="border-t border-black/10 my-1" />
          <div className="px-3 pt-0.5 pb-0.5 text-[9px] font-bold uppercase tracking-widest opacity-30">Add column</div>
          <div className="px-3 pb-2">
            <input
              type="text"
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              placeholder="Category name…"
              disabled={adding}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCatInput.trim()) {
                  e.preventDefault();
                  handleAddCategory(newCatInput);
                }
              }}
              className="w-full text-xs border border-black/15 px-2 py-1 focus:outline-none focus:border-black/40 placeholder:opacity-30 disabled:opacity-40"
            />
          </div>
          {libSuggestions.length > 0 && (
            <div className="border-t border-black/5">
              {libSuggestions.slice(0, 6).map((c) => (
                <button
                  key={c.name}
                  onClick={() => handleAddCategory(c.name)}
                  disabled={adding}
                  className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5 opacity-50 hover:opacity-100 disabled:opacity-20"
                >
                  <span className="w-3 opacity-40 shrink-0">+</span>
                  {c.name}
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
  sortDir, filterActive, onSort, onStartResize,
}: {
  label: string; col: string; left?: number;
  sticky?: boolean; borderRight?: boolean; borderLeft?: boolean; shadow?: boolean;
  sortDir?: "asc" | "desc"; filterActive?: boolean;
  onSort?: () => void;
  onStartResize: (col: string, startX: number) => void;
}) {
  return (
    <th
      className={[
        "relative px-3 py-1.5 text-left bg-white font-normal",
        sticky ? "sticky z-30" : "",
        borderRight ? "border-r border-black/15" : "",
        borderLeft ? "border-l border-black/5" : "",
        shadow ? "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]" : "",
      ].join(" ")}
      style={left !== undefined ? { left } : undefined}
    >
      <div className="flex items-center gap-1 pr-2">
        <button
          onClick={onSort}
          className={`flex-1 text-left flex items-center gap-1 ${onSort ? "cursor-pointer hover:opacity-80" : "cursor-default"} transition-opacity`}
        >
          <span className={`text-[10px] font-bold uppercase tracking-widest ${sortDir ? "opacity-70" : "opacity-30"}`}>
            {label}
          </span>
          {sortDir && (
            <span className="text-[10px] opacity-50">{sortDir === "asc" ? "↑" : "↓"}</span>
          )}
        </button>
        {filterActive && <span className="text-[8px] text-blue-500 shrink-0" title="Filter active">●</span>}
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
  productionElements: ProductionElement[]; productionId: string;
  locationLeft: number; flags: Map<string, FlagData>;
  onCompleteToggle: (sceneId: string, isComplete: boolean) => void;
  onSheetChange: (sceneId: string, sheet: SheetData | null) => void;
  onElementCreated: (el: ProductionElement) => void;
  readOnly: boolean;
}) {
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
    const newSE: SceneElementData = {
      id: result.sceneElementId,
      element: { id: result.elementId, name: result.name, category },
    };
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
    <tr className={`border-b border-black/5 transition-colors ${isComplete ? "opacity-40" : "hover:bg-black/[0.015]"}`}>
      <td className="sticky left-0 z-10 bg-white px-2 border-r border-black/10">
        <input
          type="checkbox" checked={isComplete} onChange={handleToggleComplete}
          disabled={readOnly} className="cursor-pointer disabled:cursor-default"
        />
      </td>
      <td className="sticky z-10 bg-white px-2 py-2 align-top" style={{ left: COL_CHECK }}>
        <div className="font-mono text-xs font-bold opacity-50 leading-none truncate">{scene.scene_number}</div>
        <div className={`text-[9px] font-bold mt-1 ${
          scene.int_ext === "EXT" ? "text-green-700" : scene.int_ext === "INT/EXT" ? "text-orange-600" : "text-blue-700"
        }`}>
          {scene.int_ext || "INT"}
        </div>
      </td>
      <td className="sticky z-10 bg-white px-3 py-2 align-top border-r border-black/15 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] overflow-hidden" style={{ left: locationLeft }}>
        <div className="max-h-16 overflow-hidden">
          <div className="text-xs font-medium leading-snug truncate">{scene.location}</div>
          {scene.time_of_day && scene.time_of_day !== "UNSPECIFIED" && (
            <div className="text-[10px] opacity-30 mt-0.5">{scene.time_of_day}</div>
          )}
        </div>
      </td>
      {showSynopsis && (
        <SynopsisCell
          sceneId={scene.id} sheet={sheet} sheetRef={sheetRef}
          getOrCreateSheet={getOrCreateSheet} applySheet={applySheet} readOnly={readOnly}
        />
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
    </tr>
  );
}

// ── Synopsis cell ─────────────────────────────────────────────────────────────

function SynopsisCell({
  sceneId: _sceneId, sheet, sheetRef, getOrCreateSheet, applySheet, readOnly,
}: {
  sceneId: string; sheet: SheetData | null;
  sheetRef: React.RefObject<SheetData | null>;
  getOrCreateSheet: () => Promise<string>;
  applySheet: (sheet: SheetData | null) => void;
  readOnly: boolean;
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
        <div className="max-h-16 overflow-hidden text-xs text-black/50 leading-snug">
          {text || <span className="opacity-30">—</span>}
        </div>
      </td>
    );
  }

  return (
    <td className="px-0 py-0 align-top overflow-hidden" onClick={() => !editing && setEditing(true)}>
      {editing ? (
        <textarea
          autoFocus value={text} onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setEditing(false)} rows={4}
          className="w-full h-full px-3 py-2 text-xs focus:outline-none resize-none bg-amber-50 leading-snug"
        />
      ) : (
        <div className="max-h-16 overflow-hidden px-3 py-2 text-xs text-black/50 leading-snug min-h-[36px] hover:bg-black/[0.03] cursor-text">
          {text || <span className="opacity-25">Add synopsis…</span>}
        </div>
      )}
    </td>
  );
}

// ── Element cell ──────────────────────────────────────────────────────────────

function GridElementCell({
  category: _category, sceneElements, allElements, flags, onAdd, onRemove, readOnly,
}: {
  category: string; sceneElements: SceneElementData[]; allElements: ProductionElement[];
  flags: Map<string, FlagData>;
  onAdd: (name: string) => Promise<void>;
  onRemove: (sceneElementId: string) => Promise<void>;
  readOnly: boolean;
}) {
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
                {se.element.name}
                {!readOnly && (
                  <button
                    onClick={() => onRemove(se.id)}
                    className="opacity-0 group-hover/chip:opacity-40 hover:!opacity-80 leading-none transition-opacity"
                    aria-label={`Remove ${se.element.name}`}
                  >×</button>
                )}
              </span>
            );
          })}
        </div>
      )}
      {!readOnly && (
        <div className="relative">
          <input
            ref={inputRef} type="text" value={input}
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
            className="text-xs border-0 border-b border-black/10 focus:outline-none focus:border-black/30 placeholder:opacity-25 bg-transparent w-5 focus:w-full transition-[width] duration-150"
          />
          {showDropdown && (
            <div className="absolute top-full left-0 z-40 bg-white border border-black/20 shadow-md min-w-[140px] max-h-48 overflow-y-auto" onMouseDown={(e) => e.preventDefault()}>
              {filtered.map((el) => {
                const isLinked = linkedMap.has(el.id);
                const isPending = pendingIds.has(el.id);
                return (
                  <button
                    key={el.id} onClick={() => { toggle(el); setInput(""); }}
                    disabled={isPending}
                    className={`w-full text-left text-xs px-2.5 py-1.5 flex items-center gap-2 hover:bg-black/5 ${isPending ? "opacity-30" : ""}`}
                  >
                    <span className="w-3 shrink-0 text-green-600 font-bold">{isLinked ? "✓" : ""}</span>
                    <span className={isLinked ? "opacity-40" : ""}>{el.name}</span>
                  </button>
                );
              })}
              {typedIsNew && (
                <button onClick={() => addNew(input)} className="w-full text-left text-xs px-2.5 py-1.5 hover:bg-black/5 opacity-40 italic flex items-center gap-2">
                  <span className="w-3 shrink-0" />
                  Add &ldquo;{input.trim()}&rdquo;
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </td>
  );
}
