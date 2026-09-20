import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const cloudId = req.nextUrl.searchParams.get("cloudId");
  if (!cloudId) return NextResponse.json({ error: "cloudId required" }, { status: 400 });

  const res = await fetch(
    `${SB_URL}/rest/v1/productions?cloud_id=eq.${cloudId}&owner_id=eq.${session.id}&select=id`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ id: rows[0].id });
}
