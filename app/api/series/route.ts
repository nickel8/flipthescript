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

async function isOwner(productionId: string, userId: string): Promise<boolean> {
  const res = await dbFetch(`productions?id=eq.${productionId}&owner_id=eq.${userId}&select=id`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function isMember(productionId: string, userId: string): Promise<boolean> {
  const [prodRes, memRes] = await Promise.all([
    dbFetch(`productions?id=eq.${productionId}&owner_id=eq.${userId}&select=id`),
    dbFetch(`production_members?production_id=eq.${productionId}&user_id=eq.${userId}&select=id`),
  ]);
  const [prods, mems] = await Promise.all([prodRes.json(), memRes.json()]);
  return (Array.isArray(prods) && prods.length > 0) || (Array.isArray(mems) && mems.length > 0);
}

// GET /api/series?productionId=...
export async function GET(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const productionId = req.nextUrl.searchParams.get("productionId");
  if (!productionId) return NextResponse.json({ error: "productionId required" }, { status: 400 });

  if (!(await isMember(productionId, session.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = await dbFetch(
    `series?production_id=eq.${productionId}&order=series_number.asc&select=id,series_number,name,status,created_at`
  );
  const rows = await res.json();
  return NextResponse.json(Array.isArray(rows) ? rows : []);
}

// POST /api/series — owner only
export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { productionId, series_number, name } = await req.json();
  if (!productionId || !series_number)
    return NextResponse.json({ error: "productionId and series_number required" }, { status: 400 });

  if (!(await isOwner(productionId, session.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = await dbFetch("series", {
    method: "POST",
    headers: { Prefer: "return=representation" } as Record<string, string>,
    body: JSON.stringify({
      production_id: productionId,
      series_number,
      name: name?.trim() || `Series ${series_number}`,
      status: "prep",
    }),
  });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });

  return NextResponse.json(rows[0]);
}

// PATCH /api/series — update status or name, owner only
export async function PATCH(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id, status, name } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const seriesRes = await dbFetch(`series?id=eq.${id}&select=production_id`);
  const seriesRows = await seriesRes.json();
  if (!Array.isArray(seriesRows) || seriesRows.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await isOwner(seriesRows[0].production_id, session.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const update: Record<string, unknown> = {};
  if (status) update.status = status;
  if (name) update.name = name.trim();

  const res = await dbFetch(`series?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" } as Record<string, string>,
    body: JSON.stringify(update),
  });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
