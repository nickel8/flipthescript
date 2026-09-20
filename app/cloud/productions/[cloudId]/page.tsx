import { requireCloudSession } from "@/lib/cloud-session";
import { notFound } from "next/navigation";
import Link from "next/link";
import BreakdownEditor from "./BreakdownEditor";
import type { SceneData, ProductionElement, TodoData } from "./types";

export const metadata = {
  title: "Breakdown — FlipTheScript",
};

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function dbFetch(path: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: "no-store",
  });
}

export default async function ProductionPage({
  params,
}: {
  params: Promise<{ cloudId: string }>;
}) {
  const { cloudId } = await params;
  const session = await requireCloudSession();

  // Production (verify ownership)
  const prodRes = await dbFetch(
    `productions?cloud_id=eq.${cloudId}&owner_id=eq.${session.id}&select=id,name`
  );
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) notFound();
  const production = prods[0] as { id: string; name: string };

  // Episodes → scripts → scenes + elements (parallel)
  const episodesRes = await dbFetch(`episodes?production_id=eq.${production.id}&select=id`);
  const episodes = await episodesRes.json();
  const episodeIds: string[] = Array.isArray(episodes)
    ? episodes.map((e: { id: string }) => e.id)
    : [];

  let scenes: SceneData[] = [];
  let productionElements: ProductionElement[] = [];

  if (episodeIds.length > 0) {
    const scriptsRes = await dbFetch(
      `scripts?episode_id=in.(${episodeIds.join(",")})&select=id`
    );
    const scripts = await scriptsRes.json();
    const scriptIds: string[] = Array.isArray(scripts)
      ? scripts.map((s: { id: string }) => s.id)
      : [];

    if (scriptIds.length > 0) {
      const [scenesRes, elementsRes] = await Promise.all([
        dbFetch(
          `scenes?script_id=in.(${scriptIds.join(",")})&is_deleted=eq.false&order=scene_number.asc` +
            `&select=id,cloud_id,scene_number,slug_line,int_ext,location,time_of_day,page_start,` +
            `is_complete,shoot_day,shoot_order,` +
            `breakdown_sheets(id,synopsis,notes,is_reviewed,` +
            `scene_elements(id,elements(id,name,category)))`
        ),
        dbFetch(`elements?production_id=eq.${production.id}&select=id,name,category`),
      ]);

      const rawScenes = await scenesRes.json();
      productionElements = await elementsRes.json();

      scenes = Array.isArray(rawScenes)
        ? rawScenes.map((r: Record<string, unknown>) => {
            const sheetsArr = r.breakdown_sheets as Record<string, unknown>[] | null;
            const rawSheet = sheetsArr?.[0] ?? null;
            return {
              id: r.id as string,
              cloud_id: r.cloud_id as string,
              scene_number: r.scene_number as string,
              slug_line: r.slug_line as string,
              int_ext: (r.int_ext as string) ?? "",
              location: (r.location as string) ?? "",
              time_of_day: (r.time_of_day as string) ?? "",
              page_start: (r.page_start as number) ?? 0,
              is_complete: (r.is_complete as boolean) ?? false,
              shoot_day: (r.shoot_day as number) ?? 0,
              shoot_order: (r.shoot_order as number) ?? 0,
              sheet: rawSheet
                ? {
                    id: rawSheet.id as string,
                    synopsis: (rawSheet.synopsis as string) ?? "",
                    notes: (rawSheet.notes as string) ?? "",
                    is_reviewed: (rawSheet.is_reviewed as boolean) ?? false,
                    scene_elements: (
                      (rawSheet.scene_elements as Record<string, unknown>[]) ?? []
                    )
                      .filter((se) => se.elements)
                      .map((se) => {
                        const el = se.elements as Record<string, unknown>;
                        return {
                          id: se.id as string,
                          element: {
                            id: el.id as string,
                            name: el.name as string,
                            category: el.category as string,
                          },
                        };
                      }),
                  }
                : null,
            };
          })
        : [];
    }
  }

  // Todos
  const todosRes = await dbFetch(
    `todos?production_id=eq.${production.id}&order=created_at.asc` +
      `&select=id,title,is_done,scene_id,scenes(cloud_id)`
  );
  const todosRaw = (await todosRes.json()) ?? [];
  const todos: TodoData[] = Array.isArray(todosRaw)
    ? todosRaw.map((t: Record<string, unknown>) => ({
        id: t.id as string,
        title: t.title as string,
        is_done: t.is_done as boolean,
        scene_cloud_id:
          (t.scenes as { cloud_id?: string }[] | null)?.[0]?.cloud_id ?? null,
      }))
    : [];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 57px)" }}>
      {/* Compact breadcrumb header */}
      <div className="shrink-0 border-b border-black px-6 py-3 flex items-center gap-3">
        <Link
          href="/cloud/dashboard"
          className="text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity"
        >
          ← Dashboard
        </Link>
        <span className="opacity-15 text-xs">/</span>
        <h1 className="text-sm font-bold truncate">{production.name}</h1>
        <span className="ml-auto text-xs opacity-25 tabular-nums">
          {scenes.length} scene{scenes.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Editor fills remaining height — or upload prompt when empty */}
      {scenes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-sm opacity-30">No script uploaded yet.</p>
          <Link
            href={`/cloud/productions/${cloudId}/upload`}
            className="bg-black text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 hover:opacity-80 transition-opacity"
          >
            Upload Script PDF
          </Link>
        </div>
      ) : (
        <BreakdownEditor
          scenes={scenes}
          productionElements={productionElements}
          productionId={production.id}
          initialTodos={todos}
        />
      )}
    </div>
  );
}
