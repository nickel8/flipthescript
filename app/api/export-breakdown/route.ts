import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";
import { renderToBuffer } from "@react-pdf/renderer";
import { BreakdownDocument, type SceneRow } from "@/lib/breakdown-pdf";
import { compareSceneNumbers } from "@/lib/sort-scenes";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react");

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
};

function dbFetch(path: string) {
  return fetch(`${SB_URL}/rest/v1/${path}`, { headers: HEADERS });
}

export async function GET(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const cloudId = req.nextUrl.searchParams.get("cloudId");
  if (!cloudId) return NextResponse.json({ error: "cloudId required" }, { status: 400 });

  // Verify ownership
  const prodRes = await dbFetch(
    `productions?cloud_id=eq.${cloudId}&owner_id=eq.${session.id}&select=id,name`
  );
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }
  const production = prods[0] as { id: string; name: string };

  // Episodes → current scripts → scenes
  const epRes = await dbFetch(`episodes?production_id=eq.${production.id}&select=id`);
  const episodes = await epRes.json();
  if (!Array.isArray(episodes) || episodes.length === 0) {
    return NextResponse.json({ error: "No episodes" }, { status: 404 });
  }
  const epIds = episodes.map((e: { id: string }) => e.id).join(",");

  const scriptsRes = await dbFetch(
    `scripts?episode_id=in.(${epIds})&is_current=eq.true&select=id`
  );
  const scripts = await scriptsRes.json();
  if (!Array.isArray(scripts) || scripts.length === 0) {
    return NextResponse.json({ error: "No current script" }, { status: 404 });
  }
  const scriptIds = scripts.map((s: { id: string }) => s.id).join(",");

  const scenesRes = await dbFetch(
    `scenes?script_id=in.(${scriptIds})&is_deleted=eq.false&order=scene_number.asc` +
      `&select=scene_number,slug_line,int_ext,time_of_day,page_start,is_complete,` +
      `breakdown_sheets(synopsis,notes,scene_elements(elements(name,category)))`
  );
  const rawScenes = await scenesRes.json();

  if (!Array.isArray(rawScenes)) {
    return NextResponse.json({ error: "Failed to fetch scenes" }, { status: 500 });
  }

  const scenes: SceneRow[] = rawScenes.map((r: Record<string, unknown>) => {
    const sheetsArr = r.breakdown_sheets as Record<string, unknown>[] | null;
    const raw = sheetsArr?.[0] ?? null;
    const elements = raw
      ? ((raw.scene_elements as Record<string, unknown>[]) ?? [])
          .filter((se) => se.elements)
          .map((se) => {
            const el = se.elements as { name: string; category: string };
            return { name: el.name, category: el.category };
          })
      : [];

    return {
      scene_number: r.scene_number as string,
      slug_line: r.slug_line as string,
      int_ext: (r.int_ext as string) ?? "",
      time_of_day: (r.time_of_day as string) ?? "",
      page_start: (r.page_start as number) ?? 0,
      is_complete: (r.is_complete as boolean) ?? false,
      sheet: raw
        ? {
            synopsis: (raw.synopsis as string) ?? "",
            notes: (raw.notes as string) ?? "",
            elements,
          }
        : null,
    };
  });
  scenes.sort((a, b) => compareSceneNumbers(a.scene_number, b.scene_number));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    React.createElement(BreakdownDocument, {
      productionName: production.name,
      scenes,
    }) as any
  );

  const filename = `${production.name.replace(/[^a-z0-9]/gi, "-")}-breakdown.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
