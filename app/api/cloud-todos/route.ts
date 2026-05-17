import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function db(path: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      ...(options.headers ?? {}),
    },
  });
}

// POST — create a todo
export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { production_id, scene_cloud_id, title } = await req.json();
  if (!production_id || !title) {
    return NextResponse.json({ error: "production_id and title required" }, { status: 400 });
  }

  // Verify user owns this production
  const prodRes = await db(`productions?id=eq.${production_id}&owner_id=eq.${session.id}&select=id`);
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Resolve scene_cloud_id → scene PK id
  let scene_id: string | null = null;
  if (scene_cloud_id) {
    const sceneRes = await db(`scenes?cloud_id=eq.${scene_cloud_id}&select=id`);
    const sceneRows = await sceneRes.json();
    scene_id = Array.isArray(sceneRows) && sceneRows.length > 0 ? sceneRows[0].id : null;
  }

  const row: Record<string, unknown> = {
    production_id,
    title,
    is_done: false,
    user_id: session.id,
  };
  if (scene_id) row.scene_id = scene_id;

  const res = await db("todos?select=id,title,is_done,scene_id,scenes(cloud_id)", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  const [raw] = await res.json();
  return NextResponse.json(normaliseTodo(raw));
}

// PATCH — toggle is_done
export async function PATCH(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, is_done } = await req.json();

  // Verify ownership via production join
  const existRes = await db(
    `todos?id=eq.${id}&select=id,productions!inner(owner_id)`
  );
  const rows = await existRes.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || row.productions?.owner_id !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patchRes = await db(`todos?id=eq.${id}&select=id,title,is_done,scene_id,scenes(cloud_id)`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ is_done }),
  });

  if (!patchRes.ok) {
    return NextResponse.json({ error: await patchRes.text() }, { status: 500 });
  }

  const [updated] = await patchRes.json();
  return NextResponse.json(normaliseTodo(updated));
}

// DELETE
export async function DELETE(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();

  const existRes = await db(
    `todos?id=eq.${id}&select=id,productions!inner(owner_id)`
  );
  const rows = await existRes.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || row.productions?.owner_id !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db(`todos?id=eq.${id}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}

// Normalise DB row → client shape (scene_cloud_id instead of scene_id + scenes join)
function normaliseTodo(raw: Record<string, unknown>) {
  return {
    id: raw.id,
    title: raw.title,
    is_done: raw.is_done,
    scene_cloud_id: (raw.scenes as { cloud_id?: string }[] | null)?.[0]?.cloud_id ?? null,
  };
}
