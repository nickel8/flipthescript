import SiteShell from "../components/SiteShell";

export const metadata = {
  title: "Privacy Policy — FlipTheScript",
};

const EFFECTIVE_DATE = "1 May 2026";
const CONTACT_EMAIL = "hello@flipthescript.app";

export default function PrivacyPage() {
  return (
    <SiteShell>
      <section className="border-b border-black px-6 py-16">
        <p className="text-xs tracking-widest uppercase opacity-40 mb-8">Legal</p>
        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-sm opacity-40">Effective {EFFECTIVE_DATE}</p>
      </section>

      <section className="px-6 py-16 max-w-2xl space-y-12">
        {[
          {
            title: "The short version",
            body: `Your scripts and breakdown data never leave your Mac. We don't store your script content anywhere. The only personal data we hold is what's needed to manage your license and send you service emails.`,
          },
          {
            title: "Who we are",
            body: `FlipTheScript is a software product operated by its developer. If you have any privacy questions, contact us at ${CONTACT_EMAIL}.`,
          },
          {
            title: "What data we collect",
            body: `When you purchase a license: your name, email address, and payment information (processed by our payment provider — we never see your full card details). When you activate the app: your license key and activation date. When you contact support: any information you choose to share with us.`,
          },
          {
            title: "What we do not collect",
            body: `We do not collect, transmit, or store your script PDFs, scene data, breakdown sheets, element lists, or any production content. This data lives entirely on your device. We have no access to it.`,
          },
          {
            title: "How we use your data",
            body: `We use your email to send license activation confirmations, billing receipts, and important service updates. We do not send marketing emails without your explicit consent. We use your license key to verify your subscription status when you activate the app.`,
          },
          {
            title: "Third-party services",
            body: `We use a payment processor to handle transactions securely. Their privacy policy governs how they handle your payment data. We may use an email delivery service to send transactional emails. We do not sell your data to any third party.`,
          },
          {
            title: "Data retention",
            body: `We retain your account information for as long as your account is active or as needed to provide services. If you request deletion, we will remove your personal data within 30 days, except where we are required to retain it for legal or accounting purposes.`,
          },
          {
            title: "Your rights (UK GDPR)",
            body: `You have the right to access, correct, or delete your personal data. You have the right to object to processing and to data portability. To exercise any of these rights, email us at ${CONTACT_EMAIL} and we will respond within 30 days.`,
          },
          {
            title: "Security",
            body: `We take reasonable technical and organisational measures to protect your personal data. However, no method of transmission over the internet is 100% secure. We encourage you to use a strong, unique password for your account.`,
          },
          {
            title: "Changes to this policy",
            body: `We may update this Privacy Policy from time to time. We will notify you of significant changes by email. The date at the top of this page shows when it was last updated.`,
          },
          {
            title: "Contact",
            body: `Privacy questions or requests: ${CONTACT_EMAIL}.`,
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
