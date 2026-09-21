"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function ImportSchedulePage() {
  const params = useParams<{ cloudId: string }>();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ updated: number; notFound: string[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setError(null);
    setResult(null);
    setProcessing(true);

    try {
      const form = new FormData();
      form.append("pdf", file);
      form.append("productionId", params.cloudId); // resolved to internal ID server-side

      // Resolve cloudId → internal productionId first
      const idRes = await fetch(`/api/production-id?cloudId=${params.cloudId}`);
      const idData = await idRes.json();
      if (!idRes.ok) { setError(idData.error ?? "Production not found."); return; }

      const form2 = new FormData();
      form2.append("pdf", file);
      form2.append("productionId", idData.productionId);

      const res = await fetch("/api/import-schedule", { method: "POST", body: form2 });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) { setError(data.error ?? "Import failed."); return; }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <div className="mb-1 text-xs opacity-30 uppercase tracking-widest">
        <Link href={`/cloud/productions/${params.cloudId}`} className="hover:opacity-60 transition-opacity">
          ← Back to production
        </Link>
      </div>
      <h1 className="text-2xl font-bold mt-3 mb-1">Import shooting schedule</h1>
      <p className="text-sm opacity-40 mb-10">
        Upload the PDF shooting schedule. Scene numbers are matched and shoot day order is updated automatically.
      </p>

      {!result ? (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-3 py-16 transition-colors ${
              dragging ? "border-black bg-black/5" : "border-black/20 hover:border-black/50"
            }`}
          >
            {processing ? (
              <p className="text-sm opacity-50">Reading schedule…</p>
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-25">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p className="text-sm font-bold">Drop schedule PDF here or click to browse</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </>
      ) : (
        <div className="border border-black/10 p-6 flex flex-col gap-4">
          <div>
            <p className="text-2xl font-bold">{result.updated} scenes updated</p>
            <p className="text-sm opacity-40 mt-1">of {result.total} found in the schedule</p>
          </div>
          {result.notFound.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-2">
                Not matched ({result.notFound.length})
              </p>
              <p className="text-sm opacity-50">{result.notFound.join(", ")}</p>
              <p className="text-xs opacity-30 mt-1">
                These scene numbers exist in the schedule but not in the current script.
              </p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.push(`/cloud/productions/${params.cloudId}`)}
              className="bg-black text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 hover:opacity-80 transition-opacity"
            >
              Back to breakdown
            </button>
            <button
              onClick={() => { setResult(null); setError(null); }}
              className="text-xs uppercase tracking-widest opacity-40 hover:opacity-80 transition-opacity"
            >
              Import another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
