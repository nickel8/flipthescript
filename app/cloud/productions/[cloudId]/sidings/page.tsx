import { requireCloudSession } from "@/lib/cloud-session";
import { notFound } from "next/navigation";
import Link from "next/link";
import PrintButton from "./PrintButton";

export const metadata = { title: "Sidings — FlipTheScript" };

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
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function SidingsPage({
  params,
}: {
  params: Promise<{ cloudId: string }>;
}) {
  const { cloudId } = await params;
  const session = await requireCloudSession();

  // Access check
  const prodRes = await dbFetch(`productions?cloud_id=eq.${cloudId}&select=id,name,owner_id`);
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) notFound();
  const prodRaw = prods[0] as { id: string; name: string; owner_id: string };

  if (prodRaw.owner_id !== session.id) {
    const memberRes = await dbFetch(
      `production_members?production_id=eq.${prodRaw.id}&user_id=eq.${session.id}&select=role`
    );
    const memberRows = await memberRes.json();
    if (!Array.isArray(memberRows) || memberRows.length === 0) notFound();
  }

  const productionId = prodRaw.id;

  // Shoot days — find the next one from today
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

  // Today in YYYY-MM-DD (server time / UTC — close enough for this purpose)
  const today = new Date().toISOString().slice(0, 10);

  // Find: today if it's a shoot day, otherwise the next upcoming day, otherwise the last scheduled day
  const datedDays = shootDays.filter((d) => d.shootDate);
  const nextDay =
    datedDays.find((d) => d.shootDate! >= today) ?? datedDays[datedDays.length - 1] ?? null;

  // Also allow ?day=N override for "what's on day X?"
  type SceneWithSheet = {
    id: string;
    scene_number: string;
    slug_line: string;
    int_ext: string;
    location: string;
    time_of_day: string;
    page_start: number;
    is_complete: boolean;
    shoot_order: number;
    synopsis: string;
    elements: { category: string; name: string }[];
  };

  let scenes: SceneWithSheet[] = [];
  let activeDayNumber: number | null = nextDay?.dayNumber ?? null;
  let activeDayDate: string | null = nextDay?.shootDate ?? null;

  // Fallback: if no dated day found, use any shoot day with scenes (day 1)
  if (!activeDayNumber && shootDays.length > 0) {
    activeDayNumber = shootDays[0].dayNumber;
  }

  if (activeDayNumber !== null) {
    // Get current script
    const episodesRes = await dbFetch(`episodes?production_id=eq.${productionId}&select=id`);
    const episodes = await episodesRes.json();
    const episodeIds: string[] = Array.isArray(episodes)
      ? episodes.map((e: { id: string }) => e.id)
      : [];

    if (episodeIds.length > 0) {
      const scriptsRes = await dbFetch(
        `scripts?episode_id=in.(${episodeIds.join(",")})&is_current=eq.true&select=id`
      );
      const scripts = await scriptsRes.json();
      const scriptId: string | null =
        Array.isArray(scripts) && scripts.length > 0 ? scripts[0].id : null;

      if (scriptId) {
        const scenesRes = await dbFetch(
          `scenes?script_id=eq.${scriptId}&is_deleted=eq.false&shoot_day=eq.${activeDayNumber}` +
            `&order=shoot_order.asc,scene_number.asc` +
            `&select=id,scene_number,slug_line,int_ext,location,time_of_day,page_start,is_complete,shoot_order,` +
            `breakdown_sheets(synopsis,scene_elements(elements(name,category)))`
        );
        const rawScenes = await scenesRes.json();
        if (Array.isArray(rawScenes)) {
          scenes = rawScenes.map((r: Record<string, unknown>) => {
            const sheets = (r.breakdown_sheets as Record<string, unknown>[] | null) ?? [];
            const sheet = sheets[0] ?? {};
            const ses = (sheet.scene_elements as Record<string, unknown>[] | null) ?? [];
            const elements = ses
              .filter((se) => se.elements)
              .map((se) => {
                const el = se.elements as { name: string; category: string };
                return { category: el.category, name: el.name };
              })
              .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
            return {
              id: r.id as string,
              scene_number: r.scene_number as string,
              slug_line: r.slug_line as string,
              int_ext: (r.int_ext as string) ?? "",
              location: (r.location as string) ?? "",
              time_of_day: (r.time_of_day as string) ?? "",
              page_start: (r.page_start as number) ?? 0,
              is_complete: (r.is_complete as boolean) ?? false,
              shoot_order: (r.shoot_order as number) ?? 0,
              synopsis: (sheet.synopsis as string) ?? "",
              elements,
            };
          });
        }
      }
    }
  }

  // Group elements by category for each scene
  function groupByCategory(elements: { category: string; name: string }[]) {
    const map = new Map<string, string[]>();
    for (const el of elements) {
      if (!map.has(el.category)) map.set(el.category, []);
      map.get(el.category)!.push(el.name);
    }
    return map;
  }

  const noShootDays = shootDays.length === 0;
  const noScenesOnDay = scenes.length === 0 && activeDayNumber !== null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 print:py-0 print:px-0">
      {/* Back nav — hidden on print */}
      <div className="print:hidden mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs uppercase tracking-widest opacity-40">
          <Link href={`/cloud/productions/${cloudId}`} className="hover:opacity-100">
            ← Overview
          </Link>
          <span>/</span>
          <span>{prodRaw.name}</span>
          <span>/</span>
          <span>Sidings</span>
        </div>
        {scenes.length > 0 && <PrintButton />}
      </div>

      {/* Sidings header */}
      <div className="border-b-2 border-black pb-4 mb-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-40 mb-1">Sidings</p>
            <h1 className="text-2xl font-bold">{prodRaw.name}</h1>
          </div>
          <div className="text-right">
            {activeDayNumber !== null && (
              <p className="font-bold text-lg">Day {activeDayNumber}</p>
            )}
            {activeDayDate && (
              <p className="text-sm opacity-50">{formatDate(activeDayDate)}</p>
            )}
          </div>
        </div>
      </div>

      {/* No schedule configured */}
      {noShootDays && (
        <div className="py-16 text-center">
          <p className="text-sm opacity-40 mb-2">No shoot schedule imported yet.</p>
          <Link
            href={`/cloud/productions/${cloudId}/schedule`}
            className="text-xs font-bold uppercase tracking-widest border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
          >
            Import schedule
          </Link>
        </div>
      )}

      {/* No scenes on this day */}
      {!noShootDays && noScenesOnDay && (
        <p className="text-sm opacity-40 py-16 text-center">
          No scenes scheduled for Day {activeDayNumber}.
        </p>
      )}

      {/* Scenes */}
      <div className="space-y-8">
        {scenes.map((scene, idx) => {
          const byCategory = groupByCategory(scene.elements);
          const cats = [...byCategory.keys()];
          return (
            <div key={scene.id} className={`${idx > 0 ? "border-t border-black/20 pt-8" : ""}`}>
              {/* Scene header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs opacity-40 font-bold">{scene.scene_number}</span>
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 ${
                      scene.int_ext === "EXT"
                        ? "bg-green-100 text-green-700"
                        : scene.int_ext === "INT/EXT"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {scene.int_ext || "INT"}
                  </span>
                  <span className="font-bold text-base">{scene.location}</span>
                  {scene.time_of_day && scene.time_of_day !== "UNSPECIFIED" && (
                    <span className="text-sm opacity-40">{scene.time_of_day}</span>
                  )}
                  {scene.page_start > 0 && (
                    <span className="text-xs opacity-30">p.{scene.page_start}</span>
                  )}
                </div>
                {scene.is_complete && (
                  <span className="text-xs text-green-600 font-bold shrink-0">✓ Complete</span>
                )}
              </div>

              {/* Synopsis */}
              {scene.synopsis && (
                <p className="text-sm leading-relaxed opacity-60 mb-4 italic">{scene.synopsis}</p>
              )}

              {/* Elements grid */}
              {cats.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                  {cats.map((cat) => (
                    <div key={cat}>
                      <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-1">
                        {cat}
                      </p>
                      <ul className="space-y-0.5">
                        {byCategory.get(cat)!.map((name) => (
                          <li key={name} className="text-sm">
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {cats.length === 0 && (
                <p className="text-xs opacity-25 italic">No elements logged for this scene.</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Print footer */}
      {scenes.length > 0 && (
        <div className="hidden print:block mt-12 pt-4 border-t border-black/20 text-xs opacity-40 flex justify-between">
          <span>FlipTheScript — Sidings</span>
          <span>{prodRaw.name} — Day {activeDayNumber}</span>
        </div>
      )}
    </div>
  );
}
