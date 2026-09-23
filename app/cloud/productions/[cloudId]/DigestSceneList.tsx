"use client";

import { useState } from "react";

interface DigestScene {
  id: string;
  scene_number: string;
  int_ext: string;
  location: string;
  time_of_day: string;
  is_complete: boolean;
  shoot_day: number;
  elements: { name: string; category: string }[];
}

interface Props {
  scenes: DigestScene[];
  shootDates: Record<number, string | null>;
  cloudId: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function groupByCategory(elements: { name: string; category: string }[]) {
  const map = new Map<string, string[]>();
  for (const el of elements) {
    if (!map.has(el.category)) map.set(el.category, []);
    map.get(el.category)!.push(el.name);
  }
  return map;
}

export default function DigestSceneList({ scenes, shootDates, cloudId }: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Group by shoot day
  const grouped = new Map<number, DigestScene[]>();
  for (const scene of scenes) {
    const day = scene.shoot_day ?? 0;
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(scene);
  }
  const sortedDays = [...grouped.keys()].sort((a, b) => {
    if (a === 0) return 1;
    if (b === 0) return -1;
    return a - b;
  });

  return (
    <div className="divide-y divide-black/10">
      {sortedDays.map((day) => {
        const dayScenes = grouped.get(day)!;
        const shootDate = day > 0 ? (shootDates[day] ?? null) : null;
        const complete = dayScenes.filter((s) => s.is_complete).length;

        return (
          <div key={day} className="py-3">
            {/* Day header */}
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-xs font-bold uppercase tracking-widest">
                {day === 0 ? "Unscheduled" : `Day ${day}`}
              </span>
              {shootDate && (
                <span className="text-xs opacity-40">{formatDate(shootDate)}</span>
              )}
              <span className="ml-auto text-xs opacity-30">
                {complete}/{dayScenes.length} complete
              </span>
            </div>

            {/* Scene rows */}
            <div>
              {dayScenes.map((scene) => {
                const isOpen = openIds.has(scene.id);
                const byCategory = groupByCategory(scene.elements);
                const cats = [...byCategory.keys()];

                return (
                  <div key={scene.id} className="border-t border-black/5 first:border-0">
                    {/* Row */}
                    <button
                      onClick={() => toggle(scene.id)}
                      className="w-full flex items-center gap-3 py-2 hover:bg-black/3 transition-colors -mx-1 px-1 text-left"
                    >
                      <span className="text-xs font-mono opacity-30 w-7 shrink-0 tabular-nums">
                        {scene.scene_number}
                      </span>
                      <span
                        className={`text-xs font-bold px-1 py-0.5 shrink-0 ${
                          scene.int_ext === "EXT"
                            ? "bg-green-100 text-green-700"
                            : scene.int_ext === "INT/EXT"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {scene.int_ext || "INT"}
                      </span>
                      <span className="text-sm flex-1 truncate">
                        {scene.location}
                        {scene.time_of_day && scene.time_of_day !== "UNSPECIFIED" && (
                          <span className="opacity-40 ml-1.5 text-xs">{scene.time_of_day}</span>
                        )}
                      </span>
                      {scene.elements.length > 0 && !isOpen && (
                        <span className="text-xs opacity-30 shrink-0">
                          {scene.elements.length} element{scene.elements.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {scene.is_complete && (
                        <span className="text-xs text-green-600 font-bold shrink-0">✓</span>
                      )}
                      <span className="text-xs opacity-25 shrink-0 w-3">
                        {isOpen ? "▾" : "▸"}
                      </span>
                    </button>

                    {/* Expanded elements */}
                    {isOpen && (
                      <div className="ml-10 mb-2 pb-2">
                        {cats.length === 0 ? (
                          <p className="text-xs opacity-30 italic py-1">No elements logged.</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 pt-1">
                            {cats.map((cat) => (
                              <div key={cat}>
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-0.5">
                                  {cat}
                                </p>
                                <ul className="space-y-0.5">
                                  {byCategory.get(cat)!.map((name) => (
                                    <li key={name} className="text-xs">
                                      {name}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                        <a
                          href={`/cloud/productions/${cloudId}/breakdown`}
                          className="inline-block mt-2 text-[10px] uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity"
                        >
                          Open in breakdown →
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
