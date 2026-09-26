"use server";

import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const AUTH_HEADERS = {
  "Content-Type": "application/json",
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
};

async function assertAuth() {
  const session = await getCloudSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

// ── Synopsis / Notes ──────────────────────────────────────────────────────────

export async function updateSynopsis(sheetId: string, synopsis: string): Promise<void> {
  await assertAuth();
  const res = await fetch(`${SB_URL}/rest/v1/breakdown_sheets?id=eq.${sheetId}`, {
    method: "PATCH",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ synopsis }),
  });
  if (!res.ok) throw new Error(`updateSynopsis: ${await res.text()}`);
}

export async function updateSheetNotes(sheetId: string, notes: string): Promise<void> {
  await assertAuth();
  const res = await fetch(`${SB_URL}/rest/v1/breakdown_sheets?id=eq.${sheetId}`, {
    method: "PATCH",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error(`updateSheetNotes: ${await res.text()}`);
}

// ── Elements ──────────────────────────────────────────────────────────────────

export async function addElement(
  sheetId: string,
  productionId: string,
  name: string,
  category: string
): Promise<{ sceneElementId: string; elementId: string; name: string; isNew: boolean }> {
  await assertAuth();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Element name required");

  // Find existing element (case-insensitive)
  const findRes = await fetch(
    `${SB_URL}/rest/v1/elements?production_id=eq.${productionId}` +
      `&name=ilike.${encodeURIComponent(trimmed)}&category=eq.${encodeURIComponent(category)}&select=id,name&limit=1`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  const found = await findRes.json();

  let elementId: string;
  let resolvedName: string;
  let isNew = false;

  if (Array.isArray(found) && found.length > 0) {
    elementId = found[0].id;
    resolvedName = found[0].name;
  } else {
    const createRes = await fetch(`${SB_URL}/rest/v1/elements`, {
      method: "POST",
      headers: { ...AUTH_HEADERS, Prefer: "return=representation" },
      body: JSON.stringify({
        cloud_id: crypto.randomUUID(),
        production_id: productionId,
        name: trimmed,
        category,
        notes: "",
      }),
    });
    if (!createRes.ok) throw new Error(`createElement: ${await createRes.text()}`);
    const [el] = await createRes.json();
    elementId = el.id;
    resolvedName = el.name;
    isNew = true;
  }

  // Link to sheet — ignore if already linked
  const seRes = await fetch(`${SB_URL}/rest/v1/scene_elements`, {
    method: "POST",
    headers: { ...AUTH_HEADERS, Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      cloud_id: crypto.randomUUID(),
      breakdown_sheet_id: sheetId,
      element_id: elementId,
      notes: "",
    }),
  });
  if (!seRes.ok) throw new Error(`linkElement: ${await seRes.text()}`);
  const seRows = await seRes.json();

  let sceneElementId: string;
  if (Array.isArray(seRows) && seRows.length > 0) {
    sceneElementId = seRows[0].id;
  } else {
    // Was a duplicate — look up the existing row
    const existRes = await fetch(
      `${SB_URL}/rest/v1/scene_elements?breakdown_sheet_id=eq.${sheetId}&element_id=eq.${elementId}&select=id`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    const existRows = await existRes.json();
    if (!Array.isArray(existRows) || existRows.length === 0) {
      throw new Error("ALREADY_EXISTS");
    }
    sceneElementId = existRows[0].id;
  }

  return { sceneElementId, elementId, name: resolvedName, isNew };
}

export async function removeElement(sceneElementId: string): Promise<void> {
  await assertAuth();
  const res = await fetch(`${SB_URL}/rest/v1/scene_elements?id=eq.${sceneElementId}`, {
    method: "DELETE",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`removeElement: ${await res.text()}`);
}

// ── Completion ────────────────────────────────────────────────────────────────

export async function toggleComplete(sceneId: string, isComplete: boolean): Promise<void> {
  await assertAuth();
  const res = await fetch(`${SB_URL}/rest/v1/scenes?id=eq.${sceneId}`, {
    method: "PATCH",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ is_complete: isComplete }),
  });
  if (!res.ok) throw new Error(`toggleComplete: ${await res.text()}`);
}

// ── Ensure sheet ──────────────────────────────────────────────────────────────
// Creates a breakdown sheet if one doesn't exist yet for this scene.

export async function ensureSheet(sceneId: string): Promise<string> {
  await assertAuth();
  const findRes = await fetch(
    `${SB_URL}/rest/v1/breakdown_sheets?scene_id=eq.${sceneId}&select=id`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  const found = await findRes.json();
  if (Array.isArray(found) && found.length > 0) return found[0].id;

  const createRes = await fetch(`${SB_URL}/rest/v1/breakdown_sheets`, {
    method: "POST",
    headers: { ...AUTH_HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({
      cloud_id: crypto.randomUUID(),
      scene_id: sceneId,
      synopsis: "",
      notes: "",
      is_reviewed: false,
    }),
  });
  if (!createRes.ok) throw new Error(`ensureSheet: ${await createRes.text()}`);
  const [sheet] = await createRes.json();
  return sheet.id;
}
