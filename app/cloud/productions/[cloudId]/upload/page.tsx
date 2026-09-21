import { requireCloudSession } from "@/lib/cloud-session";
import { notFound } from "next/navigation";
import UploadClient from "./UploadClient";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function dbFetch(path: string) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    cache: "no-store",
  });
}

export default async function UploadScriptPage({
  params,
}: {
  params: Promise<{ cloudId: string }>;
}) {
  const { cloudId } = await params;
  const session = await requireCloudSession();

  // Verify ownership
  const prodRes = await dbFetch(
    `productions?cloud_id=eq.${cloudId}&owner_id=eq.${session.id}&select=id,name`
  );
  const prods = await prodRes.json();
  if (!Array.isArray(prods) || prods.length === 0) notFound();
  const production = prods[0] as { id: string; name: string };

  // Find current script (if any) so we can offer the inherit option
  const epRes = await dbFetch(
    `episodes?production_id=eq.${production.id}&select=id`
  );
  const episodes = await epRes.json();
  let currentScriptId: string | null = null;
  let currentScriptName: string | null = null;

  if (Array.isArray(episodes) && episodes.length > 0) {
    const epIds = episodes.map((e: { id: string }) => e.id).join(",");
    const scriptRes = await dbFetch(
      `scripts?episode_id=in.(${epIds})&is_current=eq.true&select=id,filename,version&limit=1`
    );
    const scripts = await scriptRes.json();
    if (Array.isArray(scripts) && scripts.length > 0) {
      currentScriptId = scripts[0].id;
      currentScriptName = `${scripts[0].filename} (${scripts[0].version})`;
    }
  }

  return (
    <UploadClient
      cloudId={cloudId}
      productionId={production.id}
      productionName={production.name}
      currentScriptId={currentScriptId}
      currentScriptName={currentScriptName}
    />
  );
}
