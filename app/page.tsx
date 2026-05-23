const DOWNLOAD_URL = "/open";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">

      {/* Nav */}
      <header className="border-b border-black px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
        <span className="font-bold text-sm tracking-widest uppercase shrink-0">
          FlipTheScript
        </span>
        <nav className="flex items-center gap-4 shrink-0 ml-6">
          <a href="/pricing" className="text-sm text-gray-500 hover:text-black transition-colors hidden sm:block">
            Pricing
          </a>
          <a
            href={DOWNLOAD_URL}
            className="text-sm font-bold bg-black text-white px-4 py-2 hover:opacity-75 transition-opacity"
          >
            Try free →
          </a>
        </nav>
      </header>

      <main className="flex-1">

        {/* Hero — tight on mobile so CTA is always above fold */}
        <section className="border-b border-black px-6 pt-10 pb-12 md:py-32">
          <p className="text-xs tracking-widest uppercase text-gray-400 mb-6">
            Script breakdown &amp; team tools · macOS
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 max-w-4xl">
            Stop using WhatsApp to run your art department.
          </h1>
          <p className="text-lg leading-relaxed max-w-xl mb-8 text-gray-600">
            FlipTheScript gives art directors, buyers, and set decorators one place to break down
            scripts, manage prep, and keep the whole team in sync — no more group chat chaos.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={DOWNLOAD_URL}
              className="inline-block bg-black text-white font-bold text-sm tracking-wide px-8 py-4 hover:opacity-75 transition-opacity"
            >
              Try free for a day →
            </a>
            <a href="/pricing" className="text-sm font-bold text-gray-400 hover:text-black transition-colors">
              See pricing →
            </a>
          </div>
          <p className="mt-4 text-sm text-gray-400">No card required. macOS 14 or later.</p>
        </section>

        {/* Art Directors */}
        <section className="border-b border-black grid grid-cols-1 md:grid-cols-2">
          <div className="p-10 md:p-16 md:border-r border-b md:border-b-0 border-black flex flex-col justify-between">
            <div>
              <p className="text-xs tracking-widest uppercase text-gray-400 mb-8">Art directors</p>
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
                  <li key={i} className="flex gap-4 text-base leading-relaxed text-gray-600">
                    <span className="font-bold shrink-0 text-gray-300 mt-0.5 tabular-nums text-sm">{String(i + 1).padStart(2, "0")}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-12 pt-10 border-t border-black">
              <p className="text-2xl font-bold mb-1">£149</p>
              <p className="text-sm text-gray-500 mb-3">Mac app — one-time purchase</p>
              <p className="text-sm text-gray-500 mb-6">
                Take your breakdown mobile for just <span className="font-bold text-black">£4.99 / month</span>.
              </p>
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
              <p className="text-xs tracking-widest uppercase text-gray-400 mb-8">Art department — props, graphics, buyers</p>
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
                  <li key={i} className="flex gap-4 text-base leading-relaxed text-gray-600">
                    <span className="font-bold shrink-0 text-gray-300 mt-0.5 tabular-nums text-sm">{String(i + 1).padStart(2, "0")}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-12 pt-10 border-t border-black">
              <p className="text-2xl font-bold mb-1">£9.99 <span className="text-base font-normal text-gray-500">/ month</span></p>
              <p className="text-sm text-gray-500 mb-6">Cancel any time</p>
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
            <p className="text-xs tracking-widest uppercase text-gray-400 mb-8">Designers &amp; heads of department</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-6">
              Keep a finger on the prep without being in every conversation.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-10">
              Follow up with the team and keep things on track — from one place, not fifteen threads.
            </p>
            <p className="text-2xl font-bold mb-1">£49.99 <span className="text-base font-normal text-gray-500">/ month</span></p>
            <p className="text-sm text-gray-500 mb-6">Keep the whole team on the same page</p>
            <a
              href="/pricing"
              className="inline-block border border-black font-bold text-sm px-6 py-3 hover:bg-black hover:text-white transition-colors"
            >
              See pricing →
            </a>
          </div>
        </section>

        {/* Bottom CTA */}
        <section id="download" className="px-6 py-20 md:py-32 border-b border-black">
          <div className="max-w-lg">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Ready to try it?
            </h2>
            <p className="text-lg text-gray-500 mb-10">
              macOS 14 Sonoma or later. Try free for a day — no card required.
            </p>
            <a
              href={DOWNLOAD_URL}
              className="inline-block bg-black text-white font-bold text-sm tracking-wide px-8 py-4 hover:opacity-75 transition-opacity"
            >
              Try free for a day →
            </a>
            <p className="mt-4 text-sm text-gray-400">
              First time?{" "}
              <a href="/open" className="underline underline-offset-4 hover:text-black transition-colors">
                How to open the app on macOS →
              </a>
            </p>
            <p className="mt-6 text-sm text-gray-400">
              Questions?{" "}
              <a href="mailto:hello@flip-the-script.app" className="underline underline-offset-4 hover:text-black transition-colors">
                hello@flip-the-script.app
              </a>
            </p>
          </div>
        </section>

      </main>

      <footer className="px-6 py-5 flex items-center justify-between text-xs text-gray-400 border-t border-black">
        <span>© {new Date().getFullYear()} FlipTheScript</span>
        <nav className="flex gap-5">
          <a href="/pricing" className="hover:text-black transition-colors">Pricing</a>
          <a href="/terms" className="hover:text-black transition-colors">Terms</a>
          <a href="/privacy" className="hover:text-black transition-colors">Privacy</a>
          <a href="/refunds" className="hover:text-black transition-colors">Refunds</a>
        </nav>
      </footer>

    </div>
  );
}
