import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = {
  "Content-Type": "application/json",
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  Prefer: "return=representation",
};

export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Production name is required" }, { status: 400 });
  }

  const res = await fetch(`${SB_URL}/rest/v1/productions`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      cloud_id: crypto.randomUUID(),
      owner_id: session.id,
      name: name.trim(),
      published_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to create production" }, { status: 500 });
  }

  const [production] = await res.json();

  // Create the owner's production_members row so the dashboard can find it
  await fetch(`${SB_URL}/rest/v1/production_members`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      production_id: production.id,
      user_id: session.id,
      role: "owner",
      tier: "paid",
    }),
  });

  return NextResponse.json({ cloudId: production.cloud_id });
}
