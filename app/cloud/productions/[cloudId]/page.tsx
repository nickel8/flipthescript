import { requireCloudSession } from "@/lib/cloud-session";
import { notFound } from "next/navigation";
import Link from "next/link";
import BlocksView, { type BlockData, type EpisodeData } from "./BlocksView";

export const metadata = {
  title: "Overview — FlipTheScript",
};

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function dbFetch(path: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: "no-store",
  });
}

export default async function ProductionOverviewPage({
  params,
}: {
  params: Promise<{ cloudId: string }>;
}) {
  const { cloudId } = await params;
  const session = await requireCloudSession();

  // Production + access check
  const prodRes = await dbFetch(`productions?cloud_id=eq.${cloudId}&select=id,name,owner_id`);
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) notFound();
  const prodRaw = prods[0] as { id: string; name: string; owner_id: string };

  let userRole: "owner" | "collaborator" | "viewer" = "viewer";
  if (prodRaw.owner_id === session.id) {
    userRole = "owner";
  } else {
    const memberRes = await dbFetch(
      `production_members?production_id=eq.${prodRaw.id}&user_id=eq.${session.id}&select=role`
    );
    const memberRows = await memberRes.json();
    if (!Array.isArray(memberRows) || memberRows.length === 0) notFound();
    const role = memberRows[0].role as string;
    userRole = role === "collaborator" || role === "dept_owner" ? "collaborator" : "viewer";
  }

  const productionId = prodRaw.id;
  const canEdit = userRole !== "viewer";

  // Blocks
  const blocksRes = await dbFetch(
    `blocks?production_id=eq.${productionId}&order=block_number.asc&select=id,block_number,label,status,series_id,wrapped_at`
  );
  const blocksRaw = await blocksRes.json();
  const rawBlocks: Array<{
    id: string; block_number: number; label: string;
    status: string; series_id: string | null; wrapped_at: string | null;
  }> = Array.isArray(blocksRaw) ? blocksRaw : [];

  // Episodes with scripts + scene counts
  const episodesRes = await dbFetch(
    `episodes?production_id=eq.${productionId}&order=episode_number.asc` +
    `&select=id,episode_number,title,status,block_id,scripts(id,is_current,scenes(id,is_complete))`
  );
  const episodesRaw = await episodesRes.json();

  type RawEpisode = {
    id: string;
    episode_number: number | null;
    title: string | null;
    status: string | null;
    block_id: string | null;
    scripts: Array<{
      id: string;
      is_current: boolean;
      scenes: Array<{ id: string; is_complete: boolean }>;
    }> | null;
  };

  function toEpisodeData(r: RawEpisode): EpisodeData {
    const currentScript = (r.scripts ?? []).find((s) => s.is_current);
    const scenes = currentScript?.scenes ?? [];
    return {
      id: r.id,
      episode_number: r.episode_number ?? null,
      title: r.title ?? null,
      status: (r.status as EpisodeData["status"]) ?? "prep",
      total_scenes: scenes.length,
      complete_scenes: scenes.filter((s) => s.is_complete).length,
      has_script: !!currentScript,
    };
  }

  const episodes: Array<RawEpisode & { _data: EpisodeData }> = Array.isArray(episodesRaw)
    ? (episodesRaw as RawEpisode[]).map((r) => ({ ...r, _data: toEpisodeData(r) }))
    : [];

  // Group episodes into blocks
  const blockMap = new Map<string, EpisodeData[]>();
  const unblockedEpisodes: EpisodeData[] = [];

  for (const ep of episodes) {
    if (ep.block_id) {
      if (!blockMap.has(ep.block_id)) blockMap.set(ep.block_id, []);
      blockMap.get(ep.block_id)!.push(ep._data);
    } else {
      unblockedEpisodes.push(ep._data);
    }
  }

  const blocks: BlockData[] = rawBlocks.map((b) => ({
    id: b.id,
    block_number: b.block_number,
    label: b.label,
    status: b.status as BlockData["status"],
    series_id: b.series_id,
    wrapped_at: b.wrapped_at,
    episodes: blockMap.get(b.id) ?? [],
  }));

  // Production-level totals
  const allEpisodeData = episodes.map((e) => e._data);
  const totalScenes = allEpisodeData.reduce((n, e) => n + e.total_scenes, 0);
  const completeScenes = allEpisodeData.reduce((n, e) => n + e.complete_scenes, 0);

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>

      {/* Header */}
      <div className="shrink-0 border-b border-black px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-3">
        <Link
          href="/cloud/dashboard"
          className="text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity"
        >
          ← Dashboard
        </Link>
        <span className="opacity-15 text-xs">/</span>
        <h1 className="text-sm font-bold truncate">{prodRaw.name}</h1>
        {userRole === "viewer" && (
          <span className="text-xs font-bold uppercase tracking-widest opacity-30 border border-black/20 px-2 py-0.5 ml-2">
            View only
          </span>
        )}
        <div className="ml-auto flex items-center gap-4">
          {totalScenes > 0 && (
            <span className="text-xs opacity-25 tabular-nums hidden sm:inline">
              {completeScenes}/{totalScenes} scenes
            </span>
          )}
          {canEdit && totalScenes > 0 && (
            <a
              href={`/api/export-breakdown?cloudId=${cloudId}`}
              className="text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity hidden sm:inline"
            >
              Export PDF
            </a>
          )}
          {userRole === "owner" && (
            <Link
              href={`/cloud/productions/${cloudId}/members`}
              className="text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity"
            >
              Members
            </Link>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 py-6 max-w-3xl mx-auto space-y-6">

          {/* Quick nav */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            <Link
              href={`/cloud/productions/${cloudId}/breakdown`}
              className="border border-black p-3 hover:bg-black hover:text-white transition-colors group"
            >
              <p className="text-[10px] uppercase tracking-widest opacity-50 group-hover:opacity-60 mb-1">Breakdown</p>
              <p className="font-bold text-sm">{totalScenes > 0 ? `${totalScenes} scenes` : "—"}</p>
            </Link>

            <Link
              href={`/cloud/productions/${cloudId}/sides`}
              className="border border-black p-3 hover:bg-black hover:text-white transition-colors group"
            >
              <p className="text-[10px] uppercase tracking-widest opacity-50 group-hover:opacity-60 mb-1">Sides</p>
              <p className="font-bold text-sm">—</p>
            </Link>

            {canEdit && (
              <Link
                href={`/cloud/productions/${cloudId}/upload`}
                className="border border-black p-3 hover:bg-black hover:text-white transition-colors group"
              >
                <p className="text-[10px] uppercase tracking-widest opacity-50 group-hover:opacity-60 mb-1">Upload</p>
                <p className="font-bold text-sm">Script</p>
              </Link>
            )}

            <Link
              href={`/cloud/productions/${cloudId}/schedule`}
              className="border border-black/20 p-3 group col-span-1"
            >
              <p className="text-[10px] uppercase tracking-widest opacity-30 mb-1">Schedule</p>
              <p className="font-bold text-sm opacity-30">Soon</p>
            </Link>

            <Link
              href={`/cloud/productions/${cloudId}/continuity`}
              className="border border-black/20 p-3 group col-span-1"
            >
              <p className="text-[10px] uppercase tracking-widest opacity-30 mb-1">Continuity</p>
              <p className="font-bold text-sm opacity-30">Soon</p>
            </Link>
          </div>

          {/* Blocks */}
          <BlocksView
            blocks={blocks}
            unblockedEpisodes={unblockedEpisodes}
            productionId={productionId}
            cloudId={cloudId}
            canEdit={canEdit}
          />

        </div>
      </div>
    </div>
  );
}
