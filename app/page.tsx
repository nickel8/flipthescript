const DOWNLOAD_URL = "/open";

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
            Script breakdown software for art departments
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-10 max-w-4xl">
            Make your life easy. Stop using WhatsApp to run your art department.
          </h1>
          <p className="text-lg md:text-xl leading-relaxed max-w-2xl mb-12 opacity-60">
            FlipTheScript is built for art departments — from the art director doing the breakdown
            to the buyer tracking their to-do list. Everyone in one place, no more scrolling back
            through group chats.
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

        {/* Art Directors */}
        <section className="border-b border-black grid grid-cols-1 md:grid-cols-2">
          <div className="p-10 md:p-16 md:border-r border-b md:border-b-0 border-black flex flex-col justify-between">
            <div>
              <p className="text-xs tracking-widest uppercase opacity-40 mb-8">Art directors</p>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-10">
                Save hours on your breakdown — and keep saving them every draft.
              </h2>
              <ul className="space-y-5">
                {[
                  "Save hours doing your breakdown. Amendments are easy too — import the revised script and your existing work carries over automatically.",
                  "Import the schedule and sort the breakdown by shoot order in seconds.",
                  "Create a to-do list for yourself and assign tasks to your team. No more scrolling back through WhatsApp looking for that one message.",
                  "Publish a new breakdown and everyone in the team is notified instantly.",
                ].map((item, i) => (
                  <li key={i} className="flex gap-4 text-base leading-relaxed opacity-70">
                    <span className="font-bold shrink-0 opacity-30 mt-0.5 tabular-nums text-sm">{String(i + 1).padStart(2, "0")}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-12 pt-10 border-t border-black">
              <p className="text-2xl font-bold mb-1">£149</p>
              <p className="text-sm opacity-55 mb-6">Mac app — one-time purchase</p>
              <p className="text-sm opacity-55 mb-6">Take your breakdown mobile and manage your to-dos on your phone for just <span className="font-bold text-black opacity-100">£4.99 / month</span>.</p>
              <a
                href={DOWNLOAD_URL}
                className="inline-block bg-black text-white font-bold text-sm tracking-wide px-6 py-3 hover:opacity-75 transition-opacity"
              >
                Try free →
              </a>
            </div>
          </div>

          {/* Art Department */}
          <div className="p-10 md:p-16 flex flex-col justify-between border-b border-black">
            <div>
              <p className="text-xs tracking-widest uppercase opacity-40 mb-8">Art department — props, graphics, buyers</p>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-10">
                Collaborate in the app. Stop chasing approvals over WhatsApp.
              </h2>
              <ul className="space-y-5">
                {[
                  "See the latest breakdown as soon as it's ready — no waiting for a PDF to land in your inbox.",
                  "Create your own to-do list and track your prep in one place.",
                  "Collaborate in the app — no more scrolling back through group chats.",
                  "Proactively get feedback and approvals so there are no surprises on the day.",
                ].map((item, i) => (
                  <li key={i} className="flex gap-4 text-base leading-relaxed opacity-70">
                    <span className="font-bold shrink-0 opacity-30 mt-0.5 tabular-nums text-sm">{String(i + 1).padStart(2, "0")}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-12 pt-10 border-t border-black">
              <p className="text-2xl font-bold mb-1">£9.99 <span className="text-base font-normal opacity-55">/ month</span></p>
              <p className="text-sm opacity-55 mb-6">Cancel any time</p>
              <a
                href="/pricing"
                className="inline-block border border-black font-bold text-sm px-6 py-3 hover:bg-black hover:text-white transition-colors"
              >
                Get started →
              </a>
            </div>
          </div>
        </section>

        {/* Heads of department */}
        <section className="border-b border-black px-10 md:px-16 py-16 md:py-20">
          <div className="max-w-3xl">
            <p className="text-xs tracking-widest uppercase opacity-40 mb-8">Designers &amp; heads of department</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-6">
              Keep a finger on the prep without being in every conversation.
            </h2>
            <p className="text-lg opacity-60 leading-relaxed mb-10">
              Follow up with the team and keep things on track — from one place, not fifteen threads.
            </p>
            <div className="flex flex-wrap items-baseline gap-6">
              <div>
                <p className="text-2xl font-bold mb-1">£49.99 <span className="text-base font-normal opacity-55">/ month</span></p>
                <p className="text-sm opacity-55 mb-6">Keep the whole team on the same page</p>
                <a
                  href="/pricing"
                  className="inline-block border border-black font-bold text-sm px-6 py-3 hover:bg-black hover:text-white transition-colors"
                >
                  See pricing →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section id="download" className="px-6 py-24 md:py-36 border-b border-black">
          <div className="max-w-lg">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Ready to try it?
            </h2>
            <p className="text-lg opacity-55 mb-12">
              macOS 14 Sonoma or later. Try free for a day — no card required.
            </p>
            <a
              href={DOWNLOAD_URL}
              className="inline-block bg-black text-white font-bold text-sm tracking-wide px-8 py-4 hover:opacity-75 transition-opacity"
            >
              Try free →
            </a>
            <p className="mt-4 text-sm opacity-40">First time? <a href="/open" className="underline underline-offset-4">How to open the app on macOS →</a></p>
            <p className="mt-6 text-sm opacity-35">
              Questions?{" "}
              <a href="mailto:hello@flip-the-script.app" className="underline underline-offset-4">
                hello@flip-the-script.app
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
