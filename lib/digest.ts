import { get } from "@vercel/blob";
import { randomUUID } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_KEY   = process.env.RESEND_API_KEY!;
const APP_URL      = "https://www.flip-the-script.app";

// ── Department → element category filter ──────────────────────────────────────
// Mirrors Department.primaryCategories in the Mac app's TeamMember.swift.
// null means "show all categories".

const DEPARTMENT_CATEGORIES: Record<string, string[] | null> = {
  "Art Direction": null,
  "Props":         ["Props", "Weapons"],
  "Set Dressing":  ["Set Dressing", "Greens"],
  "Buying":        ["Props", "Set Dressing", "Costume"],
  "Greens":        ["Greens"],
  "SFX":           ["SFX"],
  "Costume":       ["Costume"],
  "Other":         null,
};

function allowedCategories(department: string | null): string[] | null {
  if (!department) return null;
  return DEPARTMENT_CATEGORIES[department] ?? null;
}

// ── Blob snapshot types ───────────────────────────────────────────────────────
// New format includes cloudId fields for stable diffing.
// Old blobs (without cloudIds) fall back to scene-number matching.

export interface BlobElementItem {
  cloudId?: string;
  name: string;
}

export interface BlobElementGroup {
  category: string;
  items: (string | BlobElementItem)[];
}

export interface BlobScene {
  sceneCloudId?: string;
  sceneNumber: string;
  slugLine: string;
  synopsis?: string;
  pageStart?: number;
  elements: BlobElementGroup[];
}

export interface BlobSnapshot {
  scenes: BlobScene[];
}

// ── Diff output types ─────────────────────────────────────────────────────────

export interface ElementChange {
  name: string;
  category: string;
  changeType: "added" | "removed";
}

export interface SceneChange {
  sceneNumber: string;
  slugLine: string;
  changeType: "added" | "deleted" | "renumbered" | "elements_changed";
  /** Only set when changeType === "renumbered" */
  previousSceneNumber?: string;
  elementChanges: ElementChange[];
}

export interface Diff {
  changes: SceneChange[];
  totalCount: number;
}

// ── Snapshot normalisation ────────────────────────────────────────────────────

function normaliseItem(item: string | BlobElementItem): BlobElementItem {
  return typeof item === "string" ? { name: item } : item;
}

// ── Core diff algorithm ───────────────────────────────────────────────────────

export function diffSnapshots(
  oldSnap: BlobSnapshot,
  newSnap: BlobSnapshot,
  allowedCats: string[] | null,
): Diff {
  const changes: SceneChange[] = [];

  const hasCloudIds =
    newSnap.scenes.some(s => s.sceneCloudId) &&
    oldSnap.scenes.some(s => s.sceneCloudId);

  if (hasCloudIds) {
    diffByCloudId(oldSnap.scenes, newSnap.scenes, allowedCats, changes);
  } else {
    diffBySceneNumber(oldSnap.scenes, newSnap.scenes, allowedCats, changes);
  }

  // Sort: deleted > renumbered > added > element changes; within each, numerically by scene
  const priority = (c: SceneChange) =>
    c.changeType === "deleted" ? 0
    : c.changeType === "renumbered" ? 1
    : c.changeType === "added" ? 2
    : 3;

  changes.sort((a, b) => {
    const pd = priority(a) - priority(b);
    if (pd !== 0) return pd;
    return a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true });
  });

  return { changes, totalCount: changes.length };
}

