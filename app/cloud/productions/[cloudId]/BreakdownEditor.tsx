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
  scriptId: string | null;
}

export default function BreakdownEditor({
  scenes: initialScenes,
  productionElements: initialElements,
  productionId,
  initialTodos,
  scriptId,
}: Props) {
  const [scenes, setScenes] = useState<SceneData[]>(initialScenes);
  const [elements, setElements] = useState<ProductionElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialScenes[0]?.id ?? null
  );
  const [rightTab, setRightTab] = useState<"todos" | "elements">("todos");
  const [showPdf, setShowPdf] = useState(false);

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

  const editorPane = (
    <main className="flex-1 overflow-y-auto min-w-0">
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
  );

  return (
    <div className="flex h-full overflow-hidden divide-x divide-black/10">
      {/* Scene list */}
      <aside className="w-52 shrink-0 overflow-y-auto">
        <SceneList
          scenes={scenes}
          selectedSceneId={selectedId}
          onSelect={setSelectedId}
        />
      </aside>

      {/* PDF viewer + breakdown editor */}
      {showPdf && scriptId ? (
        <div className="flex flex-1 overflow-hidden divide-x divide-black/10">
          <iframe
            src={`/api/script-pdf?scriptId=${scriptId}`}
            className="flex-1 min-w-0 h-full border-0"
            title="Script PDF"
          />
          {editorPane}
        </div>
      ) : (
        editorPane
      )}

      {/* Right panel — Todos / Elements / Script toggle */}
      <aside className="w-72 shrink-0 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="shrink-0 flex border-b border-black/10">
          {(["todos", "elements"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRightTab(tab)}
              className={`flex-1 text-xs font-bold uppercase tracking-widest py-2.5 transition-colors ${
                rightTab === tab && !showPdf
                  ? "bg-black text-white"
                  : "hover:bg-black/5 opacity-40"
              }`}
            >
              {tab === "todos" ? "To-dos" : "Elements"}
            </button>
          ))}
          {scriptId && (
            <button
              onClick={() => setShowPdf((p) => !p)}
              className={`flex-1 text-xs font-bold uppercase tracking-widest py-2.5 transition-colors ${
                showPdf ? "bg-black text-white" : "hover:bg-black/5 opacity-40"
              }`}
            >
              Script
            </button>
          )}
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
