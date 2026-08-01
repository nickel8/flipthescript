import { NextRequest, NextResponse } from "next/server";
import { buildDigestPreview } from "@/lib/digest";

// ---------------------------------------------------------------------------
// POST /api/digest/send
// Manual digest trigger for testing — does not require a publish event.
//
// Body:  { breakdownId: string, email: string }
// Query: ?preview=true  → returns HTML/subject/diff without sending email
//        (default)      → generates the preview token and sends the email
//
// The "old snapshot" is always treated as empty, so all current items appear
// as "added". This makes it useful for checking email rendering, not for
// simulating real change diffs.
// ---------------------------------------------------------------------------

const RESEND_KEY = process.env.RESEND_API_KEY!;

export async function POST(req: NextRequest) {
  const preview = req.nextUrl.searchParams.get("preview") === "true";

  let body: { breakdownId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { breakdownId, email } = body;
  if (!breakdownId || !email) {
    return NextResponse.json({ error: "breakdownId and email are required" }, { status: 400 });
  }

  try {
    const result = await buildDigestPreview(breakdownId, email);

    if (preview) {
      return NextResponse.json({
        subject:       result.subject,
        changesCount:  result.diff.totalCount,
        changes:       result.diff.changes,
        html:          result.html,
        text:          result.text,
      });
    }

    // Send the email
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    "FlipTheScript <hello@flip-the-script.app>",
        to:      email,
        subject: result.subject,
        html:    result.html,
        text:    result.text,
      }),
    });

    const json = await r.json();
    if (!r.ok) {
      return NextResponse.json({ error: "Resend error", detail: json }, { status: 502 });
    }

    return NextResponse.json({
      sent:         true,
      resendId:     json.id,
      subject:      result.subject,
      changesCount: result.diff.totalCount,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("POST /api/digest/send error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
