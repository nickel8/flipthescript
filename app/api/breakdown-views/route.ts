import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

function dbFetch(path: string, opts: RequestInit = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { ...HEADERS, ...(opts.headers as object | undefined) },
  });
}

async function isMember(productionId: string, userId: string): Promise<boolean> {
  const [prodRes, memRes] = await Promise.all([
    dbFetch(`productions?id=eq.${productionId}&owner_id=eq.${userId}&select=id`),
    dbFetch(`production_members?production_id=eq.${productionId}&user_id=eq.${userId}&select=id`),
  ]);
  const [prods, mems] = await Promise.all([prodRes.json(), memRes.json()]);
  return (Array.isArray(prods) && prods.length > 0) || (Array.isArray(mems) && mems.length > 0);
}

// GET /api/breakdown-views?productionId=...
// Returns all shared views for the production + the current user's private views.
export async function GET(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const productionId = req.nextUrl.searchParams.get("productionId");
  if (!productionId) return NextResponse.json({ error: "productionId required" }, { status: 400 });

  if (!(await isMember(productionId, session.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = await dbFetch(
    `breakdown_views?production_id=eq.${productionId}&order=created_at.asc` +
      `&select=id,name,is_shared,visible_cols,filters,sort,created_by`
  );
  const rows = await res.json();
  if (!Array.isArray(rows)) return NextResponse.json([]);

  // Return shared views + own private views
  const visible = rows.filter(
    (r: Record<string, unknown>) => r.is_shared || r.created_by === session.id
  );

  return NextResponse.json(
    visible.map((r: Record<string, unknown>) => ({
      id: r.id,
      name: r.name,
      isShared: r.is_shared,
      isOwn: r.created_by === session.id,
      visibleCols: r.visible_cols,
      filters: r.filters,
      sort: r.sort,
    }))
  );
}

// POST /api/breakdown-views
export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { productionId, name, isShared, visibleCols, filters, sort } = await req.json();
  if (!productionId || !name)
    return NextResponse.json({ error: "productionId and name required" }, { status: 400 });

  if (!(await isMember(productionId, session.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = await dbFetch(`breakdown_views`, {
    method: "POST",
    headers: { Prefer: "return=representation" } as Record<string, string>,
    body: JSON.stringify({
      production_id: productionId,
      created_by: session.id,
      name,
      is_shared: isShared ?? false,
      visible_cols: visibleCols ?? [],
      filters: filters ?? {},
      sort: sort ?? { col: null, dir: "asc" },
    }),
  });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    const detail = !Array.isArray(rows) ? (rows as Record<string, unknown>)?.message ?? "Failed to create" : "Failed to create";
    return NextResponse.json({ error: String(detail) }, { status: 500 });
  }

  const r = rows[0] as Record<string, unknown>;
  return NextResponse.json({
    id: r.id,
    name: r.name,
    isShared: r.is_shared,
    isOwn: true,
    visibleCols: r.visible_cols,
    filters: r.filters,
    sort: r.sort,
  });
}

// PATCH /api/breakdown-views  — toggle is_shared (only creator)
export async function PATCH(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id, isShared } = await req.json();
  if (!id || typeof isShared !== "boolean")
    return NextResponse.json({ error: "id and isShared required" }, { status: 400 });

  const res = await dbFetch(
    `breakdown_views?id=eq.${id}&created_by=eq.${session.id}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" } as Record<string, string>,
      body: JSON.stringify({ is_shared: isShared }),
    }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

  return NextResponse.json({ ok: true, isShared: rows[0].is_shared });
}

// DELETE /api/breakdown-views  — only the creator can delete
export async function DELETE(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const res = await dbFetch(
    `breakdown_views?id=eq.${id}&created_by=eq.${session.id}`,
    { method: "DELETE" }
  );

  if (!res.ok) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
