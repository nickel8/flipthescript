import SiteShell from "../components/SiteShell";

export const metadata = {
  title: "Terms of Service — FlipTheScript",
};

const EFFECTIVE_DATE = "1 May 2026";
const CONTACT_EMAIL = "hello@flipthescript.app";

export default function TermsPage() {
  return (
    <SiteShell>
      <section className="border-b border-black px-6 py-16">
        <p className="text-xs tracking-widest uppercase opacity-40 mb-8">Legal</p>
        <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
        <p className="text-sm opacity-40">Effective {EFFECTIVE_DATE}</p>
      </section>

      <section className="px-6 py-16 max-w-2xl space-y-12">
        {[
          {
            title: "1. Agreement",
            body: `By downloading or using FlipTheScript ("the Software"), you agree to these Terms of Service. If you do not agree, do not use the Software. These terms form a legally binding agreement between you and FlipTheScript ("we", "us", "our").`,
          },
          {
            title: "2. License",
            body: `We grant you a personal, non-exclusive, non-transferable license to install and use one copy of the Software on devices you own or control. You may not sublicense, sell, rent, distribute, or reverse-engineer the Software. Each license is for a single named user.`,
          },
          {
            title: "3. Free Trial",
            body: `The Software may be used free of charge for a 14-day trial period. After the trial period ends, continued use requires a paid license. We reserve the right to change the trial period length at any time for new users.`,
          },
          {
            title: "4. Payment",
            body: `Paid licenses are billed monthly or annually as selected at purchase. Prices are displayed in GBP and are subject to applicable taxes. All payments are processed by our payment provider. You authorise us to charge the payment method on file at each renewal period until you cancel.`,
          },
          {
            title: "5. Cancellation",
            body: `You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period. We do not provide partial refunds for unused time on a monthly or annual plan, except as set out in our Refund Policy.`,
          },
          {
            title: "6. Your Data",
            body: `The Software operates locally on your device. Script PDFs and breakdown data are stored on your machine and are not transmitted to our servers. You retain full ownership of all content you create with the Software.`,
          },
          {
            title: "7. Acceptable Use",
            body: `You agree not to use the Software for any unlawful purpose, or to process any material that infringes the intellectual property rights of third parties. You are responsible for ensuring you have the right to use any script PDFs you import.`,
          },
          {
            title: "8. Warranty Disclaimer",
            body: `The Software is provided "as is" without warranty of any kind. We do not warrant that the Software will be uninterrupted, error-free, or meet your specific requirements. To the maximum extent permitted by law, we disclaim all implied warranties.`,
          },
          {
            title: "9. Limitation of Liability",
            body: `To the maximum extent permitted by law, our total liability to you for any claim arising out of these Terms shall not exceed the amount you paid us in the 12 months preceding the claim. We are not liable for any loss of data, profits, or indirect damages.`,
          },
          {
            title: "10. Updates",
            body: `We may update these Terms from time to time. We will notify you of material changes by email or in-app notice. Continued use of the Software after changes take effect constitutes acceptance of the revised Terms.`,
          },
          {
            title: "11. Governing Law",
            body: `These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.`,
          },
          {
            title: "12. Contact",
            body: `Questions about these Terms? Email us at ${CONTACT_EMAIL}.`,
          },
        ].map((section) => (
          <div key={section.title} className="border-b border-black pb-12 last:border-b-0 last:pb-0">
            <h2 className="font-bold text-lg mb-4">{section.title}</h2>
            <p className="opacity-60 leading-relaxed">{section.body}</p>
          </div>
        ))}
      </section>
    </SiteShell>
  );
}
