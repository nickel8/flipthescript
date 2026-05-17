import SiteShell from "../../components/SiteShell";

export const metadata = {
  title: "Email confirmed — FlipTheScript Cloud",
};

export default function CloudConfirmedPage() {
  return (
    <SiteShell>
      <div className="max-w-lg mx-auto py-24 px-6 text-center">
        <div className="text-5xl mb-6">✓</div>
        <h1 className="text-3xl font-bold mb-4">Email confirmed</h1>
        <p className="text-gray-600 mb-8">
          Your FlipTheScript Cloud account is ready. Go back to the Mac app and
          sign in with your email and password to start publishing.
        </p>
        <a
          href="/open"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Download the Mac app
        </a>
      </div>
    </SiteShell>
  );
}
