import { requireCloudSession } from "@/lib/cloud-session";
import { notFound } from "next/navigation";
import Link from "next/link";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function ContinuityPage({
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

  const subject = encodeURIComponent(`I need Continuity — ${production.name}`);
  const body = encodeURIComponent(
    `I'd find the Continuity module useful for ${production.name}. Here's why:\n\n`
  );

  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-8">
        <Link href="/cloud/dashboard" className="hover:opacity-100">Dashboard</Link>
        {" / "}
        <Link href={`/cloud/productions/${cloudId}`} className="hover:opacity-100">
          {production.name}
        </Link>
        {" / Continuity"}
      </p>

      <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-4">Coming soon</p>
      <h1 className="text-3xl font-bold mb-6 leading-tight">
        Track what was actually used on the day.
      </h1>
      <p className="text-base leading-relaxed opacity-60 mb-10 max-w-lg">
        Log continuity against every scene as it&apos;s filmed — sets, props,
        dressing, costume. Flag discrepancies before you wrap. Pre-populated
        from your breakdown so there&apos;s no double entry.
      </p>

      <div className="border border-black/10 divide-y divide-black/10 mb-10">
        {[
          ["Scene-by-scene continuity log", "Pre-filled from your breakdown — just confirm or correct"],
          ["Photo attachments", "Attach reference shots directly to a scene or element"],
          ["Discrepancy flags", "Raise a continuity issue and assign it to the right person"],
          ["On-set access", "Works on iPad and iPhone — no laptop needed on the floor"],
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