function diffByCloudId(
  oldScenes: BlobScene[],
  newScenes: BlobScene[],
  allowedCats: string[] | null,
  out: SceneChange[],
): void {
  const oldMap = new Map(oldScenes.map(s => [s.sceneCloudId!, s]));
  const newMap = new Map(newScenes.map(s => [s.sceneCloudId!, s]));

  for (const [id, newScene] of newMap) {
    const oldScene = oldMap.get(id);
    if (!oldScene) {
      // Scene is new
      out.push({
        sceneNumber: newScene.sceneNumber,
        slugLine: newScene.slugLine,
        changeType: "added",
        elementChanges: elementsAsAdded(newScene.elements, allowedCats),
      });
    } else {
      const renumbered = newScene.sceneNumber !== oldScene.sceneNumber;
      const elementChanges = diffElements(oldScene.elements, newScene.elements, allowedCats);
      if (renumbered || elementChanges.length > 0) {
        out.push({
          sceneNumber: newScene.sceneNumber,
          slugLine: newScene.slugLine,
          changeType: renumbered ? "renumbered" : "elements_changed",
          previousSceneNumber: renumbered ? oldScene.sceneNumber : undefined,
          elementChanges,
        });
      }
    }
  }

  for (const [id, oldScene] of oldMap) {
    if (!newMap.has(id)) {
      out.push({
        sceneNumber: oldScene.sceneNumber,
        slugLine: oldScene.slugLine,
        changeType: "deleted",
        elementChanges: [],
      });
    }
  }
}

function diffBySceneNumber(
  oldScenes: BlobScene[],
  newScenes: BlobScene[],
  allowedCats: string[] | null,
  out: SceneChange[],
): void {
  const oldMap = new Map(oldScenes.map(s => [s.sceneNumber, s]));
  const newMap = new Map(newScenes.map(s => [s.sceneNumber, s]));

  for (const [num, newScene] of newMap) {
    if (!oldMap.has(num)) {
      out.push({
        sceneNumber: newScene.sceneNumber,
        slugLine: newScene.slugLine,
        changeType: "added",
        elementChanges: elementsAsAdded(newScene.elements, allowedCats),
      });
    } else {
      const elementChanges = diffElements(oldMap.get(num)!.elements, newScene.elements, allowedCats);
      if (elementChanges.length > 0) {
        out.push({
          sceneNumber: newScene.sceneNumber,
          slugLine: newScene.slugLine,
          changeType: "elements_changed",
          elementChanges,
        });
      }
    }
  }

  for (const [num, oldScene] of oldMap) {
    if (!newMap.has(num)) {
      out.push({
        sceneNumber: oldScene.sceneNumber,
        slugLine: oldScene.slugLine,
        changeType: "deleted",
        elementChanges: [],
      });
    }
  }
}

function elementsAsAdded(
  groups: BlobElementGroup[],
  allowedCats: string[] | null,
): ElementChange[] {
  return filterGroups(groups, allowedCats).flatMap(g =>
    g.items.map(item => ({
      name: normaliseItem(item).name,
      category: g.category,
      changeType: "added" as const,
    }))
  );
}

function diffElements(
  oldGroups: BlobElementGroup[],
  newGroups: BlobElementGroup[],
  allowedCats: string[] | null,
): ElementChange[] {
  const filteredOld = filterGroups(oldGroups, allowedCats);
  const filteredNew = filterGroups(newGroups, allowedCats);
  const changes: ElementChange[] = [];

  const allCategories = new Set([
    ...filteredOld.map(g => g.category),
    ...filteredNew.map(g => g.category),
  ]);

  for (const category of allCategories) {
    const oldItems = filteredOld.find(g => g.category === category)?.items ?? [];
    const newItems = filteredNew.find(g => g.category === category)?.items ?? [];

    const oldKeys = new Set(oldItems.map(i => itemKey(normaliseItem(i))));
    const newKeys = new Set(newItems.map(i => itemKey(normaliseItem(i))));

    for (const item of newItems) {
      const ni = normaliseItem(item);
      if (!oldKeys.has(itemKey(ni))) {
        changes.push({ name: ni.name, category, changeType: "added" });
      }
    }
    for (const item of oldItems) {
      const ni = normaliseItem(item);
      if (!newKeys.has(itemKey(ni))) {
        changes.push({ name: ni.name, category, changeType: "removed" });
      }
    }
  }

  return changes;
}

