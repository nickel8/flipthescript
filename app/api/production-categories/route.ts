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
      ...(init?.headers as Record<string, string>),
    },
  });
}

async function ownerOrCollaborator(productionId: string, userId: string) {
  const res = await db(
    `productions?id=eq.${productionId}&select=owner_id`
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return false;
  if (rows[0].owner_id === userId) return true;
  const mRes = await db(
    `production_members?production_id=eq.${productionId}&user_id=eq.${userId}&select=role`
  );
  const members = await mRes.json();
  return Array.isArray(members) && members.length > 0 &&
    (members[0].role === "collaborator" || members[0].role === "dept_owner");
}

// GET /api/production-categories?productionId=xxx
export async function GET(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const productionId = req.nextUrl.searchParams.get("productionId");
  if (!productionId) return NextResponse.json({ error: "productionId required" }, { status: 400 });

  const res = await db(
    `production_categories?production_id=eq.${productionId}&order=display_order.asc,name.asc&select=name,display_order`
  );
  const rows = await res.json();
  return NextResponse.json(Array.isArray(rows) ? rows : []);
}

// POST /api/production-categories — { productionId, name }
export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productionId, name } = await req.json();
  if (!productionId || !name) return NextResponse.json({ error: "productionId and name required" }, { status: 400 });

  if (!(await ownerOrCollaborator(productionId, session.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get display_order from library if it exists, otherwise append at end
  const libRes = await db(`category_library?name=eq.${encodeURIComponent(name)}&select=display_order`);
  const libRows = await libRes.json();
  const displayOrder = Array.isArray(libRows) && libRows.length > 0 ? libRows[0].display_order : 999;

  const insertRes = await db(`production_categories`, {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify({ production_id: productionId, name, display_order: displayOrder }),
  });
  const inserted = await insertRes.json();
  return NextResponse.json(Array.isArray(inserted) ? inserted[0] : inserted);
}

// DELETE /api/production-categories — { productionId, name }
export async function DELETE(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productionId, name } = await req.json();
  if (!productionId || !name) return NextResponse.json({ error: "productionId and name required" }, { status: 400 });

  if (!(await ownerOrCollaborator(productionId, session.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db(
    `production_categories?production_id=eq.${productionId}&name=eq.${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
  return NextResponse.json({ ok: true });
}
