const DOWNLOAD_URL = "https://github.com/nickel8/flipthescript/releases/download/v1.0/FlipTheScript.zip";

const benefits = [
  {
    heading: "Save hours every draft.",
    body: "Scene detection happens automatically. Import a PDF and your scenes are ready to work through — no copy-pasting, no reformatting, no manually counting pages.",
  },
  {
    heading: "Stop losing work between drafts.",
    body: "Import the revised script and FlipTheScript shows you exactly what changed. Your existing breakdowns carry forward. You only have to touch what actually moved.",
  },
  {
    heading: "Keep your whole department consistent.",
    body: "One element library. Same character names, same prop names, across every scene. No more 'BAZOOKA' in one sheet and 'Bazooka' in another three.",
  },
  {
    heading: "Your scripts stay on your machine.",
    body: "No accounts. No cloud sync. No risk of a sensitive script sitting on someone else's server. Everything lives locally, always.",
  },
];

const steps = [
  { n: "01", text: "Import your PDF script." },
  { n: "02", text: "FlipTheScript detects every scene automatically." },
  { n: "03", text: "Work scene by scene — write your synopsis, tag elements." },
  { n: "04", text: "Export a clean PDF breakdown or CSV for the whole department." },
  { n: "05", text: "New draft? Import it. Your work carries over." },
];

const roles = [
  "Art Directors",
  "Set Decorators",
  "Props Masters",
  "Production Designers",
  "Art Department Coordinators",
  "Buyers",
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">

      {/* Nav */}
      <header className="border-b border-black px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
        <span className="font-bold text-sm tracking-widest uppercase">
          FlipTheScript
        </span>
        <nav className="flex items-center gap-6">
          <a href="/pricing" className="text-sm opacity-60 hover:opacity-100 transition-opacity">
            Pricing
          </a>
          <a
            href={DOWNLOAD_URL}
            download
            className="text-sm font-bold border border-black px-4 py-1.5 hover:bg-black hover:text-white transition-colors"
          >
            Try free →
          </a>
        </nav>
      </header>

      <main className="flex-1">

        {/* Hero */}
        <section className="border-b border-black px-6 py-24 md:py-36">
          <p className="text-xs tracking-widest uppercase mb-10 opacity-40">
            Script breakdown software — macOS
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-10 max-w-4xl">
            Stop rewriting your breakdown every draft.
          </h1>
          <p className="text-lg md:text-xl leading-relaxed max-w-2xl mb-12 opacity-60">
            FlipTheScript is a Mac app built for art departments. Import your script,
            tag your elements, export your breakdown. When the next draft lands,
            your work carries over automatically.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={DOWNLOAD_URL}
              className="inline-block bg-black text-white font-bold text-sm tracking-wide px-8 py-4 hover:opacity-75 transition-opacity"
            >
              Try free →
            </a>
            <a href="/pricing" className="text-sm font-bold opacity-40 hover:opacity-100 transition-opacity">
              See pricing →
            </a>
          </div>
        </section>

        {/* Benefits grid */}
        <section className="border-b border-black">
          <div className="px-6 pt-16 pb-2">
            <p className="text-xs tracking-widest uppercase opacity-40">Why it exists</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            {benefits.map((b, i) => (
              <div
                key={i}
                className={[
                  "p-8 md:p-12 border-black",
                  "border-b",
                  i % 2 === 0 ? "md:border-r" : "",
                ].join(" ")}
              >
                <h2 className="font-bold text-xl md:text-2xl mb-4">{b.heading}</h2>
                <p className="leading-relaxed opacity-55 text-base">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-black px-6 py-16">
          <p className="text-xs tracking-widest uppercase mb-12 opacity-40">How it works</p>
          <ol className="max-w-2xl">
            {steps.map((s) => (
              <li
                key={s.n}
                className="flex items-start gap-8 py-6 border-b border-black last:border-b-0"
              >
                <span className="text-sm opacity-25 font-bold shrink-0 mt-0.5">{s.n}</span>
                <span className="text-lg leading-snug">{s.text}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* For who */}
        <section className="border-b border-black px-6 py-16">
          <p className="text-xs tracking-widest uppercase mb-8 opacity-40">Built for</p>
          <div className="flex flex-wrap gap-3">
            {roles.map((role) => (
              <span key={role} className="border border-black px-4 py-2 text-sm">
                {role}
              </span>
            ))}
          </div>
        </section>

        {/* Download CTA */}
        <section id="download" className="px-6 py-24 md:py-36 border-b border-black">
          <div className="max-w-lg">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Ready to try it?
            </h2>
            <p className="text-lg opacity-55 mb-12">
              macOS 14 Sonoma or later. No account required.
            </p>
            <a
              href={DOWNLOAD_URL}
              download
              className="inline-block bg-black text-white font-bold text-sm tracking-wide px-8 py-4 hover:opacity-75 transition-opacity"
            >
              Try free →
            </a>
            <p className="mt-4 text-sm opacity-40">1-day free trial. <a href="/pricing" className="underline underline-offset-4">See pricing</a> for full access.</p>
            <p className="mt-6 text-sm opacity-35">
              Questions?{" "}
              <a href="mailto:hello@flipthescript.app" className="underline underline-offset-4">
                hello@flipthescript.app
              </a>
            </p>
          </div>
        </section>

      </main>

      <footer className="px-6 py-5 flex items-center justify-between text-xs opacity-35 border-t border-black">
        <span>© {new Date().getFullYear()} FlipTheScript</span>
        <nav className="flex gap-5">
          <a href="/pricing" className="hover:opacity-100 transition-opacity">Pricing</a>
          <a href="/terms" className="hover:opacity-100 transition-opacity">Terms</a>
          <a href="/privacy" className="hover:opacity-100 transition-opacity">Privacy</a>
          <a href="/refunds" className="hover:opacity-100 transition-opacity">Refunds</a>
        </nav>
      </footer>

    </div>
  );
}
