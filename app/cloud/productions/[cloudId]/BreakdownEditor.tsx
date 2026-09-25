"use client";

import { useState, useCallback, useEffect } from "react";
import type { SceneData, ProductionElement, SheetData, CategoryData, FlagData } from "./types";
import BreakdownGrid from "./BreakdownGrid";

interface Props {
  scenes: SceneData[];
  productionElements: ProductionElement[];
  productionId: string;
  scriptId: string | null;
  initialCategories: CategoryData[];
  categoryLibrary: CategoryData[];
  readOnly?: boolean;
}

export default function BreakdownEditor({
  scenes: initialScenes,
  productionElements: initialElements,
  productionId,
  scriptId,
  initialCategories,
  categoryLibrary,
  readOnly = false,
}: Props) {
  const [scenes, setScenes] = useState<SceneData[]>(initialScenes);
  const [elements, setElements] = useState<ProductionElement[]>(initialElements);
  const [categories, setCategories] = useState<CategoryData[]>(initialCategories);
  const [flags, setFlags] = useState<Map<string, FlagData>>(new Map());

  // PDF pane
  const [showScript, setShowScript] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [externalUrl, setExternalUrl] = useState<string | null>(null);

  const pdfSrc = scriptId
    ? `/api/script-pdf?scriptId=${scriptId}`
    : externalUrl;

  // Load flags
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
      .catch(() => {});
  }, [productionId]);

  const handleCompleteToggle = useCallback((sceneId: string, isComplete: boolean) => {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, is_complete: isComplete } : s)));
  }, []);

  const handleSheetChange = useCallback((sceneId: string, sheet: SheetData | null) => {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, sheet } : s)));
  }, []);

  const handleElementCreated = useCallback((el: ProductionElement) => {
    setElements((prev) => (prev.some((e) => e.id === el.id) ? prev : [...prev, el]));
  }, []);

  function handleLinkUrl(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setExternalUrl(trimmed);
    setShowScript(true);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Script pane ── */}
      <div className="shrink-0 flex flex-col border-b border-black/15 overflow-hidden"
        style={{ height: showScript ? "40%" : "auto" }}
      >
        {/* Strip header */}
        <div className="shrink-0 flex items-center border-b border-black/10 h-7 px-3 gap-2">
          <button
            onClick={() => setShowScript((p) => !p)}
            className={`text-[10px] font-bold uppercase tracking-widest transition-opacity ${
              showScript ? "opacity-60 hover:opacity-100" : "opacity-25 hover:opacity-60"
            }`}
          >
            {showScript ? "▲ Script" : "▼ Script"}
          </button>
          {externalUrl && !scriptId && (
            <button
              onClick={() => { setExternalUrl(null); setUrlInput(""); }}
              className="text-[10px] opacity-30 hover:opacity-60 transition-opacity ml-1"
            >
              × unlink
            </button>
          )}
        </div>

        {/* Pane body */}
        {showScript && (
          pdfSrc ? (
            <iframe
              src={pdfSrc}
              className="flex-1 border-0 min-h-0"
              title="Script"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
              <p className="text-xs opacity-30 text-center">
                No script linked. Paste a URL to pin it here.
              </p>
              <form onSubmit={handleLinkUrl} className="flex w-full max-w-md gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://…"
                  className="flex-1 text-xs border border-black/20 px-3 py-1.5 focus:outline-none focus:border-black/50 placeholder:opacity-30"
                />
                <button
                  type="submit"
                  disabled={!urlInput.trim()}
                  className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 bg-black text-white disabled:opacity-30 hover:opacity-80 transition-opacity"
                >
                  Link
                </button>
              </form>
            </div>
          )
        )}
      </div>

      {/* ── Breakdown grid ── */}
      <div className="flex-1 overflow-hidden">
        <BreakdownGrid
          scenes={scenes}
          productionElements={elements}
          categories={categories}
          categoryLibrary={categoryLibrary}
          productionId={productionId}
          flags={flags}
          onCompleteToggle={handleCompleteToggle}
          onSheetChange={handleSheetChange}
          onElementCreated={handleElementCreated}
          onCategoryCreate={(cat) => setCategories((prev) => [...prev, cat])}
          readOnly={readOnly}
        />
      </div>

    </div>
  );
}
