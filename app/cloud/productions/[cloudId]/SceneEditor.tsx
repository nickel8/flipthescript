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

const CATEGORIES = [
  "Characters",
  "Props",
  "Set Dressing",
  "Vehicles",
  "Weapons",
  "Greens",
  "SFX",
  "VFX",
  "Costume",
  "Clearance",
  "Other",
] as const;

interface Props {
  scene: SceneData;
  productionId: string;
  productionElements: ProductionElement[];
  onCompleteToggle: (sceneId: string, isComplete: boolean) => void;
  onElementCreated: (el: ProductionElement) => void;
  onSheetChange: (sheet: SheetData | null) => void;
}

export default function SceneEditor({
  scene,
  productionId,
  productionElements,
  onCompleteToggle,
  onElementCreated,
  onSheetChange,
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

  const existingElementIds = new Set(sheet?.scene_elements.map((se) => se.element.id) ?? []);

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
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
          <h2 className="text-2xl font-bold leading-tight">{scene.location}</h2>
          {scene.time_of_day && scene.time_of_day !== "UNSPECIFIED" && (
            <p className="text-sm opacity-40 mt-1">{scene.time_of_day}</p>
          )}
        </div>
        <button
          onClick={handleToggleComplete}
          className={`shrink-0 text-xs font-bold uppercase tracking-widest px-3 py-1.5 border transition-colors ${
            isComplete
              ? "border-green-600 text-green-700 bg-green-50 hover:bg-white"
              : "border-black/25 hover:border-black"
          }`}
        >
          {isComplete ? "✓ Complete" : "Mark complete"}
        </button>
      </div>

      {/* Synopsis */}
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-2">
          Synopsis
          {saving && (
            <span className="font-normal normal-case tracking-normal opacity-60 ml-2">
              saving…
            </span>
          )}
        </p>
        <textarea
          value={synopsis}
          onChange={(e) => handleSynopsisChange(e.target.value)}
          rows={4}
          placeholder="What happens in this scene…"
          className="w-full border border-black/20 px-3 py-2.5 text-sm focus:outline-none focus:border-black/50 resize-none leading-relaxed"
        />
      </div>

      {/* Categories */}
      <div className="space-y-7">
        {CATEGORIES.map((cat) => (
          <CategorySection
            key={cat}
            category={cat}
            elements={(sheet?.scene_elements ?? []).filter((se) => se.element.category === cat)}
            suggestions={productionElements.filter(
              (el) => el.category === cat && !existingElementIds.has(el.id)
            )}
            onAdd={(name) => handleAddElement(cat, name)}
            onRemove={handleRemoveElement}
          />
        ))}
      </div>
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({
  category,
  elements,
  suggestions,
  onAdd,
  onRemove,
}: {
  category: string;
  elements: SceneElementData[];
  suggestions: ProductionElement[];
  onAdd: (name: string) => Promise<void>;
  onRemove: (sceneElementId: string) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions.filter(
    (s) => input.length === 0 || s.name.toLowerCase().includes(input.toLowerCase())
  );
  const showList = open && (filtered.length > 0 || input.trim().length > 0);
  const typedIsNew = input.trim().length > 0 &&
    !filtered.some((s) => s.name.toLowerCase() === input.trim().toLowerCase());

  async function submit(name: string) {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setInput("");
    setOpen(false);
    try {
      await onAdd(trimmed);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-2">{category}</p>

      {elements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {elements.map((se) => (
            <span
              key={se.id}
              className="group inline-flex items-center gap-1 text-xs border border-black/20 px-2 py-0.5"
            >
              {se.element.name}
              <button
                onClick={() => onRemove(se.id)}
                className="opacity-0 group-hover:opacity-40 hover:!opacity-80 leading-none transition-opacity"
                aria-label={`Remove ${se.element.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          placeholder={`Add ${category.toLowerCase()}…`}
          disabled={busy}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit(filtered[0]?.name ?? input);
            } else if (e.key === "Escape") {
              setOpen(false);
              setInput("");
            }
          }}
          className="w-full text-xs border border-black/15 px-2.5 py-1.5 focus:outline-none focus:border-black/40 placeholder:opacity-25 disabled:opacity-40"
        />

        {showList && (
          <div className="absolute top-full left-0 right-0 z-20 bg-white border border-black/20 border-t-0 max-h-44 overflow-y-auto shadow-sm">
            {filtered.slice(0, 8).map((s) => (
              <button
                key={s.id}
                onMouseDown={() => submit(s.name)}
                className="w-full text-left text-xs px-2.5 py-1.5 hover:bg-black/5"
              >
                {s.name}
              </button>
            ))}
            {typedIsNew && (
              <button
                onMouseDown={() => submit(input)}
                className="w-full text-left text-xs px-2.5 py-1.5 hover:bg-black/5 opacity-40 italic"
              >
                Add &ldquo;{input.trim()}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
