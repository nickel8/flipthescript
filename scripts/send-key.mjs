// One-off script: generate a license key for a given email and send it
// Usage: node scripts/send-key.mjs

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env.local
const envPath = join(dirname(fileURLToPath(import.meta.url)), "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=").map((p) => p.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")])
);

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = env.RESEND_API_KEY;

const EMAIL = "kickjnelly@gmail.com";

function generateKey() {
  const seg = () =>
    Math.random().toString(36).substring(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, "X").padEnd(4, "X");
  return `FLIP-${seg()}-${seg()}-${seg()}`;
}

const key = generateKey();
console.log(`Generated key: ${key}`);

// Save to Supabase
const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/license_keys`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Prefer: "return=minimal",
  },
  body: JSON.stringify({
    key,
    email: EMAIL,
    paddle_transaction_id: `manual_${Date.now()}`,
  }),
});

if (!saveRes.ok) {
  console.error("Supabase insert failed:", await saveRes.text());
  process.exit(1);
}
console.log("Saved to Supabase ✓");

// Send email
const emailRes = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${RESEND_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "FlipTheScript <hello@flip-the-script.app>",
    to: EMAIL,
    subject: "Your FlipTheScript License Key",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px">Thanks for buying FlipTheScript</h2>
        <p style="color:#555;margin:0 0 24px">Here's your license key. Keep it safe — you'll need it to activate the app.</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;letter-spacing:2px;font-size:22px;font-weight:700;font-family:monospace">
          ${key}
        </div>
        <p style="color:#555;margin:24px 0 8px">Open FlipTheScript, click <strong>Activate License</strong>, and paste the key above.</p>
        <p style="color:#888;font-size:13px;margin:0">Questions? Reply to this email or contact hello@flip-the-script.app</p>
      </div>
    `,
  }),
});

if (!emailRes.ok) {
  console.error("Resend failed:", await emailRes.text());
  process.exit(1);
}
console.log(`Email sent to ${EMAIL} ✓`);
