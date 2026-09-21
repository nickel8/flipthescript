"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ParsedScene } from "@/lib/script-parser";

type Mode = "blank" | "inherit";

interface ParseResult {
  blobUrl: string;
  filename: string;
  pageCount: number;
  scenes: ParsedScene[];
}

interface Props {
  cloudId: string;
  productionId: string;
  productionName: string;
  currentScriptId: string | null;
  currentScriptName: string | null;
}

export default function UploadClient({
  cloudId,
  productionId,
  productionName,
  currentScriptId,
  currentScriptName,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [version, setVersion] = useState("");
  const [mode, setMode] = useState<Mode>("inherit");
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const isAmendment = !!currentScriptId;

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setError(null);
    setParsing(true);

    try {
      const form = new FormData();
      form.append("pdf", file);

      const res = await fetch("/api/parse-script", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      setParsing(false);

      if (!res.ok) {
        setError(data.error ?? `Parsing failed (${res.status}).`);
        return;
      }

      setParseResult(data);
      // Default version label: increment if amendment
      setVersion(isAmendment ? "" : "v1");
      setStep("preview");
    } catch (err) {
      setParsing(false);
      setError(err instanceof Error ? err.message : "Parsing failed — please try again.");
    }
  }

  async function handleImport() {
    if (!parseResult) return;
    setStep("importing");

    const res = await fetch("/api/import-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productionId,
        filename: parseResult.filename,
        version: version || (isAmendment ? "amendment" : "v1"),
        blobUrl: parseResult.blobUrl,
        scenes: parseResult.scenes,
        mode: isAmendment ? mode : "blank",
        currentScriptId: isAmendment ? currentScriptId : null,
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
        <div className="flex items-center gap-2 mb-1 text-xs opacity-30 uppercase tracking-widest">
          <Link href={`/cloud/productions/${cloudId}`} className="hover:opacity-60 transition-opacity">
            ← {productionName}
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-1 mt-3">
          {isAmendment ? "Upload new version" : "Upload script"}
        </h1>
        {isAmendment && currentScriptName && (
          <p className="text-sm opacity-40 mb-10">
            Current: {currentScriptName}
          </p>
        )}
        {!isAmendment && (
          <p className="text-sm opacity-40 mb-10">
            PDF screenplay only. Text-based PDFs work best.
          </p>
        )}

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
            Version label
          </label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder={isAmendment ? "e.g. v2, pink pages…" : "v1"}
            className="border border-black/20 px-2.5 py-1 text-sm focus:outline-none focus:border-black/50 w-40"
          />
        </div>

        {/* Mode selector — only shown for amendments */}
        {isAmendment && (
          <div className="mb-8 border border-black/10 divide-y divide-black/10">
            <button
              onClick={() => setMode("inherit")}
              className={`w-full text-left px-5 py-4 flex items-start gap-4 transition-colors ${
                mode === "inherit" ? "bg-black text-white" : "hover:bg-black/5"
              }`}
            >
              <span className="text-lg leading-none mt-0.5">
                {mode === "inherit" ? "●" : "○"}
              </span>
              <div>
                <p className="text-sm font-bold">Carry over breakdown data</p>
                <p className={`text-xs mt-0.5 ${mode === "inherit" ? "opacity-60" : "opacity-40"}`}>
                  Synopses, elements, and completion status are copied to scenes
                  with matching scene numbers. New scenes start blank.
                </p>
              </div>
            </button>
            <button
              onClick={() => setMode("blank")}
              className={`w-full text-left px-5 py-4 flex items-start gap-4 transition-colors ${
                mode === "blank" ? "bg-black text-white" : "hover:bg-black/5"
              }`}
            >
              <span className="text-lg leading-none mt-0.5">
                {mode === "blank" ? "●" : "○"}
              </span>
              <div>
                <p className="text-sm font-bold">Start fresh</p>
                <p className={`text-xs mt-0.5 ${mode === "blank" ? "opacity-60" : "opacity-40"}`}>
                  All scenes start with empty breakdowns. Previous version is
                  preserved in script history.
                </p>
              </div>
            </button>
          </div>
        )}

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
      <p className="text-sm opacity-40">
        {mode === "inherit"
          ? `Importing ${parseResult?.scenes.length} scenes and carrying over breakdown data…`
          : `Importing ${parseResult?.scenes.length} scenes…`}
      </p>
    </div>
  );
}
