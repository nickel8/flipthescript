"use client";

import { useState, useCallback, useEffect } from "react";
import type { SceneData, ProductionElement, SheetData, ShootDayData, CategoryData, FlagData } from "./types";
import SceneList from "./SceneList";
import SceneEditor from "./SceneEditor";
import CategoriesPanel from "./CategoriesPanel";

interface Props {
  scenes: SceneData[];
  productionElements: ProductionElement[];
  productionId: string;
  scriptId: string | null;
  initialShootDays: ShootDayData[];
  initialCategories: CategoryData[];
  categoryLibrary: CategoryData[];
  readOnly?: boolean;
}

export default function BreakdownEditor({
  scenes: initialScenes,
  productionElements: initialElements,
  productionId,
  scriptId,
  initialShootDays,
  initialCategories,
  categoryLibrary,
  readOnly = false,
}: Props) {
  const [scenes, setScenes] = useState<SceneData[]>(initialScenes);
  const [elements, setElements] = useState<ProductionElement[]>(initialElements);
  const [categories, setCategories] = useState<CategoryData[]>(initialCategories);
  const [flags, setFlags] = useState<Map<string, FlagData>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(
    initialScenes[0]?.id ?? null
  );
  const [showPdf, setShowPdf] = useState(false);
  const [showSceneList, setShowSceneList] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(!readOnly);

  // Load the current user's flags for this production
  useEffect(() => {
    fetch(`/api/element-flags?productionId=${productionId}`)
      .then((r) => r.json())
      .then((data: { id: string; scene_element_id: string; note: string; due_date: string | null; is_done: boolean }[]) => {
        if (!Array.isArray(data)) return;
        const map = new Map<string, FlagData>();
        for (const f of data) {
          map.set(f.scene_element_id, { id: f.id, note: f.note, due_date: f.due_date, is_done: f.is_done });
        }
        setFlags(map);
      })
      .catch(() => {/* ignore */});
  }, [productionId]);

  const handleFlagToggle = useCallback(async (sceneElementId: string) => {
    const existing = flags.get(sceneElementId);
    if (existing) {
      await fetch("/api/element-flags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existing.id }),
      });
      setFlags((prev) => {
        const next = new Map(prev);
        next.delete(sceneElementId);
        return next;
      });
    } else {
      const res = await fetch("/api/element-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneElementId, productionId }),
      });
      const data = await res.json();
      if (data?.id) {
        setFlags((prev) => new Map(prev).set(sceneElementId, { id: data.id, note: "", due_date: null, is_done: false }));
      }
    }
  }, [flags, productionId]);

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

  const editorPane = (
    <main className="flex-1 overflow-y-auto min-w-0">
      {selectedScene ? (
        <SceneEditor
          key={selectedScene.id}
          scene={selectedScene}
          productionId={productionId}
          productionElements={elements}
          categories={categories.map((c) => c.name)}
          flags={flags}
          onCompleteToggle={handleCompleteToggle}
          onElementCreated={handleElementCreated}
          onSheetChange={(sheet) => handleSheetChange(selectedScene.id, sheet)}
          onFlagToggle={handleFlagToggle}
          readOnly={readOnly}
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
              productionId={productionId}
              onSelect={setSelectedId}
              shootDays={initialShootDays}
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
            {/* Header */}
            <div className="shrink-0 flex items-center border-b border-black/10">
              <button
                onClick={() => setShowRightPanel(false)}
                title="Collapse panel"
                className="w-7 shrink-0 flex items-center justify-center text-xs opacity-25 hover:opacity-60 transition-opacity border-r border-black/10 self-stretch"
              >
                →
              </button>
              {!readOnly && (
                <span className="flex-1 text-xs font-bold uppercase tracking-wide py-2 px-3 opacity-40">
                  Categories
                </span>
              )}
              {scriptId && (
                <button
                  onClick={() => setShowPdf((p) => !p)}
                  className={`text-xs font-bold uppercase tracking-wide py-2 px-3 transition-colors ${
                    showPdf ? "bg-black text-white" : "hover:bg-black/5 opacity-40"
                  }`}
                >
                  Script
                </button>
              )}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">
              {!readOnly && (
                <CategoriesPanel
                  productionId={productionId}
                  categories={categories}
                  library={categoryLibrary}
                  onCategoriesChange={setCategories}
                />
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
