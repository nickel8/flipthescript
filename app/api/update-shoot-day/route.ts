import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = {
  "Content-Type": "application/json",
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
};

export async function PATCH(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { productionId, dayNumber, shootDate } = await req.json() as {
    productionId: string;
    dayNumber: number;
    shootDate: string | null; // ISO "YYYY-MM-DD" or null to clear
  };

  if (!productionId || dayNumber == null) {
    return NextResponse.json({ error: "productionId and dayNumber required" }, { status: 400 });
  }

  // Verify ownership
  const prodRes = await fetch(
    `${SB_URL}/rest/v1/productions?id=eq.${productionId}&owner_id=eq.${session.id}&select=id`,
    { headers: HEADERS }
  );
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  await fetch(`${SB_URL}/rest/v1/shoot_days`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ production_id: productionId, day_number: dayNumber, shoot_date: shootDate }),
  });

  return NextResponse.json({ ok: true });
}
