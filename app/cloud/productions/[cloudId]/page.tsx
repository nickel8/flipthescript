import { requireCloudSession } from "@/lib/cloud-session";
import { notFound } from "next/navigation";
import Link from "next/link";

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

  // Episodes → scripts → scenes (lighter select for digest)
  const episodesRes = await dbFetch(`episodes?production_id=eq.${productionId}&select=id`);
  const episodes = await episodesRes.json();
  const episodeIds: string[] = Array.isArray(episodes)
    ? episodes.map((e: { id: string }) => e.id)
    : [];

  type DigestScene = {
    id: string;
    cloud_id: string;
    scene_number: string;
    slug_line: string;
    int_ext: string;
    location: string;
    time_of_day: string;
    is_complete: boolean;
    shoot_day: number;
    shoot_order: number;
    element_count: number;
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
          `&select=id,cloud_id,scene_number,slug_line,int_ext,location,time_of_day,` +
          `is_complete,shoot_day,shoot_order,` +
          `breakdown_sheets(scene_elements(id))`
      );
      const rawScenes = await scenesRes.json();
      if (Array.isArray(rawScenes)) {
        scenes = rawScenes.map((r: Record<string, unknown>) => {
          const sheets = (r.breakdown_sheets as Record<string, unknown>[] | null) ?? [];
          const ses = (sheets[0]?.scene_elements as { id: string }[] | null) ?? [];
          return {
            id: r.id as string,
            cloud_id: r.cloud_id as string,
            scene_number: r.scene_number as string,
            slug_line: r.slug_line as string,
            int_ext: (r.int_ext as string) ?? "",
            location: (r.location as string) ?? "",
            time_of_day: (r.time_of_day as string) ?? "",
            is_complete: (r.is_complete as boolean) ?? false,
            shoot_day: (r.shoot_day as number) ?? 0,
            shoot_order: (r.shoot_order as number) ?? 0,
            element_count: ses.length,
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

  const shootDateMap = new Map(shootDays.map((d) => [d.dayNumber, d.shootDate]));
  const today = new Date().toISOString().slice(0, 10);
  const datedDays = shootDays.filter((d) => d.shootDate);
  const nextDay = datedDays.find((d) => d.shootDate! >= today) ?? datedDays[datedDays.length - 1] ?? null;
  const firstShootDate = shootDays.find((d) => d.shootDate)?.shootDate ?? null;

  const totalScenes = scenes.length;
  const completeScenes = scenes.filter((s) => s.is_complete).length;

  // Group scenes by shoot day for the prep list
  const grouped = new Map<number, DigestScene[]>();
  for (const scene of scenes) {
    const day = scene.shoot_day ?? 0;
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(scene);
  }
  const sortedDays = [...grouped.keys()].sort((a, b) => {
    if (a === 0) return 1;
    if (b === 0) return -1;
    return a - b;
  });

  const canEdit = userRole !== "viewer";

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="border-b border-black px-6 py-3 flex items-center gap-3">
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

      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* At a glance */}
        <div className="grid grid-cols-3 border border-black mb-10">
          <div className="p-6 border-r border-black">
            <p className="text-xs uppercase tracking-widest opacity-40 mb-2">Script</p>
            {scriptId ? (
              <>
                <p className="font-bold text-sm truncate">{scriptFilename ?? "Current version"}</p>
                {scriptUploadedAt && (
                  <p className="text-xs opacity-40 mt-1">{formatDate(scriptUploadedAt)}</p>
                )}
              </>
            ) : (
              <p className="text-sm opacity-40">No script uploaded</p>
            )}
          </div>
          <div className="p-6 border-r border-black">
            <p className="text-xs uppercase tracking-widest opacity-40 mb-2">Shoot start</p>
            {firstShootDate ? (
              <>
                <p className="font-bold text-sm">{formatDate(firstShootDate)}</p>
                <p className="text-xs opacity-40 mt-1">Day 1 of {shootDays.length}</p>
              </>
            ) : (
              <p className="text-sm opacity-40">Not scheduled</p>
            )}
          </div>
          <div className="p-6">
            <p className="text-xs uppercase tracking-widest opacity-40 mb-2">Breakdown</p>
            {totalScenes > 0 ? (
              <>
                <p className="font-bold text-sm">
                  {completeScenes}/{totalScenes} scenes complete
                </p>
                <div className="mt-2 h-1 bg-black/10">
                  <div
                    className="h-1 bg-black transition-all"
                    style={{ width: `${(completeScenes / totalScenes) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm opacity-40">No scenes yet</p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest opacity-30 mb-4">Go to</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

            <Link
              href={`/cloud/productions/${cloudId}/breakdown`}
              className="border border-black p-5 hover:bg-black hover:text-white transition-colors group"
            >
              <p className="text-xs uppercase tracking-widest opacity-50 group-hover:opacity-60 mb-2">Script breakdown</p>
              <p className="font-bold">
                {totalScenes > 0 ? `${totalScenes} scenes` : "No script yet"}
              </p>
            </Link>

            {scriptId ? (
              <a
                href={`/api/script-pdf?scriptId=${scriptId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-black p-5 hover:bg-black hover:text-white transition-colors group"
              >
                <p className="text-xs uppercase tracking-widest opacity-50 group-hover:opacity-60 mb-2">Script PDF</p>
                <p className="font-bold">View</p>
              </a>
            ) : canEdit ? (
              <Link
                href={`/cloud/productions/${cloudId}/upload`}
                className="border border-black p-5 hover:bg-black hover:text-white transition-colors group"
              >
                <p className="text-xs uppercase tracking-widest opacity-50 group-hover:opacity-60 mb-2">Script PDF</p>
                <p className="font-bold">Upload script</p>
              </Link>
            ) : null}

            <Link
              href={`/cloud/productions/${cloudId}/sidings`}
              className="border border-black p-5 hover:bg-black hover:text-white transition-colors group"
            >
              <p className="text-xs uppercase tracking-widest opacity-50 group-hover:opacity-60 mb-2">Sidings</p>
              <p className="font-bold">
                {firstShootDate ? `Day ${nextDay?.dayNumber ?? "—"}` : "Next shoot day"}
              </p>
            </Link>

            <Link
              href={`/cloud/productions/${cloudId}/tasks`}
              className="border border-black/20 p-5 hover:border-black/40 transition-colors group"
            >
              <p className="text-xs uppercase tracking-widest opacity-30 mb-2">Tasks</p>
              <p className="font-bold opacity-30">Coming soon</p>
            </Link>

            <Link
              href={`/cloud/productions/${cloudId}/continuity`}
              className="border border-black/20 p-5 hover:border-black/40 transition-colors group"
            >
              <p className="text-xs uppercase tracking-widest opacity-30 mb-2">Continuity</p>
              <p className="font-bold opacity-30">Coming soon</p>
            </Link>

            <Link
              href={`/cloud/productions/${cloudId}/budget`}
              className="border border-black/20 p-5 hover:border-black/40 transition-colors group"
            >
              <p className="text-xs uppercase tracking-widest opacity-30 mb-2">Budget</p>
              <p className="font-bold opacity-30">Coming soon</p>
            </Link>

            {canEdit && totalScenes > 0 && (
              <a
                href={`/api/export-breakdown?cloudId=${cloudId}`}
                className="border border-black/20 p-5 hover:border-black/40 transition-colors"
              >
                <p className="text-xs uppercase tracking-widest opacity-30 mb-2">Export</p>
                <p className="font-bold opacity-50">Breakdown PDF</p>
              </a>
            )}
          </div>
        </div>

        {/* Prep list — scenes in shoot order */}
        {totalScenes > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest opacity-30 mb-4">Scenes — shoot order</p>

            {sortedDays.map((day) => {
              const dayScenes = grouped.get(day)!;
              const shootDate = day > 0 ? shootDateMap.get(day) : null;
              return (
                <div key={day} className="mb-6">
                  {/* Day header */}
                  <div className="flex items-baseline gap-3 mb-2 pb-1 border-b border-black/10">
                    <span className="text-xs font-bold uppercase tracking-widest">
                      {day === 0 ? "Unscheduled" : `Day ${day}`}
                    </span>
                    {shootDate && (
                      <span className="text-xs opacity-40">{formatDate(shootDate)}</span>
                    )}
                    <span className="ml-auto text-xs opacity-30">
                      {dayScenes.filter((s) => s.is_complete).length}/{dayScenes.length} complete
                    </span>
                  </div>

                  {/* Scenes */}
                  <div className="divide-y divide-black/5">
                    {dayScenes.map((scene) => (
                      <Link
                        key={scene.id}
                        href={`/cloud/productions/${cloudId}/breakdown`}
                        className="flex items-center gap-3 py-2.5 hover:bg-black/3 transition-colors group -mx-2 px-2"
                      >
                        <span className="text-xs font-mono opacity-30 w-8 shrink-0 tabular-nums">
                          {scene.scene_number}
                        </span>
                        <span
                          className={`text-xs font-bold px-1 py-0.5 shrink-0 ${
                            scene.int_ext === "EXT"
                              ? "bg-green-100 text-green-700"
                              : scene.int_ext === "INT/EXT"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {scene.int_ext || "INT"}
                        </span>
                        <span className="text-sm flex-1 truncate">
                          {scene.location}
                          {scene.time_of_day && scene.time_of_day !== "UNSPECIFIED" && (
                            <span className="opacity-40 ml-1.5 text-xs">{scene.time_of_day}</span>
                          )}
                        </span>
                        {scene.element_count > 0 && (
                          <span className="text-xs opacity-30 shrink-0">
                            {scene.element_count} element{scene.element_count !== 1 ? "s" : ""}
                          </span>
                        )}
                        {scene.is_complete ? (
                          <span className="text-xs text-green-600 font-bold shrink-0">✓</span>
                        ) : (
                          <span className="w-3 shrink-0" />
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalScenes === 0 && canEdit && (
          <div className="text-center py-16">
            <p className="text-sm opacity-30 mb-4">No script uploaded yet.</p>
            <Link
              href={`/cloud/productions/${cloudId}/upload`}
              className="bg-black text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 hover:opacity-80 transition-opacity"
            >
              Upload Script PDF
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
