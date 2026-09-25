// TypeScript port of FlipTheScript/Services/ScriptParser.swift
// Parses screenplay PDFs into structured scene data.
// Server-side only — uses pdfjs-dist with Node.js worker resolution.
// Browser-safe scene building lives in lib/scene-builder.ts.

export type { ParsedScene } from "./scene-builder";
export { buildScenes } from "./scene-builder";

// ── PDF text extraction ────────────────────────────────────────────────────────
// Extracts text per page from a PDF buffer using pdfjs-dist (server-side only).

export async function extractLinesFromPdf(
  buffer: ArrayBuffer
): Promise<Array<{ line: string; page: number }>> {
  // Dynamic import keeps this out of client bundles
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // In Node.js, pdfjs needs a path to the worker file — empty string causes the
  // "fake worker" setup to fail. Resolve the absolute path via createRequire.
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const { createRequire } = await import("module");
    const req = createRequire(import.meta.url);
    pdfjsLib.GlobalWorkerOptions.workerSrc = req.resolve(
      "pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    useSystemFonts: true,
  });

  const doc = await loadingTask.promise;
  const linesByPage: Array<{ line: string; page: number }> = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // Build lines by grouping text items with similar Y positions
    const itemsByY = new Map<number, string[]>();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round((item as { transform: number[] }).transform[5]);
      if (!itemsByY.has(y)) itemsByY.set(y, []);
      itemsByY.get(y)!.push((item as { str: string }).str);
    }

    // Sort by Y descending (top of page first)
    const sortedYs = [...itemsByY.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      const lineText = itemsByY.get(y)!.join(" ").trim();
      if (lineText) linesByPage.push({ line: lineText, page: i });
    }
  }

  return linesByPage;
}

export async function parseScript(buffer: ArrayBuffer) {
  const { buildScenes } = await import("./scene-builder");
  const lines = await extractLinesFromPdf(buffer);
  return buildScenes(lines);
}
