import { requireCloudSession } from "@/lib/cloud-session";
import { notFound } from "next/navigation";
import Link from "next/link";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function TasksPage({
  params,
}: {
  params: Promise<{ cloudId: string }>;
}) {
  const { cloudId } = await params;
  const session = await requireCloudSession();

  const res = await fetch(
    `${SB_URL}/rest/v1/productions?cloud_id=eq.${cloudId}&owner_id=eq.${session.id}&select=name`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, cache: "no-store" }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) notFound();
  const production = rows[0] as { name: string };

  const subject = encodeURIComponent(`I need Tasks — ${production.name}`);
  const body = encodeURIComponent(
    `I'd find the Tasks module useful for ${production.name}. Here's why:\n\n`
  );

  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-8">
        <Link href="/cloud/dashboard" className="hover:opacity-100">Dashboard</Link>
        {" / "}
        <Link href={`/cloud/productions/${cloudId}`} className="hover:opacity-100">
          {production.name}
        </Link>
        {" / Tasks"}
      </p>

      <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-4">Coming soon</p>
      <h1 className="text-3xl font-bold mb-6 leading-tight">
        Prep tracking for the whole department.
      </h1>
      <p className="text-base leading-relaxed opacity-60 mb-10 max-w-lg">
        Assign tasks. Set priorities. Track progress scene by scene.
        Flag blockers, get approvals, and see at a glance what&apos;s done and
        what&apos;s stuck — without chasing anyone over WhatsApp.
      </p>

      <div className="border border-black/10 divide-y divide-black/10 mb-10">
        {[
          ["Assign tasks to anyone on the production", "Scene-level or production-wide"],
          ["Priority, due date, and blocked status", "Know what's at risk before it becomes a problem"],
          ["Approval requests", "Get sign-off from director or HOD without the back-and-forth"],
          ["Progress at a glance", "See the whole department's prep status in one view"],
        ].map(([title, sub]) => (
          <div key={title} className="px-5 py-4">
            <p className="text-sm font-bold">{title}</p>
            <p className="text-xs opacity-40 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <a
        href={`mailto:hello@flip-the-script.app?subject=${subject}&body=${body}`}
        className="inline-block bg-black text-white text-xs font-bold uppercase tracking-widest px-5 py-3 hover:opacity-80 transition-opacity"
      >
        I need this →
      </a>
      <p className="text-xs opacity-30 mt-4">
        Tells us you want it. We&apos;ll be in touch when it&apos;s ready.
      </p>
    </div>
  );
}
