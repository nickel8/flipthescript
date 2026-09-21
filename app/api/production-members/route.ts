import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = {
  "Content-Type": "application/json",
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
};

function dbFetch(path: string, opts?: RequestInit) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { ...HEADERS, ...(opts?.headers as Record<string, string>) },
    cache: "no-store",
    ...opts,
  });
}

// Verify session and that user is owner of the production
async function requireOwner(productionId: string) {
  const session = await getCloudSession();
  if (!session) return null;

  const res = await dbFetch(
    `productions?id=eq.${productionId}&owner_id=eq.${session.id}&select=id`
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return session;
}

// GET /api/production-members?productionId=xxx
// Returns members list with email addresses
export async function GET(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const productionId = req.nextUrl.searchParams.get("productionId");
  if (!productionId) return NextResponse.json({ error: "productionId required" }, { status: 400 });

  // Verify requester is owner
  const ownerRes = await dbFetch(
    `productions?id=eq.${productionId}&owner_id=eq.${session.id}&select=id`
  );
  const ownerRows = await ownerRes.json();
  if (!Array.isArray(ownerRows) || ownerRows.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch members
  const membersRes = await dbFetch(
    `production_members?production_id=eq.${productionId}&select=id,user_id,role,created_at&order=created_at.asc`
  );
  const members = await membersRes.json();

  // Fetch all auth users to get emails
  const usersRes = await fetch(`${SB_URL}/auth/v1/admin/users?per_page=200`, { headers: HEADERS });
  const usersData = await usersRes.json();
  const userMap = new Map<string, string>(
    (usersData.users ?? []).map((u: { id: string; email: string }) => [u.id, u.email])
  );

  const result = members.map((m: { id: string; user_id: string; role: string; created_at: string }) => ({
    id: m.id,
    userId: m.user_id,
    email: userMap.get(m.user_id) ?? m.user_id,
    role: m.role,
    createdAt: m.created_at,
  }));

  return NextResponse.json(result);
}

// POST /api/production-members
// Body: { productionId, email, role }
export async function POST(req: NextRequest) {
  const { productionId, email, role } = await req.json();

  if (!productionId || !email || !role) {
    return NextResponse.json({ error: "productionId, email, and role required" }, { status: 400 });
  }
  if (!["collaborator", "viewer"].includes(role)) {
    return NextResponse.json({ error: "role must be collaborator or viewer" }, { status: 400 });
  }

  const session = await requireOwner(productionId);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Look up user by email
  const usersRes = await fetch(`${SB_URL}/auth/v1/admin/users?per_page=200`, { headers: HEADERS });
  const usersData = await usersRes.json();
  const user = (usersData.users ?? []).find(
    (u: { email: string }) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    return NextResponse.json({ error: "No account found with that email. Ask your admin to create one." }, { status: 404 });
  }
  if (user.id === session.id) {
    return NextResponse.json({ error: "You are already the owner" }, { status: 400 });
  }

  // Upsert member
  const res = await dbFetch("production_members", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      production_id: productionId,
      user_id: user.id,
      role,
      invited_by: session.id,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: err.message ?? "Failed to add member" }, { status: res.status });
  }

  return NextResponse.json({ ok: true, email: user.email, role });
}

// PATCH /api/production-members
// Body: { productionId, userId, role }
export async function PATCH(req: NextRequest) {
  const { productionId, userId, role } = await req.json();

  if (!productionId || !userId || !role) {
    return NextResponse.json({ error: "productionId, userId, and role required" }, { status: 400 });
  }
  if (!["collaborator", "viewer"].includes(role)) {
    return NextResponse.json({ error: "role must be collaborator or viewer" }, { status: 400 });
  }

  const session = await requireOwner(productionId);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = await dbFetch(
    `production_members?production_id=eq.${productionId}&user_id=eq.${userId}`,
    { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ role }) }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to update role" }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/production-members
// Body: { productionId, userId }
export async function DELETE(req: NextRequest) {
  const { productionId, userId } = await req.json();

  if (!productionId || !userId) {
    return NextResponse.json({ error: "productionId and userId required" }, { status: 400 });
  }

  const session = await requireOwner(productionId);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = await dbFetch(
    `production_members?production_id=eq.${productionId}&user_id=eq.${userId}&role=neq.owner`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to remove member" }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
