import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

export async function GET(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const cloudId = req.nextUrl.searchParams.get("cloudId");
  if (!cloudId) return NextResponse.json({ error: "cloudId required" }, { status: 400 });

  // Find production by cloudId
  const prodRes = await fetch(
    `${SB_URL}/rest/v1/productions?cloud_id=eq.${cloudId}&select=id,name,owner_id`,
    { headers: HEADERS }
  );
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const prod = prods[0] as { id: string; name: string; owner_id: string };

  // Check ownership or membership
  if (prod.owner_id !== session.id) {
    const memberRes = await fetch(
      `${SB_URL}/rest/v1/production_members?production_id=eq.${prod.id}&user_id=eq.${session.id}&select=role`,
      { headers: HEADERS }
    );
    const members = await memberRes.json();
    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ id: prod.id, name: prod.name });
}
