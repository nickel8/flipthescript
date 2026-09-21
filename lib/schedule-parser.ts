import { extractLinesFromPdf } from "./script-parser";

export interface ScheduleEntry {
  sceneNumber: string;
  shootDay: number;
  shootOrder: number; // 1-based position within the day
}

// Matches: "Shoot Day # 1 Saturday..." or "Shoot Day # 2..."
const DAY_RE = /Shoot\s+Day\s+#\s*(\d+)/i;

// Matches: "Scene # 2   description..." or "Scene #  1A ..."
// Captures scene number including optional trailing letter (e.g. 4A)
const SCENE_RE = /^Scene\s*#\s*(\d+[A-Za-z]?)/i;

export async function parseSchedule(buffer: ArrayBuffer): Promise<ScheduleEntry[]> {
  const lines = await extractLinesFromPdf(buffer);

  const entries: ScheduleEntry[] = [];
  let currentDay = 0;
  let currentOrder = 0;

  for (const { line } of lines) {
    const trimmed = line.trim();

    const dayMatch = trimmed.match(DAY_RE);
    if (dayMatch) {
      currentDay = parseInt(dayMatch[1], 10);
      currentOrder = 0;
      continue;
    }

    const sceneMatch = trimmed.match(SCENE_RE);
    if (sceneMatch && currentDay > 0) {
      currentOrder++;
      entries.push({
        sceneNumber: sceneMatch[1],
        shootDay: currentDay,
        shootOrder: currentOrder,
      });
    }
  }

  return entries;
}
