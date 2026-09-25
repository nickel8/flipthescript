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
  characters: string[]; // ALL-CAPS character cues extracted from body text
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

  // Strip "SCENE ONE." / "SCENE 1." prefix some scripts add before the slug
  let work = line.replace(/^SCENE\s+[^.]+\.\s*/i, "");

  // Strip trailing duplicate margin scene numbers: "... 1 1" or "... 42 42"
  work = work.replace(/(\s+\d+[A-Za-z]?\.?){1,2}\s*$/, "").trim();

  if (work.length <= 5) return null;

  return tryFormatA(work) ?? tryFormatB(work);
}

// ── Character extraction ──────────────────────────────────────────────────────
// In standard screenplay format, a character cue is an ALL-CAPS line that
// appears immediately before dialogue. We identify these from each scene's
// body text and collect them as the scene's character list.

const NON_CHARACTER_CAPS = new Set([
  "FADE IN", "FADE OUT", "FADE TO BLACK", "FADE TO WHITE",
  "CUT TO", "CUT BACK TO", "SMASH CUT TO", "JUMP CUT TO", "HARD CUT TO",
  "DISSOLVE TO", "MATCH CUT TO", "WIPE TO",
  "INTERCUT", "INTERCUT WITH",
  "BACK TO", "BACK TO SCENE",
  "FLASHBACK", "END FLASHBACK", "FLASH FORWARD", "END FLASH FORWARD",
  "TITLE CARD", "SUPER", "SUBTITLE", "OVER BLACK", "ON SCREEN",
  "THE END", "END OF SHOW", "END OF EPISODE", "END OF PILOT",
  "ACT ONE", "ACT TWO", "ACT THREE", "ACT FOUR", "END OF ACT",
  "COLD OPEN", "TAG", "TEASER", "EPILOGUE", "PROLOGUE", "RECAP",
  "CONTINUED", "MORE",
]);

function extractCharacterCue(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length < 2 || trimmed.length > 50) return null;

  // Strip trailing extension: (V.O.), (O.S.), (CONT'D), (PRE-LAP), etc.
  const withoutExt = trimmed.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (withoutExt.length < 2) return null;

  // Must be ALL CAPS — letters, digits, spaces, apostrophes, hyphens, periods (initials)
  if (!/^[A-Z][A-Z0-9\s'./-]*$/.test(withoutExt)) return null;

  // Transitions and directions end with a colon or period
  if (withoutExt.endsWith(":") || withoutExt.endsWith(".")) return null;

  // Known non-character phrases
  if (NON_CHARACTER_CAPS.has(withoutExt)) return null;

  // Max 4 words — character names are never long phrases
  if (withoutExt.split(/\s+/).length > 4) return null;

  return withoutExt;
}

function extractCharacters(rawText: string): string[] {
  const lines = rawText.split("\n").slice(1); // skip the slug line (first line)
  const seen = new Set<string>();
  for (const line of lines) {
    const c = extractCharacterCue(line);
    if (c) seen.add(c);
  }
  return [...seen];
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
      autoNumber++;
      const num = match.sceneNumber ?? String(autoNumber);

      // If this number matches the current scene it's a running page header
      // repeating the slug at the top of a continuation page — skip it.
      if (current !== null && current.sceneNumber === num) continue;

      if (current) scenes.push(current);
      current = {
        sceneNumber: num,
        slugLine: match.cleanSlug,
        intExt: match.intExt,
        location: match.location,
        timeOfDay: match.timeOfDay,
        pageStart: page,
        rawText: match.cleanSlug + "\n",
        characters: [],
      };
    } else if (current && trimmed !== "") {
      current.rawText += trimmed + "\n";
    }
  }
  if (current) scenes.push(current);

  // Final dedup: remove duplicate scene numbers caused by a scene index
  // (table of contents) at the start of the PDF. Index entries contain only
  // the slug line; real scenes have dialogue/action text. Keep the occurrence
  // with the most raw text — that's always the real scene.
  const best = new Map<string, ParsedScene>();
  for (const s of scenes) {
    const existing = best.get(s.sceneNumber);
    if (!existing || s.rawText.length > existing.rawText.length) {
      best.set(s.sceneNumber, s);
    }
  }
  const kept = new Set(best.values());
  const deduped = scenes.filter(s => kept.has(s));

  // Remove stub scenes: matches where no body text was accumulated after the
  // slug line. These are false positives from location lists, scene indices, or
  // other structured sections in the PDF that happened to match a slug pattern.
  const withBody = deduped.filter(s => {
    const bodyText = s.rawText.split("\n").slice(1).join("\n").trim();
    return bodyText.length > 0;
  });

  // Gap detection: scripts with a locations appendix or other numbered sections
  // produce a large jump in scene numbers (e.g. real scenes 1–55, appendix 82–136).
  // Sort by the leading integer, find the first gap that is more than 5× the
  // largest gap seen so far (minimum threshold of 10), and discard everything after.
  const leadingInt = (s: ParsedScene) => {
    const m = s.sceneNumber.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  };

  const numeric = withBody
    .map(s => ({ s, n: leadingInt(s) }))
    .filter((x): x is { s: ParsedScene; n: number } => x.n !== null)
    .sort((a, b) => a.n - b.n);

  if (numeric.length > 1) {
    let maxGapSoFar = 1;
    let cutoff: number | null = null;
    for (let i = 1; i < numeric.length; i++) {
      const gap = numeric[i].n - numeric[i - 1].n;
      if (gap > Math.max(maxGapSoFar * 5, 10)) {
        cutoff = numeric[i].n;
        break;
      }
      if (gap > maxGapSoFar) maxGapSoFar = gap;
    }
    if (cutoff !== null) {
      return withBody.filter(s => {
        const n = leadingInt(s);
        return n === null || n < cutoff!;
      });
    }
  }

  return withBody.map(s => ({ ...s, characters: extractCharacters(s.rawText) }));
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