function filterGroups(groups: BlobElementGroup[], allowedCats: string[] | null): BlobElementGroup[] {
  if (!allowedCats) return groups;
  return groups.filter(g => allowedCats.includes(g.category));
}

function itemKey(item: BlobElementItem): string {
  return item.cloudId ? item.cloudId.toLowerCase() : item.name.toLowerCase();
}

// ── Subject line ──────────────────────────────────────────────────────────────

function buildSubject(productionName: string, diff: Diff): string {
  const n = diff.totalCount;
  if (n === 0) return `${productionName} — breakdown updated`;

  const lead = leadSummary(diff.changes[0]);
  return `${productionName} — ${n} change${n === 1 ? "" : "s"} · ${lead}`;
}

function leadSummary(change: SceneChange): string {
  switch (change.changeType) {
    case "deleted":
      return `Sc ${change.sceneNumber} removed`;
    case "added":
      return `Sc ${change.sceneNumber} added`;
    case "renumbered":
      return `Sc ${change.previousSceneNumber} → ${change.sceneNumber}`;
    case "elements_changed": {
      const el = change.elementChanges[0];
      if (!el) return `Sc ${change.sceneNumber} updated`;
      return el.changeType === "added"
        ? `${el.name} added Sc ${change.sceneNumber}`
        : `${el.name} removed Sc ${change.sceneNumber}`;
    }
  }
}

// ── HTML email ────────────────────────────────────────────────────────────────

