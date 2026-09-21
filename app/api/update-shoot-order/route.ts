import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = {
  "Content-Type": "application/json",
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
};

interface SceneUpdate {
  id: string;
  shoot_day: number;
  shoot_order: number;
}

export async function PATCH(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { productionId, scenes }: { productionId: string; scenes: SceneUpdate[] } =
    await req.json();

  if (!productionId || !scenes?.length) {
    return NextResponse.json({ error: "productionId and scenes required" }, { status: 400 });
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

  // Parallel update — each scene gets its own PATCH
  const results = await Promise.all(
    scenes.map(async (s) => {
      const r = await fetch(`${SB_URL}/rest/v1/scenes?id=eq.${s.id}`, {
        method: "PATCH",
        headers: { ...HEADERS, Prefer: "return=minimal" },
        body: JSON.stringify({ shoot_day: s.shoot_day, shoot_order: s.shoot_order }),
      });
      if (!r.ok) {
        const text = await r.text();
        console.error(`Scene PATCH failed for ${s.id}:`, r.status, text);
        return { id: s.id, ok: false, status: r.status, body: text };
      }
      return { id: s.id, ok: true };
    })
  );

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    return NextResponse.json({ error: "Some scenes failed to update", failures }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: results.length });
}
