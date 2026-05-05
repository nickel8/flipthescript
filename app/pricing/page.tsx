import SiteShell from "../components/SiteShell";
import PaddleCheckoutButton from "../components/PaddleCheckoutButton";

const MONTHLY_PRICE_ID  = process.env.NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID!;
const ANNUAL_PRICE_ID   = process.env.NEXT_PUBLIC_PADDLE_ANNUAL_PRICE_ID!;
const LIFETIME_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_LIFETIME_PRICE_ID!;

export const metadata = {
  title: "Pricing — FlipTheScript",
  description: "Simple, honest pricing for art department professionals.",
};

export default function PricingPage() {
  return (
    <SiteShell>

      {/* Hero */}
      <section className="border-b border-black px-6 py-20">
        <p className="text-xs tracking-widest uppercase mb-8 opacity-40">Pricing</p>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
          Simple, honest pricing.
        </h1>
        <p className="text-lg opacity-55 max-w-xl">
          One license, one person. Try free for a day — no card required.
        </p>
      </section>

      {/* Plans */}
      <section className="border-b border-black grid grid-cols-1 md:grid-cols-4">

        {/* Trial */}
        <div className="p-10 border-b md:border-b-0 md:border-r border-black">
          <p className="text-xs tracking-widest uppercase opacity-40 mb-6">Free trial</p>
          <p className="text-4xl font-bold mb-2">£0</p>
          <p className="text-sm opacity-55 mb-8">1 day, no card required</p>
          <ul className="space-y-3 text-sm opacity-70">
            <li>✓ Full app access</li>
            <li>✓ Import &amp; break down scripts</li>
            <li>✓ No credit card needed</li>
          </ul>
          <div className="mt-10">
            <a
              href="/open"
              className="inline-block border border-black text-sm font-bold px-6 py-3 hover:bg-black hover:text-white transition-colors"
            >
              Try free →
            </a>
          </div>
        </div>

        {/* Monthly */}
        <div className="p-10 border-b md:border-b-0 md:border-r border-black">
          <p className="text-xs tracking-widest uppercase opacity-40 mb-6">Monthly</p>
          <p className="text-4xl font-bold mb-2">£30</p>
          <p className="text-sm opacity-55 mb-8">per month, cancel any time</p>
          <ul className="space-y-3 text-sm opacity-70">
            <li>✓ Unlimited productions</li>
            <li>✓ PDF + CSV export</li>
            <li>✓ Revision tracking</li>
            <li>✓ Breakdown sharing</li>
            <li>✓ Email support</li>
          </ul>
          <div className="mt-10">
            <PaddleCheckoutButton
              priceId={MONTHLY_PRICE_ID}
              className="bg-black text-white text-sm font-bold px-6 py-3 hover:opacity-75 transition-opacity cursor-pointer"
            >
              Get started →
            </PaddleCheckoutButton>
          </div>
        </div>

        {/* Annual */}
        <div className="p-10 border-b md:border-b-0 md:border-r border-black relative">
          <div className="absolute top-6 right-6">
            <span className="text-xs font-bold bg-black text-white px-3 py-1">SAVE 31%</span>
          </div>
          <p className="text-xs tracking-widest uppercase opacity-40 mb-6">Annual</p>
          <p className="text-4xl font-bold mb-2">£249</p>
          <p className="text-sm opacity-55 mb-8">per year — £20.75/month</p>
          <ul className="space-y-3 text-sm opacity-70">
            <li>✓ Everything in Monthly</li>
            <li>✓ Best value for long productions</li>
            <li>✓ One invoice for accounting</li>
          </ul>
          <div className="mt-10">
            <PaddleCheckoutButton
              priceId={ANNUAL_PRICE_ID}
              className="bg-black text-white text-sm font-bold px-6 py-3 hover:opacity-75 transition-opacity cursor-pointer"
            >
              Get started →
            </PaddleCheckoutButton>
          </div>
        </div>

        {/* Lifetime */}
        <div className="p-10 relative">
          <div className="absolute top-6 right-6">
            <span className="text-xs font-bold border border-black px-3 py-1">ONE-TIME</span>
          </div>
          <p className="text-xs tracking-widest uppercase opacity-40 mb-6">Lifetime</p>
          <p className="text-4xl font-bold mb-2">£599</p>
          <p className="text-sm opacity-55 mb-8">pay once, use forever</p>
          <ul className="space-y-3 text-sm opacity-70">
            <li>✓ Everything in Annual</li>
            <li>✓ All future updates included</li>
            <li>✓ No subscription, ever</li>
          </ul>
          <div className="mt-10">
            <PaddleCheckoutButton
              priceId={LIFETIME_PRICE_ID}
              className="bg-black text-white text-sm font-bold px-6 py-3 hover:opacity-75 transition-opacity cursor-pointer"
            >
              Buy lifetime →
            </PaddleCheckoutButton>
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
              a: "Download the app and you have 1 day of full access — no credit card required. At the end of the trial you'll be prompted to enter a license key to continue.",
            },
            {
              q: "Is it per seat?",
              a: "No. One license covers one person. Colleagues can view shared breakdowns for free via a personal magic link — they only need a license if they want to create and edit their own productions.",
            },
            {
              q: "What does lifetime mean?",
              a: "Pay once and use FlipTheScript forever, including all future updates. No subscription, no renewals.",
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
