"use client";

import { useState } from "react";
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

  const currentNames = new Set(categories.map((c) => c.name));
  const available = library.filter((l) => !currentNames.has(l.name));

  async function addCategory(cat: CategoryData) {
    if (busy) return;
    setBusy(cat.name);
    try {
      const res = await fetch("/api/production-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, name: cat.name }),
      });
      if (res.ok) {
        const updated = [...categories, cat].sort(
          (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)
        );
        onCategoriesChange(updated);
      }
    } finally {
      setBusy(null);
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

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-2">
          Active categories
        </p>
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
      </div>

      {available.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-2">
            Add from library
          </p>
          <div className="flex flex-col gap-1">
            {available.map((cat) => (
              <button
                key={cat.name}
                onClick={() => addCategory(cat)}
                disabled={busy === cat.name}
                className="text-left text-sm py-1 border-b border-black/5 last:border-0 opacity-40 hover:opacity-80 transition-opacity disabled:opacity-20 flex items-center gap-1.5"
              >
                <span className="text-xs leading-none">+</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
