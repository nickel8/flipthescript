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

async function isOwnerOrMember(productionId: string, userId: string): Promise<boolean> {
  const [prodRes, memRes] = await Promise.all([
    dbFetch(`productions?id=eq.${productionId}&owner_id=eq.${userId}&select=id`),
    dbFetch(`production_members?production_id=eq.${productionId}&user_id=eq.${userId}&select=id`),
  ]);
  const [prods, mems] = await Promise.all([prodRes.json(), memRes.json()]);
  return (Array.isArray(prods) && prods.length > 0) || (Array.isArray(mems) && mems.length > 0);
}

// GET /api/blocks?productionId=...
export async function GET(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const productionId = req.nextUrl.searchParams.get("productionId");
  if (!productionId) return NextResponse.json({ error: "productionId required" }, { status: 400 });

  if (!(await isOwnerOrMember(productionId, session.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = await dbFetch(
    `blocks?production_id=eq.${productionId}&order=block_number.asc&select=id,block_number,label,status,series_id,wrapped_at,created_at`
  );
  const rows = await res.json();
  return NextResponse.json(Array.isArray(rows) ? rows : []);
}

// POST /api/blocks
export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { productionId, block_number, label, series_id } = await req.json();
  if (!productionId || !label)
    return NextResponse.json({ error: "productionId and label required" }, { status: 400 });

  if (!(await isOwnerOrMember(productionId, session.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = await dbFetch("blocks", {
    method: "POST",
    headers: { Prefer: "return=representation" } as Record<string, string>,
    body: JSON.stringify({
      production_id: productionId,
      block_number: block_number ?? 1,
      label,
      status: "prep",
      series_id: series_id ?? null,
    }),
  });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });

  return NextResponse.json(rows[0]);
}

// PATCH /api/blocks — update status (and optionally label)
export async function PATCH(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id, status, label } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Verify access via production_id on the block
  const blockRes = await dbFetch(`blocks?id=eq.${id}&select=production_id`);
  const blockRows = await blockRes.json();
  if (!Array.isArray(blockRows) || blockRows.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await isOwnerOrMember(blockRows[0].production_id, session.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const update: Record<string, unknown> = {};
  if (status) {
    update.status = status;
    update.wrapped_at = status === "wrapped" ? new Date().toISOString() : null;
  }
  if (label) update.label = label;

  const res = await dbFetch(`blocks?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" } as Record<string, string>,
    body: JSON.stringify(update),
  });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, wrapped_at: rows[0].wrapped_at ?? null });
}
