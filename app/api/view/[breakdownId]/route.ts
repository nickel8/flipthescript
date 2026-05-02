import { getDownloadUrl } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/view/[breakdownId]?token=xyz
// Validates the magic token and returns the breakdown JSON.
// Token is single-use — burned on first successful access.
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ breakdownId: string }> }
) {
  const { breakdownId } = await params;
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "No token provided" }, { status: 401 });
  }

  // Look up token
  const tokenRes = await supabase(
    `GET`,
    `/rest/v1/magic_tokens?token=eq.${encodeURIComponent(token)}&breakdown_id=eq.${breakdownId}&select=id,email,expires_at,used_at`
  );
  const tokens = await tokenRes.json();
  const record = tokens?.[0];

  if (!record) {
    return NextResponse.json({ error: "Invalid link" }, { status: 401 });
  }
  if (record.used_at) {
    return NextResponse.json({ error: "This link has already been used. Request a new one." }, { status: 401 });
  }
  if (new Date(record.expires_at) < new Date()) {
    return NextResponse.json({ error: "This link has expired. Request a new one." }, { status: 401 });
  }

  // Mark token as used
  await supabase("PATCH", `/rest/v1/magic_tokens?id=eq.${record.id}`, {
    used_at: new Date().toISOString(),
  });

  // Update last_accessed on access list
  await supabase(
    "PATCH",
    `/rest/v1/breakdown_access?breakdown_id=eq.${breakdownId}&email=eq.${encodeURIComponent(record.email)}`,
    { last_accessed: new Date().toISOString() }
  );

  // Fetch breakdown metadata + blob URL
  const bdRes = await supabase(
    "GET",
    `/rest/v1/shared_breakdowns?id=eq.${breakdownId}&select=blob_key,production_name,script_version`
  );
  const breakdowns = await bdRes.json();
  const breakdown = breakdowns?.[0];

  if (!breakdown) {
    return NextResponse.json({ error: "Breakdown not found" }, { status: 404 });
  }

  // Fetch the snapshot from private Vercel Blob storage via signed URL
  const signedUrl = await getDownloadUrl(breakdown.blob_key);
  const snapshotRes = await fetch(signedUrl);
  if (!snapshotRes.ok) {
    return NextResponse.json({ error: "Could not load breakdown data" }, { status: 500 });
  }
  const snapshot = await snapshotRes.json();

  return NextResponse.json({
    email: record.email,
    productionName: breakdown.production_name,
    scriptVersion: breakdown.script_version,
    snapshot,
  });
}

function supabase(method: string, path: string, body?: object) {
  return fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
