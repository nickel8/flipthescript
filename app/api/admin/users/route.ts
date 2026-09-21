import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";
import { isAdmin } from "@/lib/admin-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = {
  "Content-Type": "application/json",
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
};

async function requireAdmin() {
  const session = await getCloudSession();
  if (!session || !isAdmin(session)) return null;
  return session;
}

export async function GET() {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = await fetch(`${SB_URL}/auth/v1/admin/users?per_page=200`, { headers: HEADERS });
  const data = await res.json();
  return NextResponse.json(data.users ?? []);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, password } = await req.json();

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Valid email and password (min 8 chars) required" },
      { status: 400 }
    );
  }

  const res = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true, // mark as confirmed immediately
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data.message ?? data.error_description ?? "Failed to create user";
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