export function buildHtml(
  diff: Diff,
  productionName: string,
  scriptVersion: string,
  publishedAt: string,
  lastAccessed: string | null,
  breakdownId: string,
  accessToken: string,
): string {
  const viewUrl = `${APP_URL}/view/${breakdownId}?token=${accessToken}`;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });

  const publishedStr = fmt(publishedAt);
  const lastSeenStr  = lastAccessed ? fmt(lastAccessed) : "not yet viewed";

  const rows = diff.changes.map(scene => {
    const { label, bg, fg } = badgeStyle(scene.changeType);

    const renumberNote = scene.previousSceneNumber
      ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;font-family:monospace;">was Sc ${esc(scene.previousSceneNumber)}</div>`
      : "";

    const elRows = scene.elementChanges.map(el => {
      const icon  = el.changeType === "added" ? "+" : "−";
      const color = el.changeType === "added" ? "#166534" : "#991b1b";
      return `
        <tr>
          <td width="24" style="padding:3px 0 3px 16px;font-family:monospace;font-size:13px;color:${color};vertical-align:top;">${icon}</td>
          <td style="padding:3px 16px 3px 4px;font-size:13px;color:#374151;vertical-align:top;">
            ${esc(el.name)}<span style="color:#9ca3af;font-size:11px;margin-left:6px;">${esc(el.category)}</span>
          </td>
        </tr>`;
    }).join("");

    const elTable = elRows
      ? `<tr><td colspan="2" style="padding:0;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #f3f4f6;">${elRows}</table></td></tr>`
      : "";

    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;">
            <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;background:${bg};color:${fg};padding:2px 7px;border-radius:3px;margin-right:8px;">${label}</span>
            <strong style="font-size:14px;color:#111827;">Sc ${esc(scene.sceneNumber)}</strong>
            <span style="font-size:12px;color:#6b7280;margin-left:8px;">${esc(scene.slugLine)}</span>
            ${renumberNote}
          </td>
        </tr>
        ${elTable}
      </table>`;
  }).join("");

  return `<!DOCTYPE html>
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

  <!-- Header -->
  <tr>
    <td style="background:#141417;padding:24px 28px 20px;border-radius:8px 8px 0 0;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.35);font-family:monospace;">FlipTheScript</p>
      <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#ffffff;line-height:1.2;">${esc(productionName)}</h1>
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">${esc(scriptVersion)} · published ${esc(publishedStr)}</p>
    </td>
  </tr>

  <!-- Provenance -->
  <tr>
    <td style="background:#1f2937;padding:8px 28px;">
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);font-family:monospace;letter-spacing:0.02em;">
        Changes since your last view &mdash; ${esc(lastSeenStr)}
      </p>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="background:#ffffff;padding:24px 28px;border-radius:0 0 8px 8px;">
      ${rows}

      <!-- CTA -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
        <tr>
          <td>
            <a href="${viewUrl}" style="display:inline-block;background:#141417;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:600;">View full breakdown &rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:20px 28px 0;">
      <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.7;font-family:monospace;">
        This digest was built from the ${esc(scriptVersion)} publish on ${esc(publishedStr)}.<br>
        Your access link above is personal &mdash; do not forward it.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function badgeStyle(ct: SceneChange["changeType"]): { label: string; bg: string; fg: string } {
  switch (ct) {
    case "added":           return { label: "New scene",   bg: "#dcfce7", fg: "#166534" };
    case "deleted":         return { label: "Removed",     bg: "#fee2e2", fg: "#991b1b" };
    case "renumbered":      return { label: "Renumbered",  bg: "#fef9c3", fg: "#713f12" };
    case "elements_changed":return { label: "Updated",     bg: "#eff6ff", fg: "#1e40af" };
  }
}

// ── Plain-text email ──────────────────────────────────────────────────────────

export function buildText(
  diff: Diff,
  productionName: string,
  scriptVersion: string,
  publishedAt: string,
  lastAccessed: string | null,
  breakdownId: string,
  accessToken: string,
): string {
  const viewUrl = `${APP_URL}/view/${breakdownId}?token=${accessToken}`;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });

  const lines: string[] = [
    `${productionName} — ${scriptVersion}`,
    `Published: ${fmt(publishedAt)}`,
    `Changes since: ${lastAccessed ? fmt(lastAccessed) : "not yet viewed"}`,
    "",
    `${diff.totalCount} change${diff.totalCount === 1 ? "" : "s"}`,
    "",
  ];

  for (const scene of diff.changes) {
    const typeLabel =
      scene.changeType === "added"    ? "[NEW SCENE]" :
      scene.changeType === "deleted"  ? "[REMOVED]" :
      scene.changeType === "renumbered" ? `[RENUMBERED from Sc ${scene.previousSceneNumber}]` :
      "[UPDATED]";

    lines.push(`${typeLabel} Sc ${scene.sceneNumber} — ${scene.slugLine}`);
    for (const el of scene.elementChanges) {
      lines.push(`  ${el.changeType === "added" ? "+" : "-"} ${el.name} (${el.category})`);
    }
    lines.push("");
  }

  lines.push(`View breakdown: ${viewUrl}`);
  lines.push("This link is personal — do not forward it.");
  return lines.join("\n");
}

// ── HTML helper ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Supabase fetch helper ─────────────────────────────────────────────────────

