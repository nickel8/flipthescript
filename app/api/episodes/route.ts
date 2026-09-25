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

// PATCH /api/episodes — update block_id, episode_number, title, or status
export async function PATCH(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await req.json();
  const { id, episode_number, title, status } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Resolve production_id from episode
  const epRes = await dbFetch(`episodes?id=eq.${id}&select=production_id`);
  const epRows = await epRes.json();
  if (!Array.isArray(epRows) || epRows.length === 0)
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });

  if (!(await isMember(epRows[0].production_id, session.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const update: Record<string, unknown> = {};
  // block_id can be explicitly null to unassign
  if ("block_id" in body) update.block_id = body.block_id ?? null;
  if (episode_number !== undefined) update.episode_number = episode_number;
  if (title !== undefined) update.title = title;
  if (status) update.status = status;

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const res = await dbFetch(`episodes?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" } as Record<string, string>,
    body: JSON.stringify(update),
  });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
