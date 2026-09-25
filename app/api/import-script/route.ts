import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";
import type { ParsedScene } from "@/lib/script-parser";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = {
  "Content-Type": "application/json",
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
};

interface ImportBody {
  productionId: string;
  filename: string;
  version: string;
  blobUrl: string;
  scenes: ParsedScene[];
  mode: "blank" | "inherit";
  currentScriptId: string | null;
}

// Breakdown data from an existing scene that we'll copy forward
interface OldBreakdown {
  synopsis: string;
  notes: string;
  is_reviewed: boolean;
  scene_elements: Array<{ element_id: string; notes: string }>;
}

export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body: ImportBody = await req.json();
  const { productionId, filename, version, blobUrl, scenes, mode, currentScriptId } = body;

  if (!productionId || !scenes?.length) {
    return NextResponse.json({ error: "productionId and scenes required" }, { status: 400 });
  }

  // Verify caller owns this production
  const prodCheck = await fetch(
    `${SB_URL}/rest/v1/productions?id=eq.${productionId}&owner_id=eq.${session.id}&select=id`,
    { headers: HEADERS }
  );
  const prodRows = await prodCheck.json();
  if (!Array.isArray(prodRows) || prodRows.length === 0) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  // ── Inherit mode: fetch existing breakdown data keyed by scene_number ────────
  const breakdownMap = new Map<string, OldBreakdown>();

  if (mode === "inherit" && currentScriptId) {
    const oldScenesRes = await fetch(
      `${SB_URL}/rest/v1/scenes?script_id=eq.${currentScriptId}&is_deleted=eq.false` +
        `&select=scene_number,breakdown_sheets(synopsis,notes,is_reviewed,scene_elements(element_id,notes))`,
      { headers: HEADERS }
    );
    const oldScenes = await oldScenesRes.json();

    if (Array.isArray(oldScenes)) {
      for (const s of oldScenes) {
        const sheet = Array.isArray(s.breakdown_sheets) ? s.breakdown_sheets[0] : null;
        if (sheet) {
          breakdownMap.set(s.scene_number, {
            synopsis: sheet.synopsis ?? "",
            notes: sheet.notes ?? "",
            is_reviewed: sheet.is_reviewed ?? false,
            scene_elements: (sheet.scene_elements ?? []).map(
              (se: { element_id: string; notes: string }) => ({
                element_id: se.element_id,
                notes: se.notes ?? "",
              })
            ),
          });
        }
      }
    }

    // Mark the old script as no longer current
    await fetch(`${SB_URL}/rest/v1/scripts?id=eq.${currentScriptId}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ is_current: false }),
    });
  }

  // ── Find or create default episode ──────────────────────────────────────────
  const epRes = await fetch(
    `${SB_URL}/rest/v1/episodes?production_id=eq.${productionId}&is_default=eq.true&select=id&limit=1`,
    { headers: HEADERS }
  );
  const epRows = await epRes.json();

  let episodeId: string;
  if (Array.isArray(epRows) && epRows.length > 0) {
    episodeId = epRows[0].id;
  } else {
    const newEp = await fetch(`${SB_URL}/rest/v1/episodes`, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "return=representation" },
      body: JSON.stringify({
        cloud_id: crypto.randomUUID(),
        production_id: productionId,
        name: "Episode 1",
        number: 1,
        is_default: true,
      }),
    });
    const [ep] = await newEp.json();
    episodeId = ep.id;
  }

  // ── Create new script record ─────────────────────────────────────────────────
  const scriptRes = await fetch(`${SB_URL}/rest/v1/scripts`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({
      cloud_id: crypto.randomUUID(),
      episode_id: episodeId,
      version: version || "v1",
      filename,
      blob_url: blobUrl,
      imported_at: new Date().toISOString(),
      is_current: true,
    }),
  });
  const [script] = await scriptRes.json();
  if (!script?.id) {
    return NextResponse.json({ error: "Failed to create script record" }, { status: 500 });
  }

  // ── Insert scenes ────────────────────────────────────────────────────────────
  const sceneRows = scenes.map((s, i) => ({
    cloud_id: crypto.randomUUID(),
    script_id: script.id,
    scene_number: s.sceneNumber,
    slug_line: s.slugLine,
    int_ext: s.intExt,
    location: s.location,
    time_of_day: s.timeOfDay,
    page_start: s.pageStart,
    raw_text: s.rawText,
    revision_status: "Unchanged",
    shoot_day: 0,
    shoot_order: i + 1,
    is_complete: false,
    is_deleted: false,
  }));

  const CHUNK = 100;
  const insertedSceneIds: Array<{ id: string; scene_number: string }> = [];

  for (let i = 0; i < sceneRows.length; i += CHUNK) {
    const chunk = sceneRows.slice(i, i + CHUNK);
    const r = await fetch(`${SB_URL}/rest/v1/scenes`, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "return=representation" },
      body: JSON.stringify(chunk),
    });
    if (!r.ok) {
      return NextResponse.json({ error: `Scene insert failed: ${await r.text()}` }, { status: 500 });
    }
    const inserted = await r.json();
    insertedSceneIds.push(
      ...inserted.map((row: { id: string; scene_number: string }) => ({
        id: row.id,
        scene_number: row.scene_number,
      }))
    );
  }

  // ── Inherit mode: copy breakdown data to matched scenes ─────────────────────
  if (mode === "inherit" && breakdownMap.size > 0) {
    for (const { id: newSceneId, scene_number } of insertedSceneIds) {
      const old = breakdownMap.get(scene_number);
      if (!old) continue;

      // Create breakdown sheet
      const sheetRes = await fetch(`${SB_URL}/rest/v1/breakdown_sheets`, {
        method: "POST",
        headers: { ...HEADERS, Prefer: "return=representation" },
        body: JSON.stringify({
          cloud_id: crypto.randomUUID(),
          scene_id: newSceneId,
          synopsis: old.synopsis,
          notes: old.notes,
          is_reviewed: old.is_reviewed,
        }),
      });
      if (!sheetRes.ok) continue;
      const [newSheet] = await sheetRes.json();

      // Copy scene elements
      if (old.scene_elements.length > 0) {
        await fetch(`${SB_URL}/rest/v1/scene_elements`, {
          method: "POST",
          headers: { ...HEADERS, Prefer: "return=minimal" },
          body: JSON.stringify(
            old.scene_elements.map((se) => ({
              cloud_id: crypto.randomUUID(),
              breakdown_sheet_id: newSheet.id,
              element_id: se.element_id,
              notes: se.notes,
            }))
          ),
        });
      }
    }
  }

  // ── Auto-populate characters from parsed scene data ─────────────────────────
  // Build a map of scene_number → characters, skipping scenes with no characters.
  const sceneCharMap = new Map<string, string[]>();
  for (const s of scenes) {
    if (s.characters?.length) sceneCharMap.set(s.sceneNumber, s.characters);
  }

  if (sceneCharMap.size > 0) {
    // Collect unique character names across all scenes
    const allChars = new Set<string>();
    for (const chars of sceneCharMap.values()) {
      for (const c of chars) allChars.add(c);
    }

    // Ensure "Characters" category exists for this production
    await fetch(`${SB_URL}/rest/v1/production_categories`, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify({ production_id: productionId, name: "Characters", display_order: 10 }),
    });

    // Create an element per unique character (skip if already exists)
    const elemRes = await fetch(`${SB_URL}/rest/v1/elements`, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify(
        [...allChars].map(name => ({
          cloud_id: crypto.randomUUID(),
          production_id: productionId,
          name,
          category: "Characters",
          notes: "",
        }))
      ),
    });
    const insertedElements: Array<{ id: string; name: string }> = await elemRes.json();
    const elementIdByName = new Map(
      Array.isArray(insertedElements) ? insertedElements.map(e => [e.name, e.id]) : []
    );

    // Create breakdown sheets for scenes that have characters
    const sceneIdByNumber = new Map(insertedSceneIds.map(x => [x.scene_number, x.id]));
    const sheetRows = [...sceneCharMap.keys()]
      .map(num => {
        const sceneId = sceneIdByNumber.get(num);
        return sceneId ? { cloud_id: crypto.randomUUID(), scene_id: sceneId } : null;
      })
      .filter((r): r is { cloud_id: string; scene_id: string } => r !== null);

    if (sheetRows.length > 0) {
      const sheetRes = await fetch(`${SB_URL}/rest/v1/breakdown_sheets`, {
        method: "POST",
        headers: { ...HEADERS, Prefer: "return=representation" },
        body: JSON.stringify(sheetRows),
      });
      const insertedSheets: Array<{ id: string; scene_id: string }> = await sheetRes.json();

      // Map scene_id → sheet_id
      const sheetIdBySceneId = new Map(
        Array.isArray(insertedSheets) ? insertedSheets.map(sh => [sh.scene_id, sh.id]) : []
      );

      // Build scene_elements rows: one per (sheet, character)
      const seRows: Array<{ cloud_id: string; breakdown_sheet_id: string; element_id: string }> = [];
      for (const [sceneNum, chars] of sceneCharMap) {
        const sceneId = sceneIdByNumber.get(sceneNum);
        if (!sceneId) continue;
        const sheetId = sheetIdBySceneId.get(sceneId);
        if (!sheetId) continue;
        for (const char of chars) {
          const elementId = elementIdByName.get(char);
          if (elementId) {
            seRows.push({ cloud_id: crypto.randomUUID(), breakdown_sheet_id: sheetId, element_id: elementId });
          }
        }
      }

      if (seRows.length > 0) {
        await fetch(`${SB_URL}/rest/v1/scene_elements`, {
          method: "POST",
          headers: { ...HEADERS, Prefer: "return=minimal" },
          body: JSON.stringify(seRows),
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    scriptId: script.id,
    sceneCount: scenes.length,
    inheritedCount: mode === "inherit" ? breakdownMap.size : 0,
    charactersFound: [...new Set(scenes.flatMap(s => s.characters ?? []))].length,
  });
}
