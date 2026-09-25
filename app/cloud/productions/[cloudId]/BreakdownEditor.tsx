"use client";

import { useState, useCallback, useEffect } from "react";
import type { SceneData, ProductionElement, SheetData, ShootDayData, CategoryData, FlagData } from "./types";
import SceneList from "./SceneList";
import SceneEditor from "./SceneEditor";
import CategoriesPanel from "./CategoriesPanel";
import BreakdownGrid from "./BreakdownGrid";

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
  const [viewMode, setViewMode] = useState<"form" | "grid">("form");
  const [showPdf, setShowPdf] = useState(scriptId !== null);
  const [pdfLayout, setPdfLayout] = useState<"side" | "top">("top");
  const [showSceneList, setShowSceneList] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(!readOnly);
  // Mobile: "list" shows the scene list full-width; "editor" shows the scene editor full-width
  const [mobilePanel, setMobilePanel] = useState<"list" | "editor">("list");

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

  // Variant used by SceneEditor (doesn't know its own sceneId)
  const handleSheetChangeForSelected = useCallback((sheet: SheetData | null) => {
    if (selectedId) handleSheetChange(selectedId, sheet);
  }, [selectedId, handleSheetChange]);

  const handleElementCreated = useCallback((el: ProductionElement) => {
    setElements((prev) => (prev.some((e) => e.id === el.id) ? prev : [...prev, el]));
  }, []);

  const handleOrderChange = useCallback(
    (updates: { id: string; shoot_day: number; shoot_order: number }[]) => {
      const map = new Map(updates.map((u) => [u.id, u]));
      setScenes((prev) =>
        prev.map((s) => {
          const u = map.get(s.id);
          return u ? { ...s, shoot_day: u.shoot_day, shoot_order: u.shoot_order } : s;
        })
      );
    },
    []
  );

  const selectedIndex = selectedId ? scenes.findIndex((s) => s.id === selectedId) : -1;
  const prevScene = selectedIndex > 0 ? scenes[selectedIndex - 1] : null;
  const nextScene = selectedIndex < scenes.length - 1 ? scenes[selectedIndex + 1] : null;

  function navigateTo(scene: { id: string }) {
    setSelectedId(scene.id);
    setMobilePanel("editor");
  }

  const editorPane = (
    <main className="flex-1 overflow-y-auto min-w-0 min-h-0">
      {/* Mobile back button */}
      <div className="sm:hidden shrink-0 flex items-center border-b border-black/10 px-3 py-2">
        <button
          onClick={() => setMobilePanel("list")}
          className="text-xs opacity-50 hover:opacity-80 transition-opacity"
        >
          ← Scenes
        </button>
      </div>
      {/* Prev / Next navigation */}
      {scenes.length > 1 && (
        <div className="shrink-0 flex items-center border-b border-black/10 px-3 py-1.5 gap-2">
          <button
            onClick={() => prevScene && navigateTo(prevScene)}
            disabled={!prevScene}
            className="text-xs opacity-40 hover:opacity-80 disabled:opacity-15 transition-opacity"
          >
            ← {prevScene ? prevScene.scene_number : ""}
          </button>
          <span className="flex-1 text-center text-xs opacity-20 tabular-nums">
            {selectedIndex + 1} / {scenes.length}
          </span>
          <button
            onClick={() => nextScene && navigateTo(nextScene)}
            disabled={!nextScene}
            className="text-xs opacity-40 hover:opacity-80 disabled:opacity-15 transition-opacity"
          >
            {nextScene ? nextScene.scene_number : ""} →
          </button>
        </div>
      )}
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
          onSheetChange={handleSheetChangeForSelected}
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

  // ── Grid view ────────────────────────────────────────────────────────────────
  if (viewMode === "grid") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Grid toolbar */}
        <div className="shrink-0 flex items-center border-b border-black/10 px-3 gap-2">
          <div className="flex border border-black/15 text-xs font-bold uppercase tracking-widest">
            <button
              onClick={() => setViewMode("form")}
              className="px-3 py-1.5 opacity-30 hover:opacity-60 transition-opacity"
            >
              Form
            </button>
            <button
              className="px-3 py-1.5 bg-black text-white"
            >
              Grid
            </button>
          </div>
          <span className="text-xs opacity-20 tabular-nums ml-1">
            {scenes.length} scene{scenes.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-hidden">
          <BreakdownGrid
            scenes={scenes}
            productionElements={elements}
            categories={categories.map((c) => c.name)}
            productionId={productionId}
            flags={flags}
            onCompleteToggle={handleCompleteToggle}
            onSheetChange={handleSheetChange}
            onElementCreated={handleElementCreated}
            readOnly={readOnly}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Scene list ── */}
      {/* Mobile: full-width in "list" view, hidden in "editor" view */}
      {/* Desktop: collapsible sidebar */}
      <aside
        className={[
          mobilePanel === "list" ? "flex" : "hidden",
          "sm:flex flex-col border-r border-black/10 overflow-hidden",
          showSceneList ? "sm:w-48" : "sm:w-7",
          "w-full sm:shrink-0 sm:transition-[width] sm:duration-200",
        ].join(" ")}
      >
        <button
          onClick={() => setShowSceneList((p) => !p)}
          title={showSceneList ? "Collapse scenes" : "Expand scenes"}
          className="hidden sm:flex shrink-0 h-7 items-center justify-center border-b border-black/10 text-xs opacity-25 hover:opacity-60 transition-opacity"
        >
          {showSceneList ? "←" : "→"}
        </button>
        <div className="flex-1 overflow-y-auto">
          <SceneList
            scenes={scenes}
            selectedSceneId={selectedId}
            productionId={productionId}
            onSelect={(id) => { setSelectedId(id); setMobilePanel("editor"); }}
            shootDays={initialShootDays}
            onOrderChange={handleOrderChange}
          />
        </div>
      </aside>

      {/* ── PDF viewer + breakdown editor ── */}
      {/* Mobile: full-width in "editor" view, hidden in "list" view */}
      {showPdf && scriptId ? (
        <div className={[
          mobilePanel === "editor" ? "flex" : "hidden",
          "sm:flex flex-1 overflow-hidden border-r border-black/10",
          pdfLayout === "top" ? "flex-col" : "",
        ].join(" ")}>
          <iframe
            src={`/api/script-pdf?scriptId=${scriptId}`}
            className={[
              "flex-1 min-h-0 min-w-0 border-0",
              pdfLayout === "side" ? "border-r border-black/10" : "border-b border-black/10",
            ].join(" ")}
            title="Script PDF"
          />
          {editorPane}
        </div>
      ) : (
        <div className={[
          mobilePanel === "editor" ? "flex" : "hidden",
          "sm:flex flex-1 border-r border-black/10 overflow-hidden",
        ].join(" ")}>
          {editorPane}
        </div>
      )}

      {/* ── Right panel (desktop only) ── */}
      <aside
        className={`hidden sm:flex ${showRightPanel ? "w-72" : "w-7"} shrink-0 flex-col transition-[width] duration-200 overflow-hidden`}
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
              {/* View toggle */}
              <div className="flex border border-black/15 text-xs font-bold uppercase tracking-widest ml-2 mr-auto">
                <button
                  className="px-2 py-1 bg-black text-white"
                >
                  Form
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className="px-2 py-1 opacity-30 hover:opacity-60 transition-opacity"
                >
                  Grid
                </button>
              </div>
              {scriptId && (
                <>
                  {showPdf && (
                    <button
                      onClick={() => setPdfLayout((p) => (p === "side" ? "top" : "side"))}
                      title={pdfLayout === "side" ? "Switch to stacked layout" : "Switch to side-by-side layout"}
                      className="text-xs py-2 px-2 opacity-30 hover:opacity-70 transition-opacity"
                    >
                      {pdfLayout === "side" ? "↕" : "↔"}
                    </button>
                  )}
                  <button
                    onClick={() => setShowPdf((p) => !p)}
                    className={`text-xs font-bold uppercase tracking-wide py-2 px-3 transition-colors ${
                      showPdf ? "bg-black text-white" : "hover:bg-black/5 opacity-40"
                    }`}
                  >
                    Script
                  </button>
                </>
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
              <>
                <button
                  onClick={() => setShowPdf((p) => !p)}
                  title={showPdf ? "Hide script" : "Show script"}
                  className={`text-xs font-bold uppercase py-1 transition-opacity ${showPdf ? "opacity-100" : "opacity-25 hover:opacity-60"}`}
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  Script
                </button>
                {showPdf && (
                  <button
                    onClick={() => setPdfLayout((p) => (p === "side" ? "top" : "side"))}
                    title={pdfLayout === "side" ? "Switch to stacked" : "Switch to side-by-side"}
                    className="text-xs opacity-30 hover:opacity-70 transition-opacity"
                  >
                    {pdfLayout === "side" ? "↕" : "↔"}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
