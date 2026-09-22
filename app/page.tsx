import MagicLinkHandler from "./MagicLinkHandler";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <MagicLinkHandler />

      {/* Nav */}
      <header className="border-b border-black px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
        <span className="font-bold text-sm tracking-widest uppercase">
          FlipTheScript
        </span>
      </header>

      <main className="flex-1">

        {/* Hero */}
        <section className="border-b border-black px-6 pt-16 pb-20 md:px-16 md:pt-28 md:pb-32">
          <p className="text-xs tracking-widest uppercase text-gray-400 mb-6">
            Script breakdown · Film &amp; TV · Art department
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-8 max-w-4xl">
            Stop using WhatsApp to run your art department.
          </h1>
          <p className="text-lg leading-relaxed max-w-xl text-gray-600">
            FlipTheScript is a script breakdown and team tool built for art directors,
            buyers, and set decorators. One place to prep, track, and keep the whole
            department in sync — from first draft to wrap.
          </p>
        </section>

        {/* Who it's for */}
        <section className="border-b border-black grid grid-cols-1 md:grid-cols-3">
          {[
            {
              role: "Art directors",
              body: "Break down a script in hours, not days. Import amendments and your existing work carries over. Publish to the team the moment it's ready.",
            },
            {
              role: "Buyers, props & graphics",
              body: "See the latest breakdown the moment it's published. Manage your own prep list and flag what needs sign-off — without chasing anyone over WhatsApp.",
            },
            {
              role: "Designers & HODs",
              body: "Keep a finger on prep without being in every conversation. One view across the whole department, not fifteen group chats.",
            },
          ].map(({ role, body }) => (
            <div key={role} className="p-10 md:p-14 border-b md:border-b-0 md:border-r border-black last:border-0">
              <p className="text-xs tracking-widest uppercase text-gray-400 mb-6">{role}</p>
              <p className="text-base leading-relaxed text-gray-600">{body}</p>
            </div>
          ))}
        </section>

        {/* Private beta */}
        <section className="px-6 py-20 md:px-16 md:py-28 border-b border-black">
          <div className="max-w-lg">
            <p className="text-xs tracking-widest uppercase text-gray-400 mb-6">Status</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-6">
              We&apos;re in private beta.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              We&apos;re working with a small group of productions right now and not
              taking on new users yet. If you&apos;d like to be considered when we open
              up, get in touch.
            </p>
            <a
              href="mailto:hello@flip-the-script.app"
              className="inline-block border border-black font-bold text-sm px-6 py-3 hover:bg-black hover:text-white transition-colors"
            >
              hello@flip-the-script.app
            </a>
          </div>
        </section>

      </main>

      <footer className="px-6 py-5 flex items-center justify-between text-xs text-gray-400 border-t border-black">
        <span>© {new Date().getFullYear()} FlipTheScript</span>
        <nav className="flex gap-5">
          <a href="/terms" className="hover:text-black transition-colors">Terms</a>
          <a href="/privacy" className="hover:text-black transition-colors">Privacy</a>
        </nav>
      </footer>

    </div>
  );
}
