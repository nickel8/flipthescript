#!/usr/bin/env node
// Sends a test digest email using the most recent shared breakdown.
// Shows all scenes as "new" (simulates a first-time viewer).
//
// Usage:
//   node scripts/send-test-digest.mjs [email] [department]
//
// Defaults: kickjnelly@gmail.com, Props

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");

// ── Load .env.local ───────────────────────────────────────────────────────────

const envFile = readFileSync(join(webRoot, ".env.local"), "utf8");
for (const line of envFile.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const { get } = await import("@vercel/blob");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const APP_URL      = "https://www.flip-the-script.app";

const email      = process.argv[2] || "kickjnelly@gmail.com";
const department = process.argv[3] || "Props";

// ── Supabase helper ───────────────────────────────────────────────────────────

function db(method, path, body, prefer) {
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

// ── 1. Find the most recent breakdown ────────────────────────────────────────

const bdRes  = await db("GET", "/rest/v1/shared_breakdowns?select=id,production_name,script_version,blob_key,updated_at&order=created_at.desc&limit=1");
const [bd]   = await bdRes.json();
if (!bd) { console.error("No shared breakdowns found in Supabase."); process.exit(1); }
console.log(`Breakdown : "${bd.production_name}" (${bd.script_version})`);
console.log(`ID        : ${bd.id}`);

// ── 2. Add email to access list ───────────────────────────────────────────────
// Tries with department column first; falls back gracefully if migration not run yet.

let accessOk = false;
try {
  const r = await db(
    "POST",
    "/rest/v1/breakdown_access?on_conflict=breakdown_id,email",
    { breakdown_id: bd.id, email, department },
    "resolution=merge-duplicates,return=minimal",
  );
  accessOk = r.ok;
  if (!r.ok) {
    const err = await r.text();
    // Column might not exist if migration hasn't been run — try without department
    if (err.includes("department")) {
      const r2 = await db(
        "POST",
        "/rest/v1/breakdown_access?on_conflict=breakdown_id,email",
        { breakdown_id: bd.id, email },
        "resolution=merge-duplicates,return=minimal",
      );
      accessOk = r2.ok;
    }
  }
} catch (e) {
  console.warn("Access list upsert error:", e.message);
}
console.log(`Access list: ${accessOk ? "ok" : "warning — check manually"} (${email}, ${department})`);

// ── 3. Fetch snapshot blob ────────────────────────────────────────────────────

const blobResult = await get(bd.blob_key, { access: "private" });
if (!blobResult?.stream) { console.error("Could not fetch blob from Vercel."); process.exit(1); }
const snapshot = await new Response(blobResult.stream).json();
const scenes   = Array.isArray(snapshot.scenes) ? snapshot.scenes : [];
console.log(`Snapshot  : ${scenes.length} scenes`);

// ── 4. Create magic token ─────────────────────────────────────────────────────

const token = crypto.randomUUID();
await db("POST", "/rest/v1/magic_tokens", {
  token,
  breakdown_id: bd.id,
  email,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
});
const viewUrl = `${APP_URL}/view/${bd.id}?token=${token}`;

// ── 5. Build HTML email ───────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

const sceneRows = scenes.map(scene => {
  const elRows = (scene.elements || []).flatMap(g => {
    const items = Array.isArray(g.items) ? g.items : [];
    return items.map(item => {
      const name = typeof item === "string" ? item : (item.name || "");
      return `
        <tr>
          <td width="24" style="padding:3px 0 3px 16px;font-family:monospace;font-size:13px;color:#166534;vertical-align:top;">+</td>
          <td style="padding:3px 16px 3px 4px;font-size:13px;color:#374151;vertical-align:top;">
            ${esc(name)}<span style="color:#9ca3af;font-size:11px;margin-left:6px;">${esc(g.category)}</span>
          </td>
        </tr>`;
    });
  }).join("");

  const elBlock = elRows
    ? `<tr><td colspan="2"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #f3f4f6;">${elRows}</table></td></tr>`
    : "";

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;">
          <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;background:#dcfce7;color:#166534;padding:2px 7px;border-radius:3px;margin-right:8px;">New scene</span>
          <strong style="font-size:14px;color:#111827;">Sc ${esc(scene.sceneNumber)}</strong>
          <span style="font-size:12px;color:#6b7280;margin-left:8px;">${esc(scene.slugLine || "")}</span>
        </td>
      </tr>
      ${elBlock}
    </table>`;
}).join("");

const publishedStr = formatDate(bd.updated_at);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:32px 0;">
<tr><td align="center" style="padding:0 16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

  <tr>
    <td style="background:#141417;padding:24px 28px 20px;border-radius:8px 8px 0 0;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.35);font-family:monospace;">FlipTheScript &mdash; Test Digest</p>
      <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#ffffff;line-height:1.2;">${esc(bd.production_name)}</h1>
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">${esc(bd.script_version)} &middot; published ${esc(publishedStr)}</p>
    </td>
  </tr>

  <tr>
    <td style="background:#1f2937;padding:8px 28px;">
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);font-family:monospace;letter-spacing:0.02em;">
        Test send &mdash; all scenes shown as new. Real digests show only what changed since your last view.
      </p>
    </td>
  </tr>

  <tr>
    <td style="background:#ffffff;padding:24px 28px;border-radius:0 0 8px 8px;">
      ${sceneRows || '<p style="color:#9ca3af;font-size:14px;">No scenes in this breakdown yet.</p>'}

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
        <tr>
          <td>
            <a href="${viewUrl}" style="display:inline-block;background:#141417;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:600;">View full breakdown &rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:20px 28px 0;">
      <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.7;font-family:monospace;">
        Test digest for ${esc(email)} (${esc(department)}).<br>
        Your access link is personal &mdash; do not forward it.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

const subject = `[Test digest] ${bd.production_name} — ${scenes.length} scene${scenes.length === 1 ? "" : "s"} · ${bd.script_version}`;

// ── 6. Send via Resend ────────────────────────────────────────────────────────

const r = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${RESEND_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from:    "FlipTheScript <hello@flip-the-script.app>",
    to:      email,
    subject,
    html,
  }),
});

const result = await r.json();
if (!r.ok) {
  console.error("Resend error:", JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(`\n✅ Sent!`);
console.log(`   To      : ${email}`);
console.log(`   Subject : ${subject}`);
console.log(`   Resend  : ${result.id}`);
console.log(`   View URL: ${viewUrl}`);
