"use client";

import { useState, useEffect, useRef } from "react";
import type { SceneData, ProductionElement, SheetData, SceneElementData } from "./types";
// sheetRef lets async handlers always read the current sheet without stale closures
import {
  updateSynopsis,
  addElement,
  removeElement,
  toggleComplete,
  ensureSheet,
} from "./actions";

interface Props {
  scene: SceneData;
  productionId: string;
  productionElements: ProductionElement[];
  categories: string[];
  onCompleteToggle: (sceneId: string, isComplete: boolean) => void;
  onElementCreated: (el: ProductionElement) => void;
  onSheetChange: (sheet: SheetData | null) => void;
  readOnly?: boolean;
}

export default function SceneEditor({
  scene,
  productionId,
  productionElements,
  categories,
  onCompleteToggle,
  onElementCreated,
  onSheetChange,
  readOnly = false,
}: Props) {
  const [sheet, setSheet] = useState<SheetData | null>(scene.sheet);
  const [synopsis, setSynopsis] = useState(scene.sheet?.synopsis ?? "");
  const [saving, setSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(scene.is_complete);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref so async handlers always read the latest sheet without stale closures
  const sheetRef = useRef<SheetData | null>(scene.sheet);

  function applySheet(next: SheetData | null) {
    sheetRef.current = next;
    setSheet(next);
    onSheetChange(next);
  }

  useEffect(() => {
    sheetRef.current = scene.sheet;
    setSheet(scene.sheet);
    setSynopsis(scene.sheet?.synopsis ?? "");
    setIsComplete(scene.is_complete);
  }, [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function getOrCreateSheet(): Promise<string> {
    if (sheetRef.current?.id) return sheetRef.current.id;
    const id = await ensureSheet(scene.id);
    const newSheet: SheetData = { id, synopsis: "", notes: "", is_reviewed: false, scene_elements: [] };
    applySheet(newSheet);
    return id;
  }

  function handleSynopsisChange(value: string) {
    setSynopsis(value);
    setSaving(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const id = await getOrCreateSheet();
        await updateSynopsis(id, value);
        // Sync the saved synopsis back to the parent so switching scenes preserves it
        const current = sheetRef.current;
        if (current) onSheetChange({ ...current, synopsis: value });
      } finally {
        setSaving(false);
      }
    }, 600);
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

  async function handleToggleComplete() {
    const next = !isComplete;
    setIsComplete(next);
    onCompleteToggle(scene.id, next);
    await toggleComplete(scene.id, next);
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs opacity-30 font-bold">{scene.scene_number}</span>
            <span
              className={`text-xs font-bold px-1.5 py-0.5 ${
                scene.int_ext === "EXT"
                  ? "bg-green-100 text-green-700"
                  : scene.int_ext === "INT/EXT"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {scene.int_ext || "INT"}
            </span>
            {scene.page_start > 0 && (
              <span className="text-xs opacity-30">p.{scene.page_start}</span>
            )}
          </div>
          <h2 className="text-lg font-bold leading-tight">{scene.location}</h2>
          {scene.time_of_day && scene.time_of_day !== "UNSPECIFIED" && (
            <p className="text-xs opacity-40 mt-0.5">{scene.time_of_day}</p>
          )}
        </div>
        {!readOnly && (
          <button
            onClick={handleToggleComplete}
            className={`shrink-0 text-xs font-bold uppercase tracking-widest px-3 py-1 border transition-colors ${
              isComplete
                ? "border-green-600 text-green-700 bg-green-50 hover:bg-white"
                : "border-black/25 hover:border-black"
            }`}
          >
            {isComplete ? "✓ Complete" : "Mark complete"}
          </button>
        )}
        {readOnly && isComplete && (
          <span className="shrink-0 text-xs font-bold uppercase tracking-widest px-3 py-1 border border-green-600 text-green-700 bg-green-50">
            ✓ Complete
          </span>
        )}
      </div>

      {/* Synopsis */}
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-1">
          Synopsis
          {saving && (
            <span className="font-normal normal-case tracking-normal opacity-60 ml-2">
              saving…
            </span>
          )}
        </p>
        {readOnly ? (
          <p className="text-sm leading-relaxed text-black/70 min-h-[3rem]">
            {synopsis || <span className="opacity-30 italic">No synopsis</span>}
          </p>
        ) : (
          <textarea
            value={synopsis}
            onChange={(e) => handleSynopsisChange(e.target.value)}
            rows={2}
            placeholder="What happens in this scene…"
            className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:border-black/50 resize-none leading-relaxed"
          />
        )}
      </div>

      {/* Categories — 2-column grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {categories.map((cat) => (
          <CategorySection
            key={cat}
            category={cat}
            sceneElements={(sheet?.scene_elements ?? []).filter((se) => se.element.category === cat)}
            allElements={productionElements.filter((el) => el.category === cat)}
            onAdd={(name) => handleAddElement(cat, name)}
            onRemove={handleRemoveElement}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({
  category,
  sceneElements,
  allElements,
  onAdd,
  onRemove,
  readOnly = false,
}: {
  category: string;
  sceneElements: SceneElementData[];
  allElements: ProductionElement[];
  onAdd: (name: string) => Promise<void>;
  onRemove: (sceneElementId: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Map element id → scene_element id for quick linked-state lookup
  const linkedMap = new Map(sceneElements.map((se) => [se.element.id, se.id]));

  const filtered = allElements.filter(
    (el) => input.length === 0 || el.name.toLowerCase().includes(input.toLowerCase())
  );

  // True when the typed text doesn't match any element in the master list
  const typedIsNew =
    input.trim().length > 0 &&
    !allElements.some((el) => el.name.toLowerCase() === input.trim().toLowerCase());

  const showList = open && (filtered.length > 0 || typedIsNew);

  async function toggle(el: ProductionElement) {
    if (pendingIds.has(el.id)) return;
    setPendingIds((p) => new Set([...p, el.id]));
    try {
      const sceneElementId = linkedMap.get(el.id);
      if (sceneElementId) {
        await onRemove(sceneElementId);
      } else {
        await onAdd(el.name);
      }
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
    <div>
      <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-1">{category}</p>

      {sceneElements.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {sceneElements.map((se) => (
            <span
              key={se.id}
              className="group inline-flex items-center gap-0.5 text-xs border border-black/20 px-1.5 py-0"
            >
              {se.element.name}
              {!readOnly && (
                <button
                  onClick={() => onRemove(se.id)}
                  className="opacity-0 group-hover:opacity-40 hover:!opacity-80 leading-none transition-opacity"
                  aria-label={`Remove ${se.element.name}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!readOnly && (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          placeholder={`Add ${category.toLowerCase()}…`}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              if (typedIsNew) {
                addNew(input);
              } else if (filtered.length > 0) {
                toggle(filtered[0]);
                setInput("");
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              setInput("");
            }
          }}
          className="w-full text-xs border border-black/15 px-2 py-1 focus:outline-none focus:border-black/40 placeholder:opacity-25"
        />

        {showList && (
          <div
            className="absolute top-full left-0 right-0 z-20 bg-white border border-black/20 border-t-0 max-h-52 overflow-y-auto shadow-sm"
            onMouseDown={(e) => e.preventDefault()} // keep input focused for multi-select
          >
            {filtered.map((el) => {
              const isLinked = linkedMap.has(el.id);
              const isPending = pendingIds.has(el.id);
              return (
                <button
                  key={el.id}
                  onClick={() => toggle(el)}
                  disabled={isPending}
                  className={`w-full text-left text-xs px-2.5 py-1.5 flex items-center gap-2 hover:bg-black/5 transition-opacity ${isPending ? "opacity-30" : ""}`}
                >
                  <span className="w-3.5 shrink-0 text-green-600 font-bold">
                    {isLinked ? "✓" : ""}
                  </span>
                  <span className={isLinked ? "opacity-50" : ""}>{el.name}</span>
                </button>
              );
            })}
            {typedIsNew && (
              <button
                onClick={() => addNew(input)}
                className="w-full text-left text-xs px-2.5 py-1.5 hover:bg-black/5 opacity-40 italic flex items-center gap-2"
              >
                <span className="w-3.5 shrink-0" />
                Add &ldquo;{input.trim()}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
