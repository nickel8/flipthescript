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

// Accept either a Bearer token (Mac app) or cookie session (web viewer)
async function resolveUser(req: NextRequest): Promise<{ id: string } | null> {
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
  if (jwt) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${jwt}` },
    });
    if (res.ok) {
      const user = await res.json();
      if (user?.id) return { id: user.id };
    }
  }
  return getCloudSession();
}

// GET — fetch todos for a production (Mac app pull sync)
export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const productionCloudId = req.nextUrl.searchParams.get("productionCloudId");
  if (!productionCloudId) return NextResponse.json({ error: "productionCloudId required" }, { status: 400 });

  const prodRes = await db(`productions?cloud_id=eq.${productionCloudId}&owner_id=eq.${user.id}&select=id`);
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const productionId = prods[0].id;

  const todosRes = await db(
    `todos?production_id=eq.${productionId}&select=id,cloud_id,title,is_done,created_at,scene_id,scenes(cloud_id)`
  );
  if (!todosRes.ok) return NextResponse.json({ error: await todosRes.text() }, { status: 500 });

  const raw = await todosRes.json();
  const todos = Array.isArray(raw) ? raw.map((t: Record<string, unknown>) => ({
    cloudId:      t.cloud_id,
    title:        t.title,
    isDone:       t.is_done,
    createdAt:    t.created_at,
    sceneCloudId: (t.scenes as { cloud_id?: string }[] | null)?.[0]?.cloud_id ?? null,
  })) : [];

  return NextResponse.json(todos);
}

// POST — create a todo
export async function POST(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { production_cloud_id, scene_cloud_id, title } = await req.json();
  if (!production_cloud_id || !title) {
    return NextResponse.json({ error: "production_cloud_id and title required" }, { status: 400 });
  }

  // Resolve cloud_id → production PK (and verify ownership)
  const prodRes = await db(`productions?cloud_id=eq.${production_cloud_id}&owner_id=eq.${user.id}&select=id`);
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const production_id = prods[0].id;

  // Resolve scene_cloud_id → scene PK
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
    user_id: user.id,
  };
  if (scene_id) row.scene_id = scene_id;

  const res = await db("todos?select=id,cloud_id,title,is_done,scene_id,scenes(cloud_id)", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });

  const [raw] = await res.json();
  return NextResponse.json(normaliseTodo(raw));
}

// PATCH — toggle is_done
export async function PATCH(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, is_done } = await req.json();

  const existRes = await db(`todos?id=eq.${id}&select=id,productions!inner(owner_id)`);
  const rows = await existRes.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || row.productions?.owner_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patchRes = await db(`todos?id=eq.${id}&select=id,cloud_id,title,is_done,scene_id,scenes(cloud_id)`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ is_done }),
  });

  if (!patchRes.ok) return NextResponse.json({ error: await patchRes.text() }, { status: 500 });

  const [updated] = await patchRes.json();
  return NextResponse.json(normaliseTodo(updated));
}

// DELETE
export async function DELETE(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();

  const existRes = await db(`todos?id=eq.${id}&select=id,productions!inner(owner_id)`);
  const rows = await existRes.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || row.productions?.owner_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db(`todos?id=eq.${id}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}

function normaliseTodo(raw: Record<string, unknown>) {
  return {
    cloudId:      raw.cloud_id,
    title:        raw.title,
    isDone:       raw.is_done,
    sceneCloudId: (raw.scenes as { cloud_id?: string }[] | null)?.[0]?.cloud_id ?? null,
  };
}
