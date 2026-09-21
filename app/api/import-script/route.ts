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

  return NextResponse.json({
    ok: true,
    scriptId: script.id,
    sceneCount: scenes.length,
    inheritedCount: mode === "inherit" ? breakdownMap.size : 0,
  });
}
