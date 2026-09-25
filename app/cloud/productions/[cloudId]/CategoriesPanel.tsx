"use client";

import { useState, useRef } from "react";
import type { CategoryData } from "./types";

interface Props {
  productionId: string;
  categories: CategoryData[];
  library: CategoryData[];
  onCategoriesChange: (cats: CategoryData[]) => void;
}

export default function CategoriesPanel({
  productionId,
  categories,
  library,
  onCategoriesChange,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentNames = new Set(categories.map((c) => c.name));

  async function addCategory(name: string, display_order = 999) {
    const trimmed = name.trim();
    if (!trimmed || busy || currentNames.has(trimmed)) return;
    setBusy(trimmed);
    setInput("");
    setOpen(false);
    try {
      const res = await fetch("/api/production-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, name: trimmed }),
      });
      if (res.ok) {
        const cat: CategoryData = { name: trimmed, display_order };
        const updated = [...categories, cat].sort(
          (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
        );
        onCategoriesChange(updated);
      }
    } finally {
      setBusy(null);
      inputRef.current?.focus();
    }
  }

  async function removeCategory(name: string) {
    if (busy) return;
    setBusy(name);
    try {
      const res = await fetch("/api/production-categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, name }),
      });
      if (res.ok) {
        onCategoriesChange(categories.filter((c) => c.name !== name));
      }
    } finally {
      setBusy(null);
    }
  }

  // Library suggestions: not already active, matching input
  const suggestions = library.filter(
    (l) =>
      !currentNames.has(l.name) &&
      (input.length === 0 || l.name.toLowerCase().includes(input.toLowerCase()))
  );

  const typedIsNew =
    input.trim().length > 0 &&
    !library.some((l) => l.name.toLowerCase() === input.trim().toLowerCase()) &&
    !currentNames.has(input.trim());

  const showDropdown = open && (suggestions.length > 0 || typedIsNew);

  return (
    <div className="p-4 space-y-5">
      {/* Active categories */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-2">
          Active categories
        </p>
        {categories.length === 0 ? (
          <p className="text-xs opacity-25 italic">None yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {categories.map((cat) => (
              <div
                key={cat.name}
                className="group flex items-center justify-between text-sm py-1 border-b border-black/5 last:border-0"
              >
                <span>{cat.name}</span>
                <button
                  onClick={() => removeCategory(cat.name)}
                  disabled={busy === cat.name}
                  className="opacity-0 group-hover:opacity-30 hover:!opacity-70 text-xs transition-opacity disabled:opacity-20"
                  aria-label={`Remove ${cat.name}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add category — free text + library suggestions */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-2">
          Add category
        </p>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            placeholder="Type a category name…"
            onChange={(e) => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                e.preventDefault();
                const match = suggestions.find(
                  (s) => s.name.toLowerCase() === input.trim().toLowerCase()
                );
                if (match) addCategory(match.name, match.display_order);
                else if (typedIsNew) addCategory(input);
              } else if (e.key === "Escape") {
                setOpen(false);
                setInput("");
              }
            }}
            className="w-full text-xs border border-black/20 px-2 py-1.5 focus:outline-none focus:border-black/50 placeholder:opacity-25"
          />
          {showDropdown && (
            <div
              className="absolute top-full left-0 right-0 z-20 bg-white border border-black/20 border-t-0 max-h-48 overflow-y-auto shadow-sm"
              onMouseDown={(e) => e.preventDefault()}
            >
              {suggestions.map((s) => (
                <button
                  key={s.name}
                  onClick={() => addCategory(s.name, s.display_order)}
                  className="w-full text-left text-xs px-2.5 py-1.5 hover:bg-black/5 transition-colors"
                >
                  {s.name}
                </button>
              ))}
              {typedIsNew && (
                <button
                  onClick={() => addCategory(input)}
                  className="w-full text-left text-xs px-2.5 py-1.5 hover:bg-black/5 opacity-50 italic"
                >
                  Add &ldquo;{input.trim()}&rdquo;
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
