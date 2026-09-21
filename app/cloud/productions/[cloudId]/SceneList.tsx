"use client";

import { useState } from "react";
import type { SceneData } from "./types";
import ShootView from "./ShootView";

type SortOrder = "story" | "shoot";

interface Props {
  scenes: SceneData[];
  selectedSceneId: string | null;
  productionId: string;
  onSelect: (sceneId: string) => void;
}

export default function SceneList({ scenes, selectedSceneId, productionId, onSelect }: Props) {
  const [sort, setSort] = useState<SortOrder>("story");

  if (scenes.length === 0) {
    return <p className="text-xs opacity-30 p-4">No scenes published yet.</p>;
  }

  const sorted =
    sort === "shoot"
      ? [...scenes].sort((a, b) => {
          if (a.shoot_day !== b.shoot_day) return a.shoot_day - b.shoot_day;
          return a.shoot_order - b.shoot_order;
        })
      : scenes;

  const completeCount = scenes.filter((s) => s.is_complete).length;

  return (
    <div>
      <div className="px-3 pt-3 pb-2 border-b border-black/10 space-y-2">
        <p className="text-xs opacity-30">
          {completeCount}/{scenes.length} complete
        </p>
        <div className="flex border border-black/20 w-fit">
          {(["story", "shoot"] as SortOrder[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setSort(opt)}
              className={`text-xs font-bold uppercase tracking-widest px-2 py-1 transition-colors ${
                sort === opt ? "bg-black text-white" : "hover:bg-black/5"
              }`}
            >
              {opt === "story" ? "Story" : "Shoot"}
            </button>
          ))}
        </div>
      </div>

      {sort === "shoot" ? (
        <ShootView
          scenes={scenes}
          selectedSceneId={selectedSceneId}
          productionId={productionId}
          onSelect={onSelect}
        />
      ) : (
        <ul>
          {sorted.map((scene) => {
            const selected = scene.id === selectedSceneId;
            return (
              <li key={scene.id}>
                <button
                  onClick={() => onSelect(scene.id)}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors ${
                    selected ? "bg-black text-white" : "hover:bg-black/5"
                  }`}
                >
                  <span
                    className={`font-mono text-xs shrink-0 w-7 mt-0.5 tabular-nums ${
                      selected ? "opacity-50" : "opacity-30"
                    }`}
                  >
                    {scene.scene_number}
                  </span>
                  <span className="text-xs leading-snug flex-1 min-w-0 line-clamp-2">
                    {scene.slug_line}
                  </span>
                  {scene.is_complete && (
                    <svg className="shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="6" fill={selected ? "rgba(255,255,255,0.6)" : "#16a34a"} />
                      <path d="M3.5 6l2 2L8.5 4" stroke={selected ? "black" : "white"} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
