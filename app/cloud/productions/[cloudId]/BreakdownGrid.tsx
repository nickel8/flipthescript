"use client";

import { useState, useRef, useEffect } from "react";
import type { SceneData, ProductionElement, SheetData, SceneElementData, FlagData } from "./types";
import {
  updateSynopsis,
  addElement,
  removeElement,
  toggleComplete,
  ensureSheet,
} from "./actions";

interface Props {
  scenes: SceneData[];
  productionElements: ProductionElement[];
  categories: string[];
  productionId: string;
  flags: Map<string, FlagData>;
  onCompleteToggle: (sceneId: string, isComplete: boolean) => void;
  onSheetChange: (sceneId: string, sheet: SheetData | null) => void;
  onElementCreated: (el: ProductionElement) => void;
  readOnly?: boolean;
}

export default function BreakdownGrid({
  scenes,
  productionElements,
  categories,
  productionId,
  flags,
  onCompleteToggle,
  onSheetChange,
  onElementCreated,
  readOnly = false,
}: Props) {
  return (
    <div className="overflow-auto h-full w-full">
      <table className="border-collapse text-sm w-full">
        <thead className="sticky top-0 z-20">
          <tr className="border-b border-black/15 bg-white">
            {/* Checkbox */}
            <th className="sticky left-0 z-30 bg-white w-10 px-2 py-2 text-left font-normal border-r border-black/10" />
            {/* Scene # */}
            <th className="sticky left-10 z-30 bg-white w-12 px-2 py-2 text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">#</span>
            </th>
            {/* Location — sticky, fixed width */}
            <th
              className="sticky z-30 bg-white px-3 py-2 text-left border-r border-black/15"
              style={{ left: 88, width: 160, minWidth: 120 }}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">Location</span>
            </th>
            {/* Synopsis — auto width */}
            <th className="px-3 py-2 text-left" style={{ minWidth: 160 }}>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">Synopsis</span>
            </th>
            {/* Category columns — auto width, sized by content */}
            {categories.map((cat) => (
              <th key={cat} className="px-3 py-2 text-left border-l border-black/5" style={{ minWidth: 100 }}>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">{cat}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scenes.map((scene) => (
            <GridRow
              key={scene.id}
              scene={scene}
              categories={categories}
              productionElements={productionElements}
              productionId={productionId}
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
  );
}

// ── Grid row ──────────────────────────────────────────────────────────────────

function GridRow({
  scene,
  categories,
  productionElements,
  productionId,
  flags,
  onCompleteToggle,
  onSheetChange,
  onElementCreated,
  readOnly,
}: {
  scene: SceneData;
  categories: string[];
  productionElements: ProductionElement[];
  productionId: string;
  flags: Map<string, FlagData>;
  onCompleteToggle: (sceneId: string, isComplete: boolean) => void;
  onSheetChange: (sceneId: string, sheet: SheetData | null) => void;
  onElementCreated: (el: ProductionElement) => void;
  readOnly: boolean;
}) {
  const [sheet, setSheet] = useState<SheetData | null>(scene.sheet);
  const sheetRef = useRef<SheetData | null>(scene.sheet);
  const [isComplete, setIsComplete] = useState(scene.is_complete);

  // Keep in sync when parent state changes (e.g. switching back from form view)
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
      className={`border-b border-black/5 hover:bg-black/[0.015] transition-colors ${
        isComplete ? "opacity-40" : ""
      }`}
    >
      {/* Checkbox */}
      <td className="sticky left-0 z-10 bg-white w-10 px-2 border-r border-black/10">
        <input
          type="checkbox"
          checked={isComplete}
          onChange={handleToggleComplete}
          disabled={readOnly}
          className="cursor-pointer disabled:cursor-default"
        />
      </td>

      {/* Scene # + INT/EXT */}
      <td className="sticky left-10 z-10 bg-white w-12 px-2 py-2 align-top">
        <div className="font-mono text-xs font-bold opacity-50 leading-none">{scene.scene_number}</div>
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
        className="sticky z-10 bg-white px-3 py-2 align-top border-r border-black/15 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
        style={{ left: 88, width: 160, minWidth: 120 }}
      >
        <div className="max-h-16 overflow-hidden">
          <div className="text-xs font-medium leading-snug">{scene.location}</div>
          {scene.time_of_day && scene.time_of_day !== "UNSPECIFIED" && (
            <div className="text-[10px] opacity-30 mt-0.5">{scene.time_of_day}</div>
          )}
        </div>
      </td>

      {/* Synopsis */}
      <SynopsisCell
        sceneId={scene.id}
        sheet={sheet}
        sheetRef={sheetRef}
        getOrCreateSheet={getOrCreateSheet}
        applySheet={applySheet}
        readOnly={readOnly}
      />

      {/* Element cells — one per category */}
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
      <td className="px-3 py-2 align-top" style={{ minWidth: 160 }}>
        <div className="max-h-16 overflow-hidden text-xs text-black/50 leading-snug">
          {text || <span className="opacity-30">—</span>}
        </div>
      </td>
    );
  }

  return (
    <td
      className="px-0 py-0 align-top cursor-text"
      style={{ minWidth: 160 }}
      onClick={() => !editing && setEditing(true)}
    >
      {editing ? (
        <textarea
          autoFocus
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setEditing(false)}
          rows={4}
          className="w-full px-3 py-2 text-xs focus:outline-none resize-none bg-amber-50 leading-snug"
        />
      ) : (
        <div className="max-h-16 overflow-hidden px-3 py-2 text-xs text-black/50 leading-snug min-h-[36px] hover:bg-black/[0.03]">
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
    <td
      className="px-2 py-1.5 align-top border-l border-black/5 relative"
      style={{ minWidth: 100 }}
    >
      {/* Chips — wrap freely up to 2× row height */}
      {sceneElements.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mb-1 max-h-16 overflow-hidden">
          {sceneElements.map((se) => {
            const flagged = flags.has(se.id);
            return (
              <span
                key={se.id}
                className={`group/chip inline-flex items-center gap-0.5 text-[11px] border px-1.5 py-px ${
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

      {/* Add input */}
      {!readOnly && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            placeholder={sceneElements.length === 0 ? "+" : ""}
            onChange={(e) => {
              setInput(e.target.value);
              setOpen(true);
            }}
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
            className="text-xs border-0 border-b border-black/10 focus:outline-none focus:border-black/30 placeholder:opacity-25 bg-transparent w-8 focus:w-full transition-[width] duration-150"
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
                    className={`w-full text-left text-xs px-2.5 py-1.5 flex items-center gap-2 hover:bg-black/5 ${
                      isPending ? "opacity-30" : ""
                    }`}
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
