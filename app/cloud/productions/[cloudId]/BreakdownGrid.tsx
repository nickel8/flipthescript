"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { SceneData, ProductionElement, SheetData, SceneElementData, FlagData, CategoryData } from "./types";
import {
  updateSynopsis,
  addElement,
  removeElement,
  toggleComplete,
  ensureSheet,
} from "./actions";

// ── Column widths ─────────────────────────────────────────────────────────────

const COL_SCENE = 48;
const COL_CHECK = 40;

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

  const [colWidths, setColWidths] = useState<Record<string, number>>(() =>
    defaultWidths(catNames)
  );
  const colWidthsRef = useRef(colWidths);
  useEffect(() => { colWidthsRef.current = colWidths; }, [colWidths]);

  // When new categories are added, auto-show them and seed their column width
  useEffect(() => {
    setVisibleCols((prev) => {
      const added = catNames.filter((c) => !prev.has(c));
      if (added.length === 0) return prev;
      return new Set([...prev, ...added]);
    });
    setColWidths((prev) => {
      const additions: Record<string, number> = {};
      for (const c of catNames) {
        if (!(c in prev)) additions[c] = 140;
      }
      if (Object.keys(additions).length === 0) return prev;
      return { ...prev, ...additions };
    });
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  // Column visibility — all on by default
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    () => new Set(["synopsis", ...catNames])
  );

  // Filters
  const [search, setSearch] = useState("");
  const [intExtFilter, setIntExtFilter] = useState<"all" | "INT" | "EXT">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "complete" | "incomplete">("all");

  // Column picker
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colPickerOpen) return;
    function onDown(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [colPickerOpen]);

  const locationLeft = COL_CHECK + COL_SCENE;

  const startResize = useCallback((col: string, startX: number) => {
    const startWidth = colWidthsRef.current[col] ?? 120;
    function onMove(e: MouseEvent) {
      const w = Math.max(60, startWidth + e.clientX - startX);
      setColWidths((prev) => ({ ...prev, [col]: w }));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // Filter scenes
  const filteredScenes = scenes.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        s.scene_number.toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q) ||
        (s.slug_line ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    if (intExtFilter !== "all" && s.int_ext !== intExtFilter) return false;
    if (statusFilter === "complete" && !s.is_complete) return false;
    if (statusFilter === "incomplete" && s.is_complete) return false;
    return true;
  });

  const showSynopsis = visibleCols.has("synopsis");
  const visibleCatCols = catNames.filter((c) => visibleCols.has(c));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-black/10 flex-wrap">
        {/* Search */}
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs border border-black/15 px-2 py-1 focus:outline-none focus:border-black/40 w-32 placeholder:opacity-30"
        />

        {/* INT/EXT filter */}
        <div className="flex border border-black/15 text-[10px] font-bold uppercase tracking-widest">
          {(["all", "INT", "EXT"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setIntExtFilter(v)}
              className={`px-2 py-1 transition-colors ${
                intExtFilter === v ? "bg-black text-white" : "opacity-30 hover:opacity-60"
              }`}
            >
              {v === "all" ? "All" : v}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex border border-black/15 text-[10px] font-bold uppercase tracking-widest">
          {([
            { v: "all", label: "All" },
            { v: "incomplete", label: "Todo" },
            { v: "complete", label: "Done" },
          ] as const).map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`px-2 py-1 transition-colors ${
                statusFilter === v ? "bg-black text-white" : "opacity-30 hover:opacity-60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filtered count */}
        {(search || intExtFilter !== "all" || statusFilter !== "all") && (
          <span className="text-[10px] opacity-30 tabular-nums">
            {filteredScenes.length} / {scenes.length}
          </span>
        )}

        {/* Columns picker */}
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
            <tr className="border-b border-black/15 bg-white">
              <th className="sticky left-0 z-30 bg-white px-2 py-2 text-left font-normal border-r border-black/10" />
              <th
                className="sticky z-30 bg-white px-2 py-2 text-left"
                style={{ left: COL_CHECK }}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">#</span>
              </th>
              <ResizableTh
                label="Location"
                col="location"
                left={locationLeft}
                sticky
                borderRight
                shadow
                onStartResize={startResize}
              />
              {showSynopsis && (
                <ResizableTh label="Synopsis" col="synopsis" onStartResize={startResize} />
              )}
              {visibleCatCols.map((cat) => (
                <ResizableTh
                  key={cat}
                  label={cat}
                  col={cat}
                  borderLeft
                  onStartResize={startResize}
                />
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredScenes.map((scene) => (
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

// ── Column picker dropdown ─────────────────────────────────────────────────────

function ColPicker({
  catNames,
  categoryLibrary,
  visibleCols,
  setVisibleCols,
  productionId,
  onCategoryCreate,
  readOnly,
}: {
  catNames: string[];
  categoryLibrary: CategoryData[];
  visibleCols: Set<string>;
  setVisibleCols: React.Dispatch<React.SetStateAction<Set<string>>>;
  productionId: string;
  onCategoryCreate: (cat: CategoryData) => void;
  readOnly: boolean;
}) {
  const [newCatInput, setNewCatInput] = useState("");
  const [adding, setAdding] = useState(false);

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
    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-black/15 shadow-lg min-w-[200px] py-1">
      {/* Fixed columns section */}
      <div className="px-3 pt-1 pb-0.5 text-[9px] font-bold uppercase tracking-widest opacity-30">
        Show / Hide
      </div>

      <button
        onClick={() => toggleCol("synopsis")}
        className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5"
      >
        <span className="w-3 text-black font-bold shrink-0">
          {visibleCols.has("synopsis") ? "✓" : ""}
        </span>
        Synopsis
      </button>

      {catNames.map((cat) => (
        <button
          key={cat}
          onClick={() => toggleCol(cat)}
          className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-black/5"
        >
          <span className="w-3 text-black font-bold shrink-0">
            {visibleCols.has(cat) ? "✓" : ""}
          </span>
          {cat}
        </button>
      ))}

      {!readOnly && (
        <>
          <div className="border-t border-black/10 my-1" />
          <div className="px-3 pt-0.5 pb-1.5 text-[9px] font-bold uppercase tracking-widest opacity-30">
            Add column
          </div>
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

// ── Resizable column header ───────────────────────────────────────────────────

function ResizableTh({
  label,
  col,
  left,
  sticky,
  borderRight,
  borderLeft,
  shadow,
  onStartResize,
}: {
  label: string;
  col: string;
  left?: number;
  sticky?: boolean;
  borderRight?: boolean;
  borderLeft?: boolean;
  shadow?: boolean;
  onStartResize: (col: string, startX: number) => void;
}) {
  return (
    <th
      className={[
        "relative px-3 py-2 text-left bg-white font-normal",
        sticky ? "sticky z-30" : "",
        borderRight ? "border-r border-black/15" : "",
        borderLeft ? "border-l border-black/5" : "",
        shadow ? "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]" : "",
      ].join(" ")}
      style={left !== undefined ? { left } : undefined}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">
        {label}
      </span>
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group"
        onMouseDown={(e) => {
          e.preventDefault();
          onStartResize(col, e.clientX);
        }}
      >
        <div className="absolute right-0 top-1/4 bottom-1/4 w-px bg-black/0 group-hover:bg-black/20 transition-colors" />
      </div>
    </th>
  );
}

// ── Grid row ──────────────────────────────────────────────────────────────────

function GridRow({
  scene,
  categories,
  showSynopsis,
  productionElements,
  productionId,
  locationLeft,
  flags,
  onCompleteToggle,
  onSheetChange,
  onElementCreated,
  readOnly,
}: {
  scene: SceneData;
  categories: string[];
  showSynopsis: boolean;
  productionElements: ProductionElement[];
  productionId: string;
  locationLeft: number;
  flags: Map<string, FlagData>;
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
    applySheet({
      ...current,
      scene_elements: current.scene_elements.filter((se) => se.id !== sceneElementId),
    });
    await removeElement(sceneElementId);
  }

  return (
    <tr
      className={`border-b border-black/5 transition-colors ${
        isComplete ? "opacity-40" : "hover:bg-black/[0.015]"
      }`}
    >
      {/* Checkbox */}
      <td className="sticky left-0 z-10 bg-white px-2 border-r border-black/10">
        <input
          type="checkbox"
          checked={isComplete}
          onChange={handleToggleComplete}
          disabled={readOnly}
          className="cursor-pointer disabled:cursor-default"
        />
      </td>

      {/* Scene # + INT/EXT */}
      <td
        className="sticky z-10 bg-white px-2 py-2 align-top"
        style={{ left: COL_CHECK }}
      >
        <div className="font-mono text-xs font-bold opacity-50 leading-none truncate">
          {scene.scene_number}
        </div>
        <div
          className={`text-[9px] font-bold mt-1 ${
            scene.int_ext === "EXT"
              ? "text-green-700"
              : scene.int_ext === "INT/EXT"
              ? "text-orange-600"
              : "text-blue-700"
          }`}
        >
          {scene.int_ext || "INT"}
        </div>
      </td>

      {/* Location */}
      <td
        className="sticky z-10 bg-white px-3 py-2 align-top border-r border-black/15 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] overflow-hidden"
        style={{ left: locationLeft }}
      >
        <div className="max-h-16 overflow-hidden">
          <div className="text-xs font-medium leading-snug truncate">{scene.location}</div>
          {scene.time_of_day && scene.time_of_day !== "UNSPECIFIED" && (
            <div className="text-[10px] opacity-30 mt-0.5">{scene.time_of_day}</div>
          )}
        </div>
      </td>

      {/* Synopsis */}
      {showSynopsis && (
        <SynopsisCell
          sceneId={scene.id}
          sheet={sheet}
          sheetRef={sheetRef}
          getOrCreateSheet={getOrCreateSheet}
          applySheet={applySheet}
          readOnly={readOnly}
        />
      )}

      {/* Element cells — one per visible category */}
      {categories.map((cat) => (
        <GridElementCell
          key={cat}
          category={cat}
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
  sceneId: _sceneId,
  sheet,
  sheetRef,
  getOrCreateSheet,
  applySheet,
  readOnly,
}: {
  sceneId: string;
  sheet: SheetData | null;
  sheetRef: React.RefObject<SheetData | null>;
  getOrCreateSheet: () => Promise<string>;
  applySheet: (sheet: SheetData | null) => void;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(sheet?.synopsis ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) setText(sheet?.synopsis ?? "");
  }, [sheet?.synopsis, editing]);

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
    <td
      className="px-0 py-0 align-top overflow-hidden"
      onClick={() => !editing && setEditing(true)}
    >
      {editing ? (
        <textarea
          autoFocus
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setEditing(false)}
          rows={4}
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
  category: _category,
  sceneElements,
  allElements,
  flags,
  onAdd,
  onRemove,
  readOnly,
}: {
  category: string;
  sceneElements: SceneElementData[];
  allElements: ProductionElement[];
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
  const filtered = allElements.filter(
    (el) => !input || el.name.toLowerCase().includes(input.toLowerCase())
  );
  const typedIsNew =
    input.trim().length > 0 &&
    !allElements.some((el) => el.name.toLowerCase() === input.trim().toLowerCase());
  const showDropdown = open && (filtered.length > 0 || typedIsNew);

  async function toggle(el: ProductionElement) {
    if (pendingIds.has(el.id)) return;
    setPendingIds((p) => new Set([...p, el.id]));
    try {
      const seId = linkedMap.get(el.id);
      if (seId) await onRemove(seId);
      else await onAdd(el.name);
    } finally {
      setPendingIds((p) => {
        const next = new Set(p);
        next.delete(el.id);
        return next;
      });
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
              <span
                key={se.id}
                className={`group/chip inline-flex items-center gap-0.5 text-[11px] border px-1.5 py-px whitespace-nowrap ${
                  flagged ? "border-amber-400 bg-amber-50" : "border-black/15 bg-white"
                }`}
              >
                {se.element.name}
                {!readOnly && (
                  <button
                    onClick={() => onRemove(se.id)}
                    className="opacity-0 group-hover/chip:opacity-40 hover:!opacity-80 leading-none transition-opacity"
                    aria-label={`Remove ${se.element.name}`}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {!readOnly && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            placeholder={sceneElements.length === 0 ? "+" : ""}
            onChange={(e) => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => { setOpen(false); setInput(""); }, 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                e.preventDefault();
                if (typedIsNew) addNew(input);
                else if (filtered.length > 0) { toggle(filtered[0]); setInput(""); }
              } else if (e.key === "Escape") {
                setOpen(false);
                setInput("");
              }
            }}
            className="text-xs border-0 border-b border-black/10 focus:outline-none focus:border-black/30 placeholder:opacity-25 bg-transparent w-5 focus:w-full transition-[width] duration-150"
          />
          {showDropdown && (
            <div
              className="absolute top-full left-0 z-40 bg-white border border-black/20 shadow-md min-w-[140px] max-h-48 overflow-y-auto"
              onMouseDown={(e) => e.preventDefault()}
            >
              {filtered.map((el) => {
                const isLinked = linkedMap.has(el.id);
                const isPending = pendingIds.has(el.id);
                return (
                  <button
                    key={el.id}
                    onClick={() => { toggle(el); setInput(""); }}
                    disabled={isPending}
                    className={`w-full text-left text-xs px-2.5 py-1.5 flex items-center gap-2 hover:bg-black/5 ${isPending ? "opacity-30" : ""}`}
                  >
                    <span className="w-3 shrink-0 text-green-600 font-bold">{isLinked ? "✓" : ""}</span>
                    <span className={isLinked ? "opacity-40" : ""}>{el.name}</span>
                  </button>
                );
              })}
              {typedIsNew && (
                <button
                  onClick={() => addNew(input)}
                  className="w-full text-left text-xs px-2.5 py-1.5 hover:bg-black/5 opacity-40 italic flex items-center gap-2"
                >
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
