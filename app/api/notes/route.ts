import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

function db(path: string, init: RequestInit = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers as object | undefined) },
  });
}

type EntityType = "production" | "series" | "block" | "episode" | "scene" | "element";

// Check if user can edit (owner, collaborator, or dept_owner — not viewer).
async function isCanEdit(productionId: string, userId: string): Promise<boolean> {
  const prodRes = await db(`productions?id=eq.${productionId}&owner_id=eq.${userId}&select=id`);
  const prods = await prodRes.json();
  if (Array.isArray(prods) && prods.length > 0) return true;
  const memRes = await db(
    `production_members?production_id=eq.${productionId}&user_id=eq.${userId}&select=role`
  );
  const mems = await memRes.json();
  if (!Array.isArray(mems) || mems.length === 0) return false;
  const role = mems[0].role as string;
  return role === "collaborator" || role === "dept_owner";
}

// Resolve cloudId → productionId and verify the session user is a member.
async function resolveProduction(
  cloudId: string,
  userId: string
): Promise<string | null> {
  const res = await db(`productions?cloud_id=eq.${cloudId}&select=id,owner_id`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const prod = rows[0] as { id: string; owner_id: string };
  if (prod.owner_id === userId) return prod.id;
  const memRes = await db(
    `production_members?production_id=eq.${prod.id}&user_id=eq.${userId}&select=id`
  );
  const mems = await memRes.json();
  if (!Array.isArray(mems) || mems.length === 0) return null;
  return prod.id;
}

// Build PostgREST filter for the requested entity.
function entityFilter(type: EntityType, id: string | null): string {
  switch (type) {
    case "production": return "series_id=is.null&block_id=is.null&episode_id=is.null&scene_id=is.null&element_id=is.null";
    case "series":     return `series_id=eq.${id}&block_id=is.null&episode_id=is.null&scene_id=is.null&element_id=is.null`;
    case "block":      return `block_id=eq.${id}&episode_id=is.null&scene_id=is.null&element_id=is.null`;
    case "episode":    return `episode_id=eq.${id}&scene_id=is.null&element_id=is.null`;
    case "scene":      return `scene_id=eq.${id}&element_id=is.null`;
    case "element":    return `element_id=eq.${id}`;
  }
}

// Build insert body FK columns from entity type + id.
function entityFKs(type: EntityType, id: string): Record<string, string> {
  if (type === "production") return {};
  const col: Record<EntityType, string> = {
    production: "",
    series:     "series_id",
    block:      "block_id",
    episode:    "episode_id",
    scene:      "scene_id",
    element:    "element_id",
  };
  return { [col[type]]: id };
}

// GET /api/notes?cloudId=&entityType=&entityId=
// GET /api/notes?cloudId=&allBreakdown=true  — all on_breakdown notes for scene grid
export async function GET(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const cloudId      = searchParams.get("cloudId");
  const entityType   = searchParams.get("entityType") as EntityType | null;
  const entityId     = searchParams.get("entityId");
  const allBreakdown = searchParams.get("allBreakdown") === "true";
  const allScenes    = searchParams.get("allScenes") === "true";

  if (!cloudId)
    return NextResponse.json({ error: "cloudId required" }, { status: 400 });

  const productionId = await resolveProduction(cloudId, session.id);
  if (!productionId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (allBreakdown) {
    const res = await db(
      `notes?production_id=eq.${productionId}&on_breakdown=eq.true&scene_id=not.is.null` +
      `&order=created_at.asc&select=scene_id,body,tag`
    );
    const rows = await res.json();
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  }

  if (allScenes) {
    const res = await db(
      `notes?production_id=eq.${productionId}&scene_id=not.is.null` +
      `&order=created_at.asc&select=id,body,scene_id`
    );
    const rows = await res.json();
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  }

  if (!entityType)
    return NextResponse.json({ error: "entityType required" }, { status: 400 });

  const filter = entityFilter(entityType, entityId);
  const res = await db(
    `notes?production_id=eq.${productionId}&${filter}&order=created_at.asc&select=id,body,author_id,tag,on_breakdown,created_at,updated_at`
  );
  const rows = await res.json();
  return NextResponse.json(Array.isArray(rows) ? rows : []);
}

// POST /api/notes — { cloudId, entityType, entityId, body, tag?, onBreakdown? }
export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { cloudId, entityType, entityId, body, tag, onBreakdown } = await req.json();
  if (!cloudId || !entityType || !body?.trim())
    return NextResponse.json({ error: "cloudId, entityType, and body required" }, { status: 400 });

  const productionId = await resolveProduction(cloudId, session.id);
  if (!productionId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // on_breakdown requires canEdit (owner or collaborator/dept_owner, not viewer)
  const canEditBd = onBreakdown ? await isCanEdit(productionId, session.id) : true;
  if (!canEditBd) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const insert = {
    production_id: productionId,
    author_id: session.id,
    body: body.trim(),
    tag: tag ?? null,
    on_breakdown: onBreakdown === true,
    ...entityFKs(entityType as EntityType, entityId),
  };

  const res = await db("notes", {
    method: "POST",
    headers: { Prefer: "return=representation" } as Record<string, string>,
    body: JSON.stringify(insert),
  });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });

  return NextResponse.json(rows[0]);
}

// PATCH /api/notes — { id, body?, tag?, onBreakdown? }  (author only)
export async function PATCH(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const payload = await req.json();
  const { id, body, tag, onBreakdown } = payload;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // If setting on_breakdown=true, verify canEdit via the note's production
  if (onBreakdown === true) {
    const noteRes = await db(`notes?id=eq.${id}&author_id=eq.${session.id}&select=production_id`);
    const noteRows = await noteRes.json();
    if (!Array.isArray(noteRows) || noteRows.length === 0)
      return NextResponse.json({ error: "Not found or not author" }, { status: 404 });
    const canEdit = await isCanEdit(noteRows[0].production_id, session.id);
    if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.trim()) update.body = body.trim();
  if ("tag" in payload) update.tag = tag ?? null;
  if ("onBreakdown" in payload) update.on_breakdown = onBreakdown;

  const res = await db(`notes?id=eq.${id}&author_id=eq.${session.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" } as Record<string, string>,
    body: JSON.stringify(update),
  });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "Not found or not author" }, { status: 404 });

  return NextResponse.json(rows[0]);
}

// DELETE /api/notes — { id }  (author only)
export async function DELETE(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db(`notes?id=eq.${id}&author_id=eq.${session.id}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}
