import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function db(path: string, init?: RequestInit) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

// GET /api/element-flags?productionId=xxx
// Returns current user's flags for the production, with element + scene context
export async function GET(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const productionId = req.nextUrl.searchParams.get("productionId");
  if (!productionId) return NextResponse.json({ error: "productionId required" }, { status: 400 });

  const res = await db(
    `element_flags?production_id=eq.${productionId}&user_id=eq.${session.id}` +
      `&order=due_date.asc.nullslast,created_at.asc` +
      `&select=id,note,due_date,is_done,scene_element_id,` +
      `scene_elements(elements(name,category),breakdown_sheets(scenes(scene_number,location,int_ext,cloud_id)))`
  );
  const rows = await res.json();
  return NextResponse.json(Array.isArray(rows) ? rows : []);
}

// POST /api/element-flags — { sceneElementId, productionId }
export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sceneElementId, productionId } = await req.json();
  if (!sceneElementId || !productionId) {
    return NextResponse.json({ error: "sceneElementId and productionId required" }, { status: 400 });
  }

  const res = await db(`element_flags`, {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify({
      scene_element_id: sceneElementId,
      production_id: productionId,
      user_id: session.id,
    }),
  });
  const data = await res.json();
  return NextResponse.json(Array.isArray(data) ? data[0] : data);
}

// PATCH /api/element-flags — { id, note?, dueDate?, isDone? }
export async function PATCH(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, note, dueDate, isDone } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (note !== undefined) patch.note = note;
  if (dueDate !== undefined) patch.due_date = dueDate ?? null;
  if (isDone !== undefined) patch.is_done = isDone;

  // Scope update to the current user's own flags only
  const res = await db(`element_flags?id=eq.${id}&user_id=eq.${session.id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  return NextResponse.json(Array.isArray(data) ? data[0] : data);
}

// DELETE /api/element-flags — { id }
export async function DELETE(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db(`element_flags?id=eq.${id}&user_id=eq.${session.id}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}
