import { requireCloudSession } from "@/lib/cloud-session";
import { notFound } from "next/navigation";
import Link from "next/link";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function BudgetPage({
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

  const subject = encodeURIComponent(`I need Budget — ${production.name}`);
  const body = encodeURIComponent(
    `I'd find the Budget module useful for ${production.name}. Here's why:\n\n`
  );

  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-8">
        <Link href="/cloud/dashboard" className="hover:opacity-100">Dashboard</Link>
        {" / "}
        <Link href={`/cloud/productions/${cloudId}`} className="hover:opacity-100">
          {production.name}
        </Link>
        {" / Budget"}
      </p>

      <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-4">Coming soon</p>
      <h1 className="text-3xl font-bold mb-6 leading-tight">
        Art department budget, from estimate to actuals.
      </h1>
      <p className="text-base leading-relaxed opacity-60 mb-10 max-w-lg">
        Build your budget line by line, tied directly to your breakdown.
        Track spend as prep progresses. See what&apos;s been bought, what&apos;s
        pending, and what&apos;s over budget — before it becomes a conversation
        you don&apos;t want to have.
      </p>

      <div className="border border-black/10 divide-y divide-black/10 mb-10">
        {[
          ["Budget lines tied to the breakdown", "Estimate costs against scenes and elements from day one"],
          ["Actuals tracking", "Log spend as it happens — receipts, POs, petty cash"],
          ["Over-budget alerts", "Know the moment a line item goes red, not at wrap"],
          ["HOD and production summary views", "Show exactly what they need to see, nothing more"],
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
