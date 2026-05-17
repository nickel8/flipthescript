import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// POST /api/publish
// Called by the Mac app to push a production snapshot to Supabase.
//
// Auth:   Authorization: Bearer <supabase-user-jwt>
// Body:   PublishPayload (see types below)
//
// Uses the service role key — bypasses RLS entirely.
// The caller's JWT is verified before any writes happen.
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductionPayload {
  cloudId: string;
  name: string;
}

interface EpisodePayload {
  cloudId: string;
  productionCloudId: string;
  name: string;
  number: number;
  isDefault: boolean;
}

interface ScriptPayload {
  cloudId: string;
  episodeCloudId: string;
  version: string;
  filename: string;
  importedAt: string;
  colorHex?: string | null;
  isCurrent: boolean;
}

interface ScenePayload {
  cloudId: string;
  scriptCloudId: string;
  sceneNumber: string;
  slugLine: string;
  intExt: string;
  location: string;
  timeOfDay: string;
  pageStart: number;
  rawText: string;
  revisionStatus: string;
  shootDay: number;
  shootOrder: number;
  isComplete: boolean;
}

interface SheetPayload {
  cloudId: string;
  sceneCloudId: string;
  synopsis: string;
  notes: string;
  isReviewed: boolean;
}

interface ElementPayload {
  cloudId: string;
  productionCloudId: string;
  name: string;
  category: string;
  notes: string;
}

interface SceneElementPayload {
  cloudId: string;
  sheetCloudId: string;
  elementCloudId: string;
  notes: string;
}

interface PublishPayload {
  production: ProductionPayload;
  episodes: EpisodePayload[];
  scripts: ScriptPayload[];
  scenes: ScenePayload[];
  breakdownSheets: SheetPayload[];
  elements: ElementPayload[];
  sceneElements: SceneElementPayload[];
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Verify the caller's JWT
  const authHeader = req.headers.get("Authorization");
  const jwt = authHeader?.replace("Bearer ", "").trim();
  if (!jwt) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (!userRes.ok) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
  const { id: ownerID } = await userRes.json();
  if (!ownerID) {
    return NextResponse.json({ error: "Could not identify user" }, { status: 401 });
  }

  // 2. Parse payload
  let payload: PublishPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { production, episodes, scripts, scenes, breakdownSheets, elements, sceneElements } = payload;

  try {
    // 3. Upsert production
    const prodRows = await upsert<{ id: string; cloud_id: string }>("productions", [{
      cloud_id:    production.cloudId,
      name:        production.name,
      owner_id:    ownerID,
      published_at: new Date().toISOString(),
    }]);
    const prodID = prodRows[0].id;

    // 4. Ensure owner membership (idempotent)
    await upsert("production_members", [{
      production_id: prodID,
      user_id:       ownerID,
      role:          "owner",
      tier:          "paid",
    }], "production_id,user_id", false);

    // 5. Episodes → {cloudId → id}
    if (episodes.length > 0) {
      const epRows = await upsert<{ id: string; cloud_id: string }>("episodes", episodes.map(e => ({
        cloud_id:      e.cloudId,
        production_id: prodID,
        name:          e.name,
        number:        e.number,
        is_default:    e.isDefault,
      })));
      const epMap = toMap(epRows);

      // 6. Scripts → {cloudId → id}
      const scriptRowsIn = scripts.map(s => ({
        cloud_id:    s.cloudId,
        episode_id:  epMap[s.episodeCloudId],
        version:     s.version,
        filename:    s.filename,
        imported_at: s.importedAt,
        color_hex:   s.colorHex ?? null,
        is_current:  s.isCurrent,
      })).filter(r => r.episode_id); // skip orphaned scripts

      if (scriptRowsIn.length > 0) {
        const scriptRows = await upsert<{ id: string; cloud_id: string }>("scripts", scriptRowsIn);
        const scriptMap = toMap(scriptRows);

        // 7. Scenes → {cloudId → id}
        const sceneRowsIn = scenes.map(sc => ({
          cloud_id:       sc.cloudId,
          script_id:      scriptMap[sc.scriptCloudId],
          scene_number:   sc.sceneNumber,
          slug_line:      sc.slugLine,
          int_ext:        sc.intExt,
          location:       sc.location,
          time_of_day:    sc.timeOfDay,
          page_start:     sc.pageStart,
          raw_text:       sc.rawText,
          revision_status: sc.revisionStatus,
          shoot_day:      sc.shootDay,
          shoot_order:    sc.shootOrder,
          is_complete:    sc.isComplete,
          is_deleted:     false,
        })).filter(r => r.script_id);

        if (sceneRowsIn.length > 0) {
          const sceneRows = await upsert<{ id: string; cloud_id: string }>("scenes", sceneRowsIn);
          const sceneMap = toMap(sceneRows);

          // 8. Breakdown sheets → {cloudId → id}
          const sheetRowsIn = breakdownSheets.map(sh => ({
            cloud_id:   sh.cloudId,
            scene_id:   sceneMap[sh.sceneCloudId],
            synopsis:   sh.synopsis,
            notes:      sh.notes,
            is_reviewed: sh.isReviewed,
          })).filter(r => r.scene_id);

          if (sheetRowsIn.length > 0) {
            const sheetRows = await upsert<{ id: string; cloud_id: string }>("breakdown_sheets", sheetRowsIn);
            const sheetMap = toMap(sheetRows);

            // 9. Elements → {cloudId → id}
            if (elements.length > 0) {
              const elemRows = await upsert<{ id: string; cloud_id: string }>("elements", elements.map(el => ({
                cloud_id:      el.cloudId,
                production_id: prodID,
                name:          el.name,
                category:      el.category,
                notes:         el.notes,
              })));
              const elemMap = toMap(elemRows);

              // 10. Scene elements
              const seRowsIn = sceneElements.map(se => ({
                cloud_id:          se.cloudId,
                breakdown_sheet_id: sheetMap[se.sheetCloudId],
                element_id:        elemMap[se.elementCloudId],
                notes:             se.notes,
              })).filter(r => r.breakdown_sheet_id && r.element_id);

              if (seRowsIn.length > 0) {
                await upsert("scene_elements", seRowsIn, "cloud_id", false);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true, productionId: prodID });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("POST /api/publish error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsert<T = unknown>(
  table: string,
  rows: object[],
  onConflict = "cloud_id",
  returning = true
): Promise<T[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey:          SUPABASE_KEY,
        Authorization:  `Bearer ${SUPABASE_KEY}`,
        Prefer:         returning
          ? "resolution=merge-duplicates,return=representation"
          : "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[${table}] ${res.status}: ${body}`);
  }

  return returning ? res.json() : [];
}

/** Build cloudId → Supabase id map from upsert result rows. */
function toMap(rows: { id: string; cloud_id: string }[]): Record<string, string> {
  return Object.fromEntries(rows.map(r => [r.cloud_id, r.id]));
}
