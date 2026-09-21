import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";
import { parseSchedule } from "@/lib/schedule-parser";

export const maxDuration = 60;

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = {
  "Content-Type": "application/json",
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
};

export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("pdf") as File | null;
  const productionId = form.get("productionId") as string | null;

  if (!file || !productionId) {
    return NextResponse.json({ error: "PDF and productionId required" }, { status: 400 });
  }

  // Verify ownership
  const prodRes = await fetch(
    `${SB_URL}/rest/v1/productions?id=eq.${productionId}&owner_id=eq.${session.id}&select=id`,
    { headers: HEADERS }
  );
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  // Parse the schedule PDF
  const buffer = await file.arrayBuffer();
  const entries = await parseSchedule(buffer);

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "No scenes found in schedule. Check the PDF is a shooting schedule." },
      { status: 422 }
    );
  }

  // Get current script's scenes for this production
  const epRes = await fetch(
    `${SB_URL}/rest/v1/episodes?production_id=eq.${productionId}&select=id`,
    { headers: HEADERS }
  );
  const episodes = await epRes.json();
  if (!Array.isArray(episodes) || episodes.length === 0) {
    return NextResponse.json({ error: "No episodes found" }, { status: 404 });
  }
  const epIds = episodes.map((e: { id: string }) => e.id).join(",");

  const scriptsRes = await fetch(
    `${SB_URL}/rest/v1/scripts?episode_id=in.(${epIds})&is_current=eq.true&select=id`,
    { headers: HEADERS }
  );
  const scripts = await scriptsRes.json();
  if (!Array.isArray(scripts) || scripts.length === 0) {
    return NextResponse.json({ error: "No current script found" }, { status: 404 });
  }
  const scriptIds = scripts.map((s: { id: string }) => s.id).join(",");

  const scenesRes = await fetch(
    `${SB_URL}/rest/v1/scenes?script_id=in.(${scriptIds})&is_deleted=eq.false&select=id,scene_number`,
    { headers: HEADERS }
  );
  const scenes = await scenesRes.json() as Array<{ id: string; scene_number: string }>;
  const sceneMap = new Map(scenes.map((s) => [s.scene_number, s.id]));

  // Update each matched scene
  const notFound: string[] = [];
  let updated = 0;

  for (const entry of entries) {
    const sceneId = sceneMap.get(entry.sceneNumber);
    if (!sceneId) {
      notFound.push(entry.sceneNumber);
      continue;
    }

    await fetch(`${SB_URL}/rest/v1/scenes?id=eq.${sceneId}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({
        shoot_day: entry.shootDay,
        shoot_order: entry.shootOrder,
      }),
    });
    updated++;
  }

  return NextResponse.json({ updated, notFound, total: entries.length });
}
