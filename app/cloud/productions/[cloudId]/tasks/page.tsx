import { requireCloudSession } from "@/lib/cloud-session";
import { notFound } from "next/navigation";
import Link from "next/link";
import TaskList from "./TaskList";

export const metadata = { title: "My Flags — FlipTheScript" };

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function dbFetch(path: string) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    cache: "no-store",
  });
}

export default async function TasksPage({
  params,
}: {
  params: Promise<{ cloudId: string }>;
}) {
  const { cloudId } = await params;
  const session = await requireCloudSession();

  // Access check — any member can see this page
  const prodRes = await dbFetch(
    `productions?cloud_id=eq.${cloudId}&select=id,name,owner_id`
  );
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) notFound();
  const prod = prods[0] as { id: string; name: string; owner_id: string };

  if (prod.owner_id !== session.id) {
    const memberRes = await dbFetch(
      `production_members?production_id=eq.${prod.id}&user_id=eq.${session.id}&select=role`
    );
    const members = await memberRes.json();
    if (!Array.isArray(members) || members.length === 0) notFound();
  }

  // Fetch this user's flags with full context
  const flagsRes = await dbFetch(
    `element_flags?production_id=eq.${prod.id}&user_id=eq.${session.id}` +
      `&order=due_date.asc.nullslast,created_at.asc` +
      `&select=id,note,due_date,is_done,scene_element_id,` +
      `scene_elements(elements(name,category),breakdown_sheets(scenes(scene_number,location,int_ext,cloud_id)))`
  );
  const flagsRaw = await flagsRes.json();

  type RawFlag = {
    id: string;
    note: string;
    due_date: string | null;
    is_done: boolean;
    scene_element_id: string;
    scene_elements: {
      elements: { name: string; category: string };
      breakdown_sheets: { scenes: { scene_number: string; location: string; int_ext: string; cloud_id: string } };
    };
  };

  const flags = Array.isArray(flagsRaw)
    ? flagsRaw
        .filter((f: RawFlag) => f.scene_elements?.elements && f.scene_elements?.breakdown_sheets?.scenes)
        .map((f: RawFlag) => ({
          id: f.id,
          note: f.note,
          due_date: f.due_date,
          is_done: f.is_done,
          element_name: f.scene_elements.elements.name,
          category: f.scene_elements.elements.category,
          scene_number: f.scene_elements.breakdown_sheets.scenes.scene_number,
          location: f.scene_elements.breakdown_sheets.scenes.location,
          int_ext: f.scene_elements.breakdown_sheets.scenes.int_ext,
          scene_cloud_id: f.scene_elements.breakdown_sheets.scenes.cloud_id,
        }))
    : [];

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-8">
        <Link href="/cloud/dashboard" className="hover:opacity-100">Dashboard</Link>
        {" / "}
        <Link href={`/cloud/productions/${cloudId}`} className="hover:opacity-100">
          {prod.name}
        </Link>
        {" / My flags"}
      </p>

      <h1 className="text-2xl font-bold mb-1">My flags</h1>
      <p className="text-sm opacity-40 mb-8">
        Elements you&apos;ve flagged in this production. Flag anything in the breakdown by clicking ⚑ on an element.
      </p>

      <TaskList initial={flags} cloudId={cloudId} />
    </div>
  );
}
