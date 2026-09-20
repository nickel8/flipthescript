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
  productionId: string; // internal Supabase UUID
  filename: string;
  version: string;
  blobUrl: string;
  scenes: ParsedScene[];
}

export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body: ImportBody = await req.json();
  const { productionId, filename, version, blobUrl, scenes } = body;

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

  // Find or create a default episode
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

  // Create the script record (stores blob URL for later PDF viewing)
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

  // Upsert all scenes (batch in chunks of 100 to stay under Supabase limits)
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
  for (let i = 0; i < sceneRows.length; i += CHUNK) {
    const chunk = sceneRows.slice(i, i + CHUNK);
    const r = await fetch(`${SB_URL}/rest/v1/scenes`, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "return=minimal" },
      body: JSON.stringify(chunk),
    });
    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json({ error: `Scene insert failed: ${err}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, scriptId: script.id, sceneCount: scenes.length });
}
