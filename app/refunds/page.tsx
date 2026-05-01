import SiteShell from "../components/SiteShell";
import Link from "next/link";

export const metadata = {
  title: "Refund Policy — FlipTheScript",
};

const EFFECTIVE_DATE = "1 May 2026";
const CONTACT_EMAIL = "hello@flipthescript.app";

export default function RefundsPage() {
  return (
    <SiteShell>
      <section className="border-b border-black px-6 py-16">
        <p className="text-xs tracking-widest uppercase opacity-40 mb-8">Legal</p>
        <h1 className="text-4xl font-bold mb-4">Refund Policy</h1>
        <p className="text-sm opacity-40">Effective {EFFECTIVE_DATE}</p>
      </section>

      <section className="px-6 py-16 max-w-2xl space-y-12">
        {[
          {
            title: "30-day money-back guarantee",
            body: `If you're not happy with FlipTheScript for any reason, contact us within 30 days of your first payment and we'll issue a full refund — no questions asked. We want you to feel confident trying the software.`,
          },
          {
            title: "After 30 days",
            body: `After the 30-day window we do not offer refunds on monthly or annual plans. If you cancel, your subscription continues until the end of the current billing period and then stops — you won't be charged again.`,
          },
          {
            title: "Annual plans",
            body: `If you purchased an annual plan and contact us within 30 days of payment, we'll refund the full amount. After 30 days, annual plans are non-refundable — but you can cancel to prevent the next renewal and continue using the software until your current year expires.`,
          },
          {
            title: "Free trial",
            body: `The 14-day free trial requires no payment, so there is nothing to refund. You will only be charged once you purchase a license after your trial ends.`,
          },
          {
            title: "How to request a refund",
            body: `Email us at ${CONTACT_EMAIL} with the subject line "Refund request" and the email address you used to purchase. We process refunds within 5 business days. Depending on your bank, it may take a further 5–10 days to appear on your statement.`,
          },
          {
            title: "Exceptions",
            body: `We reserve the right to decline refunds where we reasonably believe the policy is being abused (for example, repeated purchase and refund cycles). This does not affect your statutory rights under UK consumer law.`,
          },
        ].map((section) => (
          <div key={section.title} className="border-b border-black pb-12 last:border-b-0 last:pb-0">
            <h2 className="font-bold text-lg mb-4">{section.title}</h2>
            <p className="opacity-60 leading-relaxed">{section.body}</p>
          </div>
        ))}

        <div className="pt-4">
          <p className="text-sm opacity-55">
            Questions?{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
            {" "}or see our{" "}
            <Link href="/terms" className="underline underline-offset-4">Terms of Service</Link>.
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
