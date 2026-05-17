"use client";

import { useState } from "react";

export interface SceneElement {
  name: string;
  category: string;
  notes: string;
}

export interface Scene {
  id: string;
  cloud_id: string;
  scene_number: string;
  slug_line: string;
  shoot_day: number;
  shoot_order: number;
  is_complete: boolean;
  synopsis: string | null;
  notes: string | null;
  elements: SceneElement[];
}

type SortOrder = "story" | "shoot";

export default function SceneList({ scenes }: { scenes: Scene[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOrder>("story");

  if (scenes.length === 0) {
    return <p className="text-sm opacity-40">No scenes published yet.</p>;
  }

  const hasShootOrder = scenes.some(s => s.shoot_day > 0);

  const sorted = sort === "shoot"
    ? [...scenes].sort((a, b) => {
        if (a.shoot_day !== b.shoot_day) return a.shoot_day - b.shoot_day;
        return a.shoot_order - b.shoot_order;
      })
    : scenes; // already in story order from the query

  return (
    <div>
      {hasShootOrder && (
        <div className="flex gap-0 mb-4 border border-black/20 w-fit">
          {(["story", "shoot"] as SortOrder[]).map(opt => (
            <button
              key={opt}
              onClick={() => setSort(opt)}
              className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 transition-colors ${
                sort === opt ? "bg-black text-white" : "hover:bg-black/5"
              }`}
            >
              {opt === "story" ? "Story order" : "Shoot order"}
            </button>
          ))}
        </div>
      )}
    <ul className="divide-y divide-black/10 border border-black/10">
      {sorted.map(scene => {
        const isOpen = openId === scene.id;
        const hasDetail = scene.synopsis || scene.notes || scene.elements.length > 0;

        // Group elements by category
        const byCategory: Record<string, SceneElement[]> = {};
        for (const el of scene.elements) {
          (byCategory[el.category] ??= []).push(el);
        }
        const categories = Object.keys(byCategory).sort();

        return (
          <li key={scene.id}>
            <button
              onClick={() => hasDetail && setOpenId(isOpen ? null : scene.id)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                hasDetail ? "hover:bg-black/5 cursor-pointer" : "cursor-default"
              }`}
            >
              <span className="text-xs font-bold mt-0.5 shrink-0 w-8 tabular-nums">
                {scene.scene_number}
              </span>
              <div className="flex-1 min-w-0 flex items-start gap-2">
                <span className="text-sm font-bold leading-snug">{scene.slug_line}</span>
                {sort === "shoot" && scene.shoot_day > 0 && (
                  <span className="text-xs opacity-30 shrink-0 mt-0.5">Day {scene.shoot_day}</span>
                )}
                {scene.is_complete && (
                  <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="7" fill="#16a34a"/>
                    <path d="M4 7l2.5 2.5L10 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              {hasDetail && (
                <svg
                  className={`shrink-0 mt-1 opacity-30 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 ml-11 flex flex-col gap-4">
                {scene.synopsis && (
                  <p className="text-sm opacity-60 leading-relaxed">{scene.synopsis}</p>
                )}

                {categories.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {categories.map(cat => (
                      <div key={cat}>
                        <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-1.5">
                          {cat}
                        </p>
                        <ul className="flex flex-wrap gap-1.5">
                          {byCategory[cat].map((el, i) => (
                            <li
                              key={i}
                              title={el.notes || undefined}
                              className="text-xs border border-black/20 px-2 py-0.5 leading-snug"
                            >
                              {el.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {scene.notes && (
                  <p className="text-xs opacity-40 italic leading-relaxed border-t border-black/10 pt-3">
                    {scene.notes}
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
    </div>
  );
}
