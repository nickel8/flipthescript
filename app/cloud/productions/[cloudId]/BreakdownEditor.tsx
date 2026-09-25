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

  // PDF pane — only open by default when there's already a script
  const [showScript, setShowScript] = useState(scriptId !== null);
  const [urlInput, setUrlInput] = useState("");
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState(false);

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
      <div className="shrink-0 flex flex-col border-b border-black/15">
        {/* Strip header */}
        <div className="shrink-0 flex items-center border-b border-black/10 h-8 px-3 gap-2">
          {pdfSrc ? (
            /* Has a script — show toggle */
            <button
              onClick={() => setShowScript((p) => !p)}
              className="text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-80 transition-opacity"
            >
              {showScript ? "▲" : "▼"} Script
            </button>
          ) : (
            /* No script — always show URL input inline */
            <>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-25 shrink-0">
                Script
              </span>
              {editingUrl ? (
                <form onSubmit={handleLinkUrl} className="flex flex-1 gap-2">
                  <input
                    autoFocus
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setEditingUrl(false)}
                    placeholder="Paste script URL (OneDrive, Google Drive, Dropbox…)"
                    className="flex-1 text-xs border-0 border-b border-black/20 focus:outline-none focus:border-black/50 placeholder:opacity-30 bg-transparent py-0.5"
                  />
                  <button
                    type="submit"
                    disabled={!urlInput.trim()}
                    className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity shrink-0"
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUrl(false)}
                    className="text-[10px] opacity-30 hover:opacity-60 transition-opacity shrink-0"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setEditingUrl(true)}
                  className="text-[10px] opacity-40 hover:opacity-80 transition-opacity underline underline-offset-2"
                >
                  Link a script URL…
                </button>
              )}
            </>
          )}

          {externalUrl && !scriptId && (
            <button
              onClick={() => { setExternalUrl(null); setUrlInput(""); setShowScript(false); }}
              className="text-[10px] opacity-25 hover:opacity-60 transition-opacity ml-auto"
            >
              × unlink
            </button>
          )}
        </div>

        {/* Iframe — fixed height when open */}
        {showScript && pdfSrc && (
          <iframe
            src={pdfSrc}
            className="border-0 w-full"
            style={{ height: 320 }}
            title="Script"
          />
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
