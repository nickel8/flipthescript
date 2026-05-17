import { requireCloudSession } from "@/lib/cloud-session";
import { notFound } from "next/navigation";
import Link from "next/link";
import TodoSection from "./TodoSection";
import SceneList, { type Scene } from "./SceneList";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function dbFetch(path: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    cache: "no-store",
  });
}

interface Todo {
  id: string;
  title: string;
  is_done: boolean;
  scene_cloud_id: string | null;
}

export default async function ProductionPage({
  params,
}: {
  params: Promise<{ cloudId: string }>;
}) {
  const { cloudId } = await params;
  const session = await requireCloudSession();

  // Load production (verify ownership)
  const prodRes = await dbFetch(
    `productions?cloud_id=eq.${cloudId}&owner_id=eq.${session.id}&select=id,name,cloud_id`
  );
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) notFound();
  const production = prods[0];

  // Load scenes: production → episodes → scripts → scenes (PostgREST has no subquery support)
  const episodesRes = await dbFetch(`episodes?production_id=eq.${production.id}&select=id`);
  const episodes = await episodesRes.json();
  const episodeIds: string[] = Array.isArray(episodes) ? episodes.map((e: { id: string }) => e.id) : [];

  let scenes: Scene[] = [];
  if (episodeIds.length > 0) {
    const scriptsRes = await dbFetch(
      `scripts?episode_id=in.(${episodeIds.join(",")})&select=id`
    );
    const scripts = await scriptsRes.json();
    const scriptIds: string[] = Array.isArray(scripts) ? scripts.map((s: { id: string }) => s.id) : [];

    if (scriptIds.length > 0) {
      const sRes = await dbFetch(
        `scenes?script_id=in.(${scriptIds.join(",")})&order=scene_number.asc` +
        `&select=id,cloud_id,scene_number,slug_line,is_complete,` +
        `breakdown_sheets(synopsis,notes,scene_elements(notes,elements(name,category)))`
      );
      const raw = await sRes.json();
      scenes = Array.isArray(raw)
        ? raw.map((r: Record<string, unknown>) => {
            const sheet = (r.breakdown_sheets as Record<string, unknown>[] | null)?.[0] ?? null;
            const sceneElements = sheet
              ? (sheet.scene_elements as { notes: string; elements: { name: string; category: string } | null }[]) ?? []
              : [];
            return {
              id: r.id as string,
              cloud_id: r.cloud_id as string,
              scene_number: r.scene_number as string,
              slug_line: r.slug_line as string,
              is_complete: r.is_complete as boolean,
              synopsis: sheet ? (sheet.synopsis as string | null) : null,
              notes: sheet ? (sheet.notes as string | null) : null,
              elements: sceneElements
                .filter(se => se.elements)
                .map(se => ({
                  name: se.elements!.name,
                  category: se.elements!.category,
                  notes: se.notes,
                })),
            };
          })
        : [];
    }
  }

  // Load todos (join scenes to get cloud_id)
  const todosRes = await dbFetch(
    `todos?production_id=eq.${production.id}&order=created_at.asc&select=id,title,is_done,scene_id,scenes(cloud_id)`
  );
  const todosRaw = (await todosRes.json()) ?? [];
  const todos: Todo[] = Array.isArray(todosRaw)
    ? todosRaw.map((t: Record<string, unknown>) => ({
        id: t.id as string,
        title: t.title as string,
        is_done: t.is_done as boolean,
        scene_cloud_id: (t.scenes as { cloud_id?: string }[] | null)?.[0]?.cloud_id ?? null,
      }))
    : [];

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="mb-8">
        <Link href="/cloud/dashboard" className="text-xs uppercase tracking-widest opacity-40 hover:opacity-70">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-3">{production.name}</h1>
      </div>

      <div className="grid gap-10 md:grid-cols-[1fr_280px]">
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4">
            Scenes ({scenes.length})
          </h2>
          <SceneList scenes={scenes} />
        </section>

        <section>
          <TodoSection
            productionId={production.id}
            initialTodos={todos}
            scenes={scenes.map(s => ({ cloudId: s.cloud_id, sceneNumber: s.scene_number, slugLine: s.slug_line }))}
          />
        </section>
      </div>
    </div>
  );
}
