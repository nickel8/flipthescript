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
          The right plan for every role.
        </h1>
        <p className="text-lg opacity-55 max-w-xl">
          From the art director running the breakdown to the buyer managing their prep —
          everyone has a plan. Try free for a day, no card required.
        </p>
      </section>

      {/* Plans */}
      <section className="border-b border-black grid grid-cols-1 md:grid-cols-3">

        {/* Art Director */}
        <div className="p-10 border-b md:border-b-0 md:border-r border-black flex flex-col">
          <div className="flex-1">
            <p className="text-xs tracking-widest uppercase opacity-40 mb-6">Art Director</p>
            <p className="text-4xl font-bold mb-2">£149</p>
            <p className="text-sm opacity-55 mb-2">Mac app — one-time purchase</p>
            <p className="text-sm opacity-55 mb-8">+ £4.99 / month to take it mobile</p>
            <ul className="space-y-3 text-sm opacity-70">
              <li>✓ Import PDF scripts &amp; auto-detect scenes</li>
              <li>✓ Tag elements, write synopses, export breakdowns</li>
              <li>✓ Amendments? Import the new draft — your work carries over</li>
              <li>✓ Import the shoot schedule, sort by shoot order instantly</li>
              <li>✓ To-do list — assign tasks to your team</li>
              <li>✓ Publish &amp; notify the whole department</li>
              <li>✓ 1-day free trial, no card required</li>
            </ul>
          </div>
          <div className="mt-10">
            <a
              href="/open"
              className="inline-block bg-black text-white text-sm font-bold px-6 py-3 hover:opacity-75 transition-opacity"
            >
              Try free →
            </a>
          </div>
        </div>

        {/* Art Department */}
        <div className="p-10 border-b md:border-b-0 md:border-r border-black flex flex-col">
          <div className="flex-1">
            <p className="text-xs tracking-widest uppercase opacity-40 mb-6">Art Department</p>
            <p className="text-sm opacity-55 mb-1">Props · Graphics · Buyers</p>
            <p className="text-4xl font-bold mb-2">£9.99</p>
            <p className="text-sm opacity-55 mb-8">per month, cancel any time</p>
            <ul className="space-y-3 text-sm opacity-70">
              <li>✓ See the latest breakdown the moment it&apos;s published</li>
              <li>✓ Your own to-do list to track your prep</li>
              <li>✓ Collaborate in the app — no more WhatsApp threads</li>
              <li>✓ Get feedback and approvals before it&apos;s too late</li>
            </ul>
          </div>
          <div className="mt-10">
            <PaddleCheckoutButton
              priceId={MONTHLY_PRICE_ID}
              className="bg-black text-white text-sm font-bold px-6 py-3 hover:opacity-75 transition-opacity cursor-pointer"
            >
              Get started →
            </PaddleCheckoutButton>
          </div>
        </div>

        {/* Head of Department */}
        <div className="p-10 flex flex-col relative">
          <div className="absolute top-6 right-6">
            <span className="text-xs font-bold bg-black text-white px-3 py-1">TEAM</span>
          </div>
          <div className="flex-1">
            <p className="text-xs tracking-widest uppercase opacity-40 mb-6">Head of Department</p>
            <p className="text-sm opacity-55 mb-1">Designers · Supervisors</p>
            <p className="text-4xl font-bold mb-2">£49.99</p>
            <p className="text-sm opacity-55 mb-8">per month, cancel any time</p>
            <ul className="space-y-3 text-sm opacity-70">
              <li>✓ Everything in Art Department</li>
              <li>✓ Keep a finger on the prep across the whole team</li>
              <li>✓ Follow up and keep things on track — from one place</li>
              <li>✓ No surprises on the day</li>
            </ul>
          </div>
          <div className="mt-10">
            <PaddleCheckoutButton
              priceId={ANNUAL_PRICE_ID}
              className="bg-black text-white text-sm font-bold px-6 py-3 hover:opacity-75 transition-opacity cursor-pointer"
            >
              Get started →
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
              a: "Download the Mac app and you have 1 day of full access — no credit card required. At the end of the trial you'll be prompted to purchase to continue.",
            },
            {
              q: "Do team members need their own account?",
              a: "Yes, each person needs their own plan. The art director publishes the breakdown; everyone else subscribes to view it and manage their own to-do list.",
            },
            {
              q: "What is the mobile app?",
              a: "The Mac app is the main tool for art directors doing the breakdown. The mobile app (coming soon) lets you take your breakdown and to-dos with you on set for £4.99 / month.",
            },
            {
              q: "What happens if I cancel?",
              a: "Your data stays safe. You can still view everything — you just won't receive new breakdown updates or be able to add new tasks until you reactivate.",
            },
            {
              q: "Can I get an invoice?",
              a: "Yes. Receipts and invoices are issued automatically via Paddle, our payment provider.",
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
