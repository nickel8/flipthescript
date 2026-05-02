import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// POST /api/activate
// Called by the Mac app to validate a license key.
// Body: { "key": "FLIP-XXXX-XXXX-XXXX" }
// Response: { "valid": true } or { "valid": false, "reason": "..." }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let key: string;
  try {
    const body = await req.json();
    key = (body.key ?? "").trim().toUpperCase();
  } catch {
    return NextResponse.json({ valid: false, reason: "Invalid request" }, { status: 400 });
  }

  if (!key) {
    return NextResponse.json({ valid: false, reason: "No key provided" });
  }

  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/license_keys?key=eq.${encodeURIComponent(key)}&select=id`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ valid: false, reason: "Server error" }, { status: 500 });
  }

  const rows = await res.json();
  const valid = Array.isArray(rows) && rows.length > 0;

  return NextResponse.json({ valid });
}
