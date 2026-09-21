// TypeScript port of FlipTheScript/Services/ScriptParser.swift
// Parses screenplay PDFs into structured scene data.

export interface ParsedScene {
  sceneNumber: string;
  slugLine: string;
  intExt: string;
  location: string;
  timeOfDay: string;
  pageStart: number;
  rawText: string;
}

interface SlugMatch {
  sceneNumber: string | null;
  cleanSlug: string;
  intExt: string;
  location: string;
  timeOfDay: string;
}

// Format A: INT/EXT at start — "INT. LOCATION - DAY"
const SLUG_REGEX_START =
  /^(\d+[A-Za-z]?\.?\s+)?(INT\.?(?:\/EXT\.?)?|EXT\.?(?:\/INT\.?)?|INT\/EXT|EXT\/INT|I\/E\.?)\s+(.+?)(?:\s*[-–—]\s*([A-Z][A-Z\s/.\\-]+))?(\s+\d+[A-Za-z]?\.?)?\s*$/i;

// Format B: INT/EXT in the middle — "LOCATION - INT. - DAY"
const SLUG_REGEX_MIDDLE =
  /^(\d+[A-Za-z]?\.?\s+)?(.+?)\s*[-–—]\s*(INT\.?(?:\/EXT\.?)?|EXT\.?(?:\/INT\.?)?|INT\/EXT|EXT\/INT|I\/E\.?)(?:\s*[-–—.]\s*([A-Z][A-Z\s/.\\-]+))?\s*(\d+[A-Za-z]?\.?)?\s*$/i;

const VALID_A_PREFIXES = ["INT.", "EXT.", "INT/EXT", "EXT/INT", "I/E", "INT ", "EXT "];

function normalizeIntExt(raw: string): string {
  const up = raw.toUpperCase();
  if (up.includes("INT") && up.includes("EXT")) return "INT/EXT";
  if (up.includes("EXT")) return "EXT";
  return "INT";
}

function tryFormatA(line: string): SlugMatch | null {
  const withoutNumber = line.replace(/^\d+[A-Za-z]?\.?\s+/, "").trim().toUpperCase();
  if (!VALID_A_PREFIXES.some((p) => withoutNumber.startsWith(p))) return null;

  const match = line.match(SLUG_REGEX_START);
  if (!match) return null;

  const sceneNum = match[1]?.trim().replace(/\./g, "").trim() || null;
  const rawIntExt = match[2] ?? "INT";
  const location = match[3]?.trim() ?? "";
  const timeOfDay = match[4]?.trim().toUpperCase() ?? "UNSPECIFIED";

  let clean = line;
  if (match[1]) clean = clean.slice(match[1].length).trim();
  if (match[5]) clean = clean.slice(0, -match[5].length).trim();

  return {
    sceneNumber: sceneNum || null,
    cleanSlug: clean || line.trim(),
    intExt: normalizeIntExt(rawIntExt),
    location: location || withoutNumber,
    timeOfDay,
  };
}

function tryFormatB(line: string): SlugMatch | null {
  const match = line.match(SLUG_REGEX_MIDDLE);
  if (!match) return null;

  const rawIntExt = match[3];
  if (!rawIntExt) return null;

  const sceneNum = match[1]?.trim().replace(/\./g, "").trim() || null;
  const location = match[2]?.trim() ?? "";
  const timeOfDay = match[4]?.trim().toUpperCase() ?? "UNSPECIFIED";

  if (location.length <= 1) return null;

  let clean = location;
  clean += ` - ${rawIntExt.toUpperCase()}`;
  if (timeOfDay !== "UNSPECIFIED") clean += ` - ${timeOfDay}`;

  return {
    sceneNumber: sceneNum || null,
    cleanSlug: clean,
    intExt: normalizeIntExt(rawIntExt),
    location,
    timeOfDay,
  };
}

function parseSlugLine(line: string): SlugMatch | null {
  if (line.length <= 5) return null;
  const upper = line.toUpperCase();
  if (!upper.includes("INT") && !upper.includes("EXT")) return null;
  return tryFormatA(line) ?? tryFormatB(line);
}

export function buildScenes(
  linesByPage: Array<{ line: string; page: number }>
): ParsedScene[] {
  const scenes: ParsedScene[] = [];
  let current: ParsedScene | null = null;
  let autoNumber = 0;

  for (const { line, page } of linesByPage) {
    const trimmed = line.trim();
    const match = parseSlugLine(trimmed);
    if (match) {
      if (current) scenes.push(current);
      autoNumber++;
      current = {
        sceneNumber: match.sceneNumber ?? String(autoNumber),
        slugLine: match.cleanSlug,
        intExt: match.intExt,
        location: match.location,
        timeOfDay: match.timeOfDay,
        pageStart: page,
        rawText: match.cleanSlug + "\n",
      };
    } else if (current && trimmed !== "") {
      current.rawText += trimmed + "\n";
    }
  }
  if (current) scenes.push(current);
  return scenes;
}

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

export async function parseScript(buffer: ArrayBuffer): Promise<ParsedScene[]> {
  const lines = await extractLinesFromPdf(buffer);
  return buildScenes(lines);
}
