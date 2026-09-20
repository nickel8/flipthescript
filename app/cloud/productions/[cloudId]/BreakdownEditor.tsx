"use client";

import { useState, useCallback } from "react";
import type { SceneData, ProductionElement, TodoData, SheetData } from "./types";
import SceneList from "./SceneList";
import SceneEditor from "./SceneEditor";
import TodoSection from "./TodoSection";
import ElementsPanel from "./ElementsPanel";

interface Props {
  scenes: SceneData[];
  productionElements: ProductionElement[];
  productionId: string;
  initialTodos: TodoData[];
}

export default function BreakdownEditor({
  scenes: initialScenes,
  productionElements: initialElements,
  productionId,
  initialTodos,
}: Props) {
  const [scenes, setScenes] = useState<SceneData[]>(initialScenes);
  const [elements, setElements] = useState<ProductionElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialScenes[0]?.id ?? null
  );
  const [rightTab, setRightTab] = useState<"todos" | "elements">("todos");

  const selectedScene = scenes.find((s) => s.id === selectedId) ?? null;

  const handleCompleteToggle = useCallback((sceneId: string, isComplete: boolean) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, is_complete: isComplete } : s))
    );
  }, []);

  const handleSheetChange = useCallback((sceneId: string, sheet: SheetData | null) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, sheet } : s))
    );
  }, []);

  const handleElementCreated = useCallback((el: ProductionElement) => {
    setElements((prev) => (prev.some((e) => e.id === el.id) ? prev : [...prev, el]));
  }, []);

  const sceneRefs = scenes.map((s) => ({
    cloudId: s.cloud_id,
    sceneNumber: s.scene_number,
    slugLine: s.slug_line,
  }));

  return (
    <div className="flex h-full overflow-hidden divide-x divide-black/10">
      {/* Scene list */}
      <aside className="w-60 shrink-0 overflow-y-auto border-r border-black/10">
        <SceneList
          scenes={scenes}
          selectedSceneId={selectedId}
          onSelect={setSelectedId}
        />
      </aside>

      {/* Breakdown editor */}
      <main className="flex-1 overflow-y-auto">
        {selectedScene ? (
          <SceneEditor
            key={selectedScene.id}
            scene={selectedScene}
            productionId={productionId}
            productionElements={elements}
            onCompleteToggle={handleCompleteToggle}
            onElementCreated={handleElementCreated}
            onSheetChange={(sheet) => handleSheetChange(selectedScene.id, sheet)}
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-64 text-sm opacity-25">
            Select a scene to begin
          </div>
        )}
      </main>

      {/* Right panel — Todos / Elements */}
      <aside className="w-72 shrink-0 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="shrink-0 flex border-b border-black/10">
          {(["todos", "elements"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRightTab(tab)}
              className={`flex-1 text-xs font-bold uppercase tracking-widest py-2.5 transition-colors ${
                rightTab === tab
                  ? "bg-black text-white"
                  : "hover:bg-black/5 opacity-40"
              }`}
            >
              {tab === "todos" ? "To-dos" : "Elements"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {rightTab === "todos" ? (
            <div className="p-6">
              <TodoSection
                productionId={productionId}
                initialTodos={initialTodos}
                scenes={sceneRefs}
                selectedSceneCloudId={selectedScene?.cloud_id ?? null}
              />
            </div>
          ) : (
            <ElementsPanel scene={selectedScene} />
          )}
        </div>
      </aside>
    </div>
  );
}
