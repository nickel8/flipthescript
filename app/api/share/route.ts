import { get, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { sendDigestsForPublish, type BlobSnapshot, type BreakdownMeta } from "@/lib/digest";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// POST /api/share
// Called by the Mac app when AD publishes a breakdown.
//
// Body: {
//   adEmail: string,
//   productionName: string,
//   scriptVersion: string,
//   colleagues: {email: string, department: string}[],  // current format
//              | string[]                               // legacy, still accepted
//   breakdown: object           // the full snapshot JSON (scenes with sceneCloudId + element cloudIds)
// }
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_KEY   = process.env.RESEND_API_KEY!;

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  // colleagues can be a plain string array (legacy) or [{email, department}] (current)
  const { adEmail, productionName, scriptVersion, breakdown } = body;
  const rawColleagues: (string | { email: string; department?: string })[] =
    Array.isArray(body.colleagues) ? body.colleagues : [];
  const colleagues = rawColleagues.map(c =>
    typeof c === "string" ? { email: c, department: null } : { email: c.email, department: c.department ?? null }
  );

  if (!adEmail || !productionName || !breakdown) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 1. Upload snapshot to Vercel Blob (private)
  const blob = await put(
    `breakdowns/${randomUUID()}.json`,
    JSON.stringify(breakdown),
    { access: "private", contentType: "application/json" }
  );

  // 2. Create shared_breakdown record
  const sceneCount = Array.isArray(breakdown.scenes) ? breakdown.scenes.length : 0;
  const sbRes = await supabase("POST", "/rest/v1/shared_breakdowns", {
    blob_key:        blob.url,
    production_name: productionName,
    script_version:  scriptVersion,
    scene_count:     sceneCount,
    ad_email:        adEmail,
  }, "return=representation");

  if (!sbRes.ok) {
    return NextResponse.json({ error: "Failed to create breakdown record" }, { status: 500 });
  }
  const [record] = await sbRes.json();
  const breakdownId: string = record.id;

  // 3. Add each colleague to access list and send magic link
  await Promise.all(
    colleagues.map(c => inviteColleague(breakdownId, c.email, c.department, productionName, scriptVersion))
  );

  return NextResponse.json({ breakdownId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("POST /api/share error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Re-share: PATCH /api/share — update an existing breakdown with new snapshot
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { breakdownId, breakdown, scriptVersion } = body;

  if (!breakdownId || !breakdown) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Fetch existing record to get blob key + production name
  const existing = await supabase("GET", `/rest/v1/shared_breakdowns?id=eq.${breakdownId}&select=blob_key,ad_email,production_name`);
  const [record] = await existing.json();
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch old blob content for digest diff — must happen before overwrite
  let oldSnapshot: BlobSnapshot | null = null;
  try {
    const oldResult = await get(record.blob_key, { access: "private" });
    if (oldResult?.stream) {
      oldSnapshot = await new Response(oldResult.stream).json();
    }
  } catch {
    // If old blob is unavailable, skip digests for this publish
  }

  // Overwrite blob with new snapshot
  await put(
    new URL(record.blob_key).pathname.slice(1),
    JSON.stringify(breakdown),
    { access: "private", contentType: "application/json" }
  );

  // Update metadata
  const publishedAt = new Date().toISOString();
  await supabase("PATCH", `/rest/v1/shared_breakdowns?id=eq.${breakdownId}`, {
    script_version: scriptVersion,
    scene_count:    breakdown.scenes?.length ?? 0,
    updated_at:     publishedAt,
  });

  // Send change digests to all access-list recipients.
  // Each recipient with changes gets a digest email containing a fresh magic link.
  // Recipients with no changes receive nothing.
  const meta: BreakdownMeta = {
    id:              breakdownId,
    production_name: record.production_name,
    script_version:  scriptVersion,
    published_at:    publishedAt,
  };
  await sendDigestsForPublish(oldSnapshot, breakdown as BlobSnapshot, meta);

  return NextResponse.json({ updated: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function inviteColleague(
  breakdownId: string,
  email: string,
  department: string | null,
  productionName: string,
  scriptVersion: string,
) {
  // Add to access list; on conflict update department in case it changed
  await supabase(
    "POST",
    "/rest/v1/breakdown_access?on_conflict=breakdown_id,email",
    { breakdown_id: breakdownId, email, ...(department ? { department } : {}) },
    "resolution=merge-duplicates",
  );

  await sendMagicLink(email, breakdownId, productionName, scriptVersion, "invite");
}

async function sendMagicLink(
  email: string,
  breakdownId: string,
  productionName: string,
  scriptVersion: string,
  type: "invite" | "reaccess"
) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await supabase("POST", "/rest/v1/magic_tokens", {
    token,
    breakdown_id: breakdownId,
    email,
    expires_at: expiresAt.toISOString(),
  });

  const url = `https://www.flip-the-script.app/view/${breakdownId}?token=${token}`;
  const subject = type === "invite"
    ? `${productionName} — breakdown shared with you`
    : `${productionName} — your access link`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "FlipTheScript <hello@flip-the-script.app>",
      to: email,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <h2 style="margin:0 0 8px">${productionName}</h2>
          <p style="color:#555;margin:0 0 4px">${scriptVersion} breakdown</p>
          <p style="color:#555;margin:0 0 24px">
            ${type === "invite"
              ? "You've been given access to a scene breakdown. Click below to view it."
              : "Here's your access link to view the breakdown."}
          </p>
          <a href="${url}"
             style="display:inline-block;background:#141417;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
            View Breakdown
          </a>
          <p style="color:#aaa;font-size:12px;margin:24px 0 0">
            This link is personal to you and expires in 7 days. If it expires, reply to this email to request a new one.
          </p>
        </div>
      `,
    }),
  });
}


function supabase(method: string, path: string, body?: object, prefer?: string) {
  return fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
