"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ParsedScene } from "@/lib/script-parser";

interface ParseResult {
  blobUrl: string;
  filename: string;
  pageCount: number;
  scenes: ParsedScene[];
}

export default function UploadScriptPage({
  params,
}: {
  params: Promise<{ cloudId: string }>;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [cloudId, setCloudId] = useState<string | null>(null);
  const [productionId, setProductionId] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [version, setVersion] = useState("v1");
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Resolve params on mount
  useState(() => {
    params.then(({ cloudId: cid }) => {
      setCloudId(cid);
      // Fetch the production's internal ID
      fetch(`/api/production-id?cloudId=${cid}`)
        .then((r) => r.json())
        .then((d) => setProductionId(d.id ?? null));
    });
  });

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setError(null);
    setParsing(true);

    const form = new FormData();
    form.append("pdf", file);

    const res = await fetch("/api/parse-script", { method: "POST", body: form });
    const data = await res.json();
    setParsing(false);

    if (!res.ok) {
      setError(data.error ?? "Parsing failed.");
      return;
    }
    setParseResult(data);
    setStep("preview");
  }

  async function handleImport() {
    if (!parseResult || !productionId || !cloudId) return;
    setStep("importing");

    const res = await fetch("/api/import-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productionId,
        filename: parseResult.filename,
        version,
        blobUrl: parseResult.blobUrl,
        scenes: parseResult.scenes,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Import failed.");
      setStep("preview");
      return;
    }

    router.push(`/cloud/productions/${cloudId}`);
    router.refresh();
  }

  // ── Upload step ──────────────────────────────────────────────────────────────

  if (step === "upload") {
    return (
      <div className="max-w-lg mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold mb-1">Upload Script</h1>
        <p className="text-sm opacity-40 mb-10">
          PDF screenplay only. Text-based PDFs work best — scanned images won&apos;t parse.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-3 py-16 transition-colors ${
            dragging ? "border-black bg-black/5" : "border-black/20 hover:border-black/50"
          }`}
        >
          {parsing ? (
            <p className="text-sm opacity-50">Parsing script…</p>
          ) : (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-25">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <p className="text-sm font-bold">Drop PDF here or click to browse</p>
              <p className="text-xs opacity-30">Screenplay PDF</p>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ── Preview step ─────────────────────────────────────────────────────────────

  if (step === "preview" && parseResult) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              {parseResult.scenes.length} scenes detected
            </h1>
            <p className="text-sm opacity-40">
              {parseResult.filename} · {parseResult.pageCount} pages
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => { setStep("upload"); setParseResult(null); }}
              className="text-xs uppercase tracking-widest opacity-40 hover:opacity-80 transition-opacity"
            >
              ← Back
            </button>
            <button
              onClick={handleImport}
              className="bg-black text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 hover:opacity-80 transition-opacity"
            >
              Import script
            </button>
          </div>
        </div>

        {/* Version label */}
        <div className="mb-6 flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-widest opacity-30 whitespace-nowrap">
            Script version
          </label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="border border-black/20 px-2.5 py-1 text-sm focus:outline-none focus:border-black/50 w-28"
          />
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {/* Scene list preview */}
        <div className="border border-black/10 divide-y divide-black/10">
          {parseResult.scenes.map((s, i) => (
            <div key={i} className="flex items-baseline gap-3 px-4 py-2.5">
              <span className="font-mono text-xs opacity-30 w-8 shrink-0">{s.sceneNumber}</span>
              <span
                className={`text-xs font-bold px-1 py-0.5 shrink-0 ${
                  s.intExt === "EXT"
                    ? "bg-green-100 text-green-700"
                    : s.intExt === "INT/EXT"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {s.intExt}
              </span>
              <span className="text-sm flex-1 min-w-0 truncate">{s.location}</span>
              {s.timeOfDay && s.timeOfDay !== "UNSPECIFIED" && (
                <span className="text-xs opacity-30 shrink-0">{s.timeOfDay}</span>
              )}
              <span className="text-xs opacity-25 shrink-0 font-mono">p.{s.pageStart}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Importing step ───────────────────────────────────────────────────────────

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm opacity-40">Importing {parseResult?.scenes.length} scenes…</p>
    </div>
  );
}
