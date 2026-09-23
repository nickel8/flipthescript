import { requireCloudSession } from "@/lib/cloud-session";
import { notFound } from "next/navigation";
import Link from "next/link";
import DigestSceneList from "./DigestSceneList";

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ProductionDigestPage({
  params,
}: {
  params: Promise<{ cloudId: string }>;
}) {
  const { cloudId } = await params;
  const session = await requireCloudSession();

  // Production + access check
  const prodRes = await dbFetch(`productions?cloud_id=eq.${cloudId}&select=id,name,owner_id,published_at`);
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) notFound();
  const prodRaw = prods[0] as { id: string; name: string; owner_id: string; published_at: string };

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

  // Episodes → scripts → scenes
  const episodesRes = await dbFetch(`episodes?production_id=eq.${productionId}&select=id`);
  const episodes = await episodesRes.json();
  const episodeIds: string[] = Array.isArray(episodes)
    ? episodes.map((e: { id: string }) => e.id)
    : [];

  type DigestScene = {
    id: string;
    scene_number: string;
    int_ext: string;
    location: string;
    time_of_day: string;
    is_complete: boolean;
    shoot_day: number;
    elements: { name: string; category: string }[];
  };

  let scenes: DigestScene[] = [];
  let scriptId: string | null = null;
  let scriptUploadedAt: string | null = null;
  let scriptFilename: string | null = null;

  if (episodeIds.length > 0) {
    const scriptsRes = await dbFetch(
      `scripts?episode_id=in.(${episodeIds.join(",")})&is_current=eq.true&select=id,filename,imported_at`
    );
    const scripts = await scriptsRes.json();
    if (Array.isArray(scripts) && scripts.length > 0) {
      scriptId = scripts[0].id as string;
      scriptUploadedAt = scripts[0].imported_at as string;
      scriptFilename = scripts[0].filename as string;

      const scenesRes = await dbFetch(
        `scenes?script_id=eq.${scriptId}&is_deleted=eq.false` +
          `&order=shoot_day.asc,shoot_order.asc,scene_number.asc` +
          `&select=id,scene_number,int_ext,location,time_of_day,is_complete,shoot_day,shoot_order,` +
          `breakdown_sheets(scene_elements(elements(name,category)))`
      );
      const rawScenes = await scenesRes.json();
      if (Array.isArray(rawScenes)) {
        scenes = rawScenes.map((r: Record<string, unknown>) => {
          const sheets = (r.breakdown_sheets as Record<string, unknown>[] | null) ?? [];
          const ses = (sheets[0]?.scene_elements as Record<string, unknown>[] | null) ?? [];
          const elements = ses
            .filter((se) => se.elements)
            .map((se) => {
              const el = se.elements as { name: string; category: string };
              return { name: el.name, category: el.category };
            });
          return {
            id: r.id as string,
            scene_number: r.scene_number as string,
            int_ext: (r.int_ext as string) ?? "",
            location: (r.location as string) ?? "",
            time_of_day: (r.time_of_day as string) ?? "",
            is_complete: (r.is_complete as boolean) ?? false,
            shoot_day: (r.shoot_day as number) ?? 0,
            elements,
          };
        });
      }
    }
  }

  // Shoot days
  const shootDaysRes = await dbFetch(
    `shoot_days?production_id=eq.${productionId}&order=day_number.asc&select=day_number,shoot_date`
  );
  const shootDaysRaw = await shootDaysRes.json();
  const shootDays: { dayNumber: number; shootDate: string | null }[] = Array.isArray(shootDaysRaw)
    ? shootDaysRaw.map((r: { day_number: number; shoot_date: string | null }) => ({
        dayNumber: r.day_number,
        shootDate: r.shoot_date ?? null,
      }))
    : [];

  // Serialisable map for client component
  const shootDates: Record<number, string | null> = {};
  for (const d of shootDays) shootDates[d.dayNumber] = d.shootDate;

  const today = new Date().toISOString().slice(0, 10);
  const datedDays = shootDays.filter((d) => d.shootDate);
  const nextDay = datedDays.find((d) => d.shootDate! >= today) ?? datedDays[datedDays.length - 1] ?? null;
  const firstShootDate = shootDays.find((d) => d.shootDate)?.shootDate ?? null;

  const totalScenes = scenes.length;
  const completeScenes = scenes.filter((s) => s.is_complete).length;
  const canEdit = userRole !== "viewer";

  // Script card: clickable if script exists
  const ScriptCard = scriptId ? (
    <a
      href={`/api/script-pdf?scriptId=${scriptId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="p-3 border-r border-black hover:bg-black hover:text-white transition-colors group block"
    >
      <p className="text-xs uppercase tracking-widest opacity-40 group-hover:opacity-60 mb-1">Script</p>
      <p className="font-bold text-sm truncate">{scriptFilename ?? "Current version"}</p>
      {scriptUploadedAt && (
        <p className="text-xs opacity-40 mt-0.5">{formatDate(scriptUploadedAt)}</p>
      )}
    </a>
  ) : (
    <div className="p-3 border-r border-black">
      <p className="text-xs uppercase tracking-widest opacity-40 mb-1">Script</p>
      <p className="text-sm opacity-40">No script uploaded</p>
    </div>
  );

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>

      {/* Sub-header */}
      <div className="shrink-0 border-b border-black px-6 py-3 flex items-center gap-3">
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
        {userRole === "owner" && (
          <Link
            href={`/cloud/productions/${cloudId}/members`}
            className="ml-auto text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity"
          >
            Members
          </Link>
        )}
      </div>

      {/* Fixed content: stats + nav */}
      <div className="shrink-0 px-6 pt-4 pb-2 max-w-4xl w-full mx-auto">

        {/* At a glance — compact stat bar */}
        <div className="grid grid-cols-3 border border-black mb-4">
          {ScriptCard}

          <div className="p-3 border-r border-black">
            <p className="text-xs uppercase tracking-widest opacity-40 mb-1">Shoot start</p>
            {firstShootDate ? (
              <>
                <p className="font-bold text-sm">{formatDate(firstShootDate)}</p>
                <p className="text-xs opacity-40 mt-0.5">Day 1 of {shootDays.length}</p>
              </>
            ) : (
              <p className="text-sm opacity-40">Not scheduled</p>
            )}
          </div>

          <div className="p-3">
            <p className="text-xs uppercase tracking-widest opacity-40 mb-1">Breakdown</p>
            {totalScenes > 0 ? (
              <>
                <p className="font-bold text-sm">{completeScenes}/{totalScenes} complete</p>
                <div className="mt-1.5 h-0.5 bg-black/10">
                  <div
                    className="h-0.5 bg-black"
                    style={{ width: `${(completeScenes / totalScenes) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm opacity-40">No scenes yet</p>
            )}
          </div>
        </div>

        {/* Navigation tiles */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
          <Link
            href={`/cloud/productions/${cloudId}/breakdown`}
            className="border border-black p-3 hover:bg-black hover:text-white transition-colors group col-span-1"
          >
            <p className="text-[10px] uppercase tracking-widest opacity-50 group-hover:opacity-60 mb-1">Breakdown</p>
            <p className="font-bold text-sm">{totalScenes > 0 ? `${totalScenes} scenes` : "—"}</p>
          </Link>

          <Link
            href={`/cloud/productions/${cloudId}/sidings`}
            className="border border-black p-3 hover:bg-black hover:text-white transition-colors group col-span-1"
          >
            <p className="text-[10px] uppercase tracking-widest opacity-50 group-hover:opacity-60 mb-1">Sidings</p>
            <p className="font-bold text-sm">{nextDay ? `Day ${nextDay.dayNumber}` : "—"}</p>
          </Link>

          <Link
            href={`/cloud/productions/${cloudId}/tasks`}
            className="border border-black/20 p-3 transition-colors group col-span-1"
          >
            <p className="text-[10px] uppercase tracking-widest opacity-30 mb-1">Tasks</p>
            <p className="font-bold text-sm opacity-30">Soon</p>
          </Link>

          <Link
            href={`/cloud/productions/${cloudId}/continuity`}
            className="border border-black/20 p-3 transition-colors group col-span-1"
          >
            <p className="text-[10px] uppercase tracking-widest opacity-30 mb-1">Continuity</p>
            <p className="font-bold text-sm opacity-30">Soon</p>
          </Link>

          <Link
            href={`/cloud/productions/${cloudId}/budget`}
            className="border border-black/20 p-3 transition-colors group col-span-1"
          >
            <p className="text-[10px] uppercase tracking-widest opacity-30 mb-1">Budget</p>
            <p className="font-bold text-sm opacity-30">Soon</p>
          </Link>

          {canEdit && totalScenes > 0 ? (
            <a
              href={`/api/export-breakdown?cloudId=${cloudId}`}
              className="border border-black/20 p-3 hover:border-black/40 transition-colors col-span-1"
            >
              <p className="text-[10px] uppercase tracking-widest opacity-30 mb-1">Export</p>
              <p className="font-bold text-sm opacity-40">PDF</p>
            </a>
          ) : (
            <div className="col-span-1" />
          )}
        </div>

        {/* Scenes section label */}
        {totalScenes > 0 && (
          <p className="text-xs uppercase tracking-widest opacity-30">Scenes — shoot order</p>
        )}
      </div>

      {/* Scrollable scenes list */}
      <div className="flex-1 overflow-y-auto px-6 pb-4 max-w-4xl w-full mx-auto">
        {totalScenes > 0 ? (
          <DigestSceneList
            scenes={scenes}
            shootDates={shootDates}
            cloudId={cloudId}
          />
        ) : canEdit ? (
          <div className="text-center py-12">
            <p className="text-sm opacity-30 mb-4">No script uploaded yet.</p>
            <Link
              href={`/cloud/productions/${cloudId}/upload`}
              className="bg-black text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 hover:opacity-80 transition-opacity"
            >
              Upload Script PDF
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
