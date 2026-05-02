import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// POST /api/magic-link/[breakdownId]
// Sends a fresh magic link to a returning colleague.
// Body: { email: string }
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_KEY   = process.env.RESEND_API_KEY!;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ breakdownId: string }> }
) {
  const { breakdownId } = await params;
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Verify this email is on the access list
  const accessRes = await fetch(
    `${SUPABASE_URL}/rest/v1/breakdown_access?breakdown_id=eq.${breakdownId}&email=eq.${encodeURIComponent(email)}&select=id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const access = await accessRes.json();
  if (!access?.[0]) {
    // Don't reveal whether the breakdown exists — generic message
    return NextResponse.json({ sent: true });
  }

  // Fetch breakdown name
  const bdRes = await fetch(
    `${SUPABASE_URL}/rest/v1/shared_breakdowns?id=eq.${breakdownId}&select=production_name,script_version`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const [breakdown] = await bdRes.json();

  // Create new token
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await fetch(`${SUPABASE_URL}/rest/v1/magic_tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ token, breakdown_id: breakdownId, email, expires_at: expiresAt.toISOString() }),
  });

  const url = `https://www.flip-the-script.app/view/${breakdownId}?token=${token}`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "FlipTheScript <hello@flip-the-script.app>",
      to: email,
      subject: `${breakdown.production_name} — your access link`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <h2 style="margin:0 0 8px">${breakdown.production_name}</h2>
          <p style="color:#555;margin:0 0 24px">Here's your fresh access link for the ${breakdown.script_version} breakdown.</p>
          <a href="${url}"
             style="display:inline-block;background:#141417;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
            View Breakdown
          </a>
          <p style="color:#aaa;font-size:12px;margin:24px 0 0">This link is personal to you and expires in 7 days.</p>
        </div>
      `,
    }),
  });

  return NextResponse.json({ sent: true });
}
