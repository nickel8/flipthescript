import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

export async function GET(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return new NextResponse("Unauthenticated", { status: 401 });

  const scriptId = req.nextUrl.searchParams.get("scriptId");
  if (!scriptId) return new NextResponse("Missing scriptId", { status: 400 });

  // Fetch the script record
  const scriptRes = await fetch(
    `${SB_URL}/rest/v1/scripts?id=eq.${scriptId}&select=blob_url,episode_id`,
    { headers: HEADERS }
  );
  const scripts = await scriptRes.json();
  if (!Array.isArray(scripts) || scripts.length === 0) {
    return new NextResponse("Script not found", { status: 404 });
  }
  const { blob_url, episode_id } = scripts[0] as {
    blob_url: string | null;
    episode_id: string;
  };

  if (!blob_url) return new NextResponse("No PDF on record", { status: 404 });

  // Verify ownership: episode → production → owner
  const epRes = await fetch(
    `${SB_URL}/rest/v1/episodes?id=eq.${episode_id}&select=production_id`,
    { headers: HEADERS }
  );
  const eps = await epRes.json();
  if (!Array.isArray(eps) || eps.length === 0) {
    return new NextResponse("Episode not found", { status: 404 });
  }
  const { production_id } = eps[0] as { production_id: string };

  const prodRes = await fetch(
    `${SB_URL}/rest/v1/productions?id=eq.${production_id}&owner_id=eq.${session.id}&select=id`,
    { headers: HEADERS }
  );
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Proxy the private Vercel Blob with the read/write token
  const pdfRes = await fetch(blob_url, {
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
    },
  });

  if (!pdfRes.ok) {
    return new NextResponse("Failed to fetch PDF", { status: 502 });
  }

  return new NextResponse(pdfRes.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