function db(method: string, path: string, body?: object) {
  return fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ── Access row type ───────────────────────────────────────────────────────────

interface AccessRow {
  id: string;
  email: string;
  department: string | null;
  last_accessed: string | null;
}

// ── Send digests to all recipients of a republish ────────────────────────────

export interface BreakdownMeta {
  id: string;
  production_name: string;
  script_version: string;
  published_at: string;
}

export async function sendDigestsForPublish(
  oldSnapshot: BlobSnapshot | null,
  newSnapshot: BlobSnapshot,
  meta: BreakdownMeta,
): Promise<void> {
  // No previous snapshot = first publish. Nothing to diff.
  if (!oldSnapshot) return;

  const res = await db(
    "GET",
    `/rest/v1/breakdown_access?breakdown_id=eq.${meta.id}&select=id,email,department,last_accessed`,
  );
  const rows: AccessRow[] = await res.json();

  await Promise.allSettled(
    rows.map(row => sendDigestToRecipient(row, oldSnapshot, newSnapshot, meta)),
  );
}

async function sendDigestToRecipient(
  access: AccessRow,
  oldSnapshot: BlobSnapshot,
  newSnapshot: BlobSnapshot,
  meta: BreakdownMeta,
): Promise<void> {
  const cats = allowedCategories(access.department);
  const diff = diffSnapshots(oldSnapshot, newSnapshot, cats);

  if (diff.totalCount === 0) return;

  // Fresh magic link for the CTA button — 7-day expiry
  const token = randomUUID();
  await db("POST", "/rest/v1/magic_tokens", {
    token,
    breakdown_id: meta.id,
    email:        access.email,
    expires_at:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const subject = buildSubject(meta.production_name, diff);
  const html    = buildHtml(diff, meta.production_name, meta.script_version, meta.published_at, access.last_accessed, meta.id, token);
  const text    = buildText(diff, meta.production_name, meta.script_version, meta.published_at, access.last_accessed, meta.id, token);

  let resendMessageId: string | null = null;
  let error: string | null = null;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FlipTheScript <hello@flip-the-script.app>",
        to:   access.email,
        subject,
        html,
        text,
      }),
    });
    const json = await r.json();
    if (!r.ok) {
      error = JSON.stringify(json);
    } else {
      resendMessageId = json.id ?? null;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  // Log the attempt regardless of outcome
  await db("POST", "/rest/v1/digest_log", {
    breakdown_id:       meta.id,
    email:              access.email,
    changes_count:      diff.totalCount,
    resend_message_id:  resendMessageId,
    error,
  }).catch(e => console.error("digest_log insert failed:", e));

  if (error) {
    throw new Error(`Resend failed for ${access.email}: ${error}`);
  }
}

// ── Manual / preview send (for the test endpoint) ────────────────────────────

export async function buildDigestPreview(
  breakdownId: string,
  email: string,
): Promise<{ subject: string; html: string; text: string; diff: Diff }> {
  // Fetch breakdown metadata + blob
  const bdRes = await db(
    "GET",
    `/rest/v1/shared_breakdowns?id=eq.${breakdownId}&select=id,blob_key,production_name,script_version,updated_at`,
  );
  const [bd] = await bdRes.json();
  if (!bd) throw new Error("Breakdown not found");

  // Fetch current snapshot
  const blobResult = await get(bd.blob_key, { access: "private" });
  if (!blobResult?.stream) throw new Error("Could not load breakdown snapshot");
  const snapshot: BlobSnapshot = await new Response(blobResult.stream).json();

  // Fetch access row for department + last_accessed
  const accessRes = await db(
    "GET",
    `/rest/v1/breakdown_access?breakdown_id=eq.${breakdownId}&email=eq.${encodeURIComponent(email)}&select=id,email,department,last_accessed`,
  );
  const [access]: AccessRow[] = await accessRes.json();
  if (!access) throw new Error("Email not on access list");

  const cats = allowedCategories(access.department);
  // Preview treats old snapshot as empty — shows everything as "new"
  const diff = diffSnapshots({ scenes: [] }, snapshot, cats);

  const token = randomUUID();
  await db("POST", "/rest/v1/magic_tokens", {
    token,
    breakdown_id: breakdownId,
    email,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const meta: BreakdownMeta = {
    id:              bd.id,
    production_name: bd.production_name,
    script_version:  bd.script_version,
    published_at:    bd.updated_at,
  };

  const subject = buildSubject(meta.production_name, diff);
  const html    = buildHtml(diff, meta.production_name, meta.script_version, meta.published_at, access.last_accessed, breakdownId, token);
  const text    = buildText(diff, meta.production_name, meta.script_version, meta.published_at, access.last_accessed, breakdownId, token);

  return { subject, html, text, diff };
}
