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
  const [showSceneList, setShowSceneList] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

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
    <div className="flex h-full overflow-hidden">
      {/* ── Scene list (collapsible) ── */}
      <aside
        className={`${showSceneList ? "w-48" : "w-7"} shrink-0 flex flex-col border-r border-black/10 transition-[width] duration-200 overflow-hidden`}
      >
        <button
          onClick={() => setShowSceneList((p) => !p)}
          title={showSceneList ? "Collapse scenes" : "Expand scenes"}
          className="shrink-0 h-7 flex items-center justify-center border-b border-black/10 text-xs opacity-25 hover:opacity-60 transition-opacity"
        >
          {showSceneList ? "←" : "→"}
        </button>
        {showSceneList && (
          <div className="flex-1 overflow-y-auto">
            <SceneList
              scenes={scenes}
              selectedSceneId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        )}
      </aside>

      {/* ── PDF viewer + breakdown editor ── */}
      {showPdf && scriptId ? (
        <div className="flex flex-1 overflow-hidden border-r border-black/10">
          <iframe
            src={`/api/script-pdf?scriptId=${scriptId}`}
            className="flex-1 min-w-0 h-full border-0 border-r border-black/10"
            title="Script PDF"
          />
          {editorPane}
        </div>
      ) : (
        <div className="flex-1 border-r border-black/10 overflow-hidden flex">
          {editorPane}
        </div>
      )}

      {/* ── Right panel (collapsible) ── */}
      <aside
        className={`${showRightPanel ? "w-72" : "w-7"} shrink-0 flex flex-col transition-[width] duration-200 overflow-hidden`}
      >
        {showRightPanel ? (
          <>
            {/* Tab bar + collapse button */}
            <div className="shrink-0 flex border-b border-black/10">
              <button
                onClick={() => setShowRightPanel(false)}
                title="Collapse panel"
                className="w-7 shrink-0 flex items-center justify-center text-xs opacity-25 hover:opacity-60 transition-opacity border-r border-black/10"
              >
                →
              </button>
              {(["todos", "elements"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className={`flex-1 text-xs font-bold uppercase tracking-widest py-2 transition-colors ${
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
                  className={`flex-1 text-xs font-bold uppercase tracking-widest py-2 transition-colors ${
                    showPdf ? "bg-black text-white" : "hover:bg-black/5 opacity-40"
                  }`}
                >
                  Script
                </button>
              )}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">
              {rightTab === "todos" ? (
                <div className="p-4">
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
          </>
        ) : (
          /* Collapsed strip */
          <div className="flex flex-col items-center pt-1 gap-2">
            <button
              onClick={() => setShowRightPanel(true)}
              title="Expand panel"
              className="h-7 w-7 flex items-center justify-center text-xs opacity-25 hover:opacity-60 transition-opacity border-b border-black/10"
            >
              ←
            </button>
            {scriptId && (
              <button
                onClick={() => setShowPdf((p) => !p)}
                title={showPdf ? "Hide script" : "Show script"}
                className={`text-xs font-bold uppercase py-1 transition-opacity ${showPdf ? "opacity-100" : "opacity-25 hover:opacity-60"}`}
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                Script
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
