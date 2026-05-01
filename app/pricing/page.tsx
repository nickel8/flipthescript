import SiteShell from "../components/SiteShell";

const DOWNLOAD_URL = "/downloads/FlipTheScript.dmg";

export const metadata = {
  title: "Pricing — FlipTheScript",
  description: "Simple, honest pricing. One plan, no per-seat fees.",
};

export default function PricingPage() {
  return (
    <SiteShell>

      {/* Hero */}
      <section className="border-b border-black px-6 py-20">
        <p className="text-xs tracking-widest uppercase mb-8 opacity-40">Pricing</p>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
          One plan. No surprises.
        </h1>
        <p className="text-lg opacity-55 max-w-xl">
          Full access to every feature. No per-seat fees — invite your whole department.
        </p>
      </section>

      {/* Plans */}
      <section className="border-b border-black grid grid-cols-1 md:grid-cols-3">

        {/* Trial */}
        <div className="p-10 border-b md:border-b-0 md:border-r border-black">
          <p className="text-xs tracking-widest uppercase opacity-40 mb-6">Free trial</p>
          <p className="text-4xl font-bold mb-2">£0</p>
          <p className="text-sm opacity-55 mb-8">14 days, no card required</p>
          <ul className="space-y-3 text-sm opacity-70">
            <li>✓ Full access to all features</li>
            <li>✓ Import unlimited scripts</li>
            <li>✓ No credit card needed</li>
          </ul>
          <div className="mt-10">
            <a
              href={DOWNLOAD_URL}
              download
              className="inline-block border border-black text-sm font-bold px-6 py-3 hover:bg-black hover:text-white transition-colors"
            >
              Download free →
            </a>
          </div>
        </div>

        {/* Monthly */}
        <div className="p-10 border-b md:border-b-0 md:border-r border-black">
          <p className="text-xs tracking-widest uppercase opacity-40 mb-6">Monthly</p>
          <p className="text-4xl font-bold mb-2">£15</p>
          <p className="text-sm opacity-55 mb-8">per month, cancel any time</p>
          <ul className="space-y-3 text-sm opacity-70">
            <li>✓ Unlimited productions</li>
            <li>✓ PDF + CSV export</li>
            <li>✓ Revision tracking across drafts</li>
            <li>✓ Team sharing</li>
            <li>✓ Email support</li>
          </ul>
          <div className="mt-10">
            <a
              href="#"
              className="inline-block bg-black text-white text-sm font-bold px-6 py-3 hover:opacity-75 transition-opacity"
            >
              Get started →
            </a>
          </div>
        </div>

        {/* Annual */}
        <div className="p-10 relative">
          <div className="absolute top-6 right-6">
            <span className="text-xs font-bold bg-black text-white px-3 py-1">
              SAVE 17%
            </span>
          </div>
          <p className="text-xs tracking-widest uppercase opacity-40 mb-6">Annual</p>
          <p className="text-4xl font-bold mb-2">£149</p>
          <p className="text-sm opacity-55 mb-8">per year — that&apos;s £12.42/month</p>
          <ul className="space-y-3 text-sm opacity-70">
            <li>✓ Everything in Monthly</li>
            <li>✓ Best value for working productions</li>
            <li>✓ One invoice for accounting</li>
          </ul>
          <div className="mt-10">
            <a
              href="#"
              className="inline-block bg-black text-white text-sm font-bold px-6 py-3 hover:opacity-75 transition-opacity"
            >
              Get started →
            </a>
          </div>
        </div>

      </section>

      {/* FAQ */}
      <section className="border-b border-black px-6 py-16 max-w-2xl">
        <p className="text-xs tracking-widest uppercase opacity-40 mb-12">Common questions</p>
        <div className="space-y-10">
          {[
            {
              q: "How does the free trial work?",
              a: "Download the app and you have 14 days of full access — no credit card required. At the end of the trial you'll be prompted to enter a license key.",
            },
            {
              q: "Is it per seat?",
              a: "No. One license covers one person. Your team members can view shared breakdowns for free via a read-only web link — they only need a license if they want to create and edit their own productions.",
            },
            {
              q: "Can I switch between monthly and annual?",
              a: "Yes. You can upgrade from monthly to annual at any time and we'll pro-rate the difference.",
            },
            {
              q: "What happens if I cancel?",
              a: "Your data stays on your Mac. You can still view everything you've created — you just won't be able to import new scripts or create new productions until you reactivate.",
            },
          ].map((item) => (
            <div key={item.q} className="border-b border-black pb-10 last:border-b-0 last:pb-0">
              <p className="font-bold mb-3">{item.q}</p>
              <p className="opacity-55 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

    </SiteShell>
  );
}
