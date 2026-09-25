// Browser-side PDF parsing. The PDF is processed entirely in the browser —
// it never leaves the user's device.

import { buildScenes } from "./scene-builder";
import type { ParsedScene } from "./scene-builder";

export async function parsePdfInBrowser(
  file: File
): Promise<{ scenes: ParsedScene[]; pageCount: number }> {
  const buffer = await file.arrayBuffer();

  // Dynamic import keeps pdfjs out of the initial bundle
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    // Worker is served as a static asset (copied by postinstall)
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
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

    // Group text items by Y coordinate to reconstruct lines
    const itemsByY = new Map<number, string[]>();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round((item as { transform: number[] }).transform[5]);
      if (!itemsByY.has(y)) itemsByY.set(y, []);
      itemsByY.get(y)!.push((item as { str: string }).str);
    }

    // Sort Y descending (top of page first)
    const sortedYs = [...itemsByY.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      const lineText = itemsByY.get(y)!.join(" ").trim();
      if (lineText) linesByPage.push({ line: lineText, page: i });
    }
  }

  const scenes = buildScenes(linesByPage);
  const pageCount = scenes.length > 0 ? scenes[scenes.length - 1].pageStart : doc.numPages;
  return { scenes, pageCount };
}
