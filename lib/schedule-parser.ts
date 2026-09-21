import { extractLinesFromPdf } from "./script-parser";

export interface ScheduleEntry {
  sceneNumber: string;
  shootDay: number;
  shootOrder: number; // 1-based position within the day
}

export interface ScheduleResult {
  entries: ScheduleEntry[];
  // dayNumber → ISO date string "YYYY-MM-DD" (may be absent if no date found)
  dayDates: Map<number, string>;
}

// Matches: "Shoot Day # 1 Saturday..." or "Shoot Day # 2..."
const DAY_RE = /Shoot\s+Day\s+#\s*(\d+)/i;

// Matches: "Scene # 2   description..." or "Scene #  1A ..."
const SCENE_RE = /^Scene\s*#\s*(\d+[A-Za-z]?)/i;

// Matches day-month-year in text, e.g. "16 May 2026" or "May 16 2026" or "16 May, 2026"
const DATE_DMY_RE = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})/i;
const DATE_MDY_RE = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i;

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

function parseDate(text: string): string | null {
  const dmy = text.match(DATE_DMY_RE);
  if (dmy) {
    const [, day, month, year] = dmy;
    const mm = MONTHS[month.toLowerCase()];
    return `${year}-${mm}-${day.padStart(2, "0")}`;
  }
  const mdy = text.match(DATE_MDY_RE);
  if (mdy) {
    const [, month, day, year] = mdy;
    const mm = MONTHS[month.toLowerCase()];
    return `${year}-${mm}-${day.padStart(2, "0")}`;
  }
  return null;
}

export async function parseSchedule(buffer: ArrayBuffer): Promise<ScheduleResult> {
  const lines = await extractLinesFromPdf(buffer);

  const entries: ScheduleEntry[] = [];
  const dayDates = new Map<number, string>();
  let currentDay = 0;
  let currentOrder = 0;

  for (const { line } of lines) {
    const trimmed = line.trim();

    const dayMatch = trimmed.match(DAY_RE);
    if (dayMatch) {
      currentDay = parseInt(dayMatch[1], 10);
      currentOrder = 0;
      const date = parseDate(trimmed);
      if (date) dayDates.set(currentDay, date);
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

  return { entries, dayDates };
}
