import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Paddle webhook — handles transaction.completed
// Generates a license key, saves to Supabase, emails it via Resend
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signatureHeader = req.headers.get("paddle-signature") ?? "";

  if (!verifySignature(body, signatureHeader)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);
  if (event.event_type !== "subscription.activated") {
    return NextResponse.json({ received: true });
  }

  const txId: string = event.data?.id;
  if (!txId) {
    return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
  }

  // Get customer email — try transaction data first, fall back to Paddle API
  let email: string | null =
    event.data?.customer?.email ?? event.data?.billing_details?.email ?? null;

  if (!email && event.data?.customer_id) {
    email = await fetchCustomerEmail(event.data.customer_id);
  }

  if (!email) {
    console.error("Could not resolve customer email for transaction", txId);
    return NextResponse.json({ error: "Could not resolve email" }, { status: 500 });
  }

  // Generate license key: FLIP-XXXX-XXXX-XXXX
  const key = generateKey();

  // Save to Supabase
  const saveRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/license_keys`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        key,
        email,
        paddle_transaction_id: txId,
      }),
    }
  );

  if (!saveRes.ok) {
    const err = await saveRes.text();
    console.error("Supabase insert failed:", err);
    return NextResponse.json({ error: "Failed to save key" }, { status: 500 });
  }

  // Email the key via Resend
  await sendLicenseEmail(email, key);

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verifySignature(body: string, header: string): boolean {
  const parts = Object.fromEntries(
    header.split(";").map((p) => p.split("=") as [string, string])
  );
  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;

  const expected = createHmac("sha256", process.env.PADDLE_WEBHOOK_SECRET!)
    .update(`${ts}:${body}`)
    .digest("hex");

  return expected === h1;
}

function generateKey(): string {
  const seg = () =>
    Math.random().toString(36).substring(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, "X").padEnd(4, "X");
  return `FLIP-${seg()}-${seg()}-${seg()}`;
}

async function fetchCustomerEmail(customerId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.paddle.com/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${process.env.PADDLE_API_KEY}` },
    });
    const json = await res.json();
    return json.data?.email ?? null;
  } catch {
    return null;
  }
}

async function sendLicenseEmail(to: string, key: string): Promise<void> {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "FlipTheScript <hello@flipthescript.app>",
      to,
      subject: "Your FlipTheScript License Key",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="margin:0 0 8px">Thanks for buying FlipTheScript</h2>
          <p style="color:#555;margin:0 0 24px">Here's your license key. Keep it safe — you'll need it to activate the app.</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;letter-spacing:2px;font-size:22px;font-weight:700;font-family:monospace">
            ${key}
          </div>
          <p style="color:#555;margin:24px 0 8px">Open FlipTheScript, click <strong>Activate License</strong>, and paste the key above.</p>
          <p style="color:#888;font-size:13px;margin:0">Questions? Reply to this email or contact hello@flipthescript.app</p>
        </div>
      `,
    }),
  });
}
