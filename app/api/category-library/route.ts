import { NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET /api/category-library — returns full library for the "add category" picker
export async function GET() {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(
    `${SB_URL}/rest/v1/category_library?order=display_order.asc,name.asc&select=name,display_order,is_default`,
    {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      cache: "no-store",
    }
  );
  const rows = await res.json();
  return NextResponse.json(Array.isArray(rows) ? rows : []);
}
