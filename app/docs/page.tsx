import SiteShell from "../components/SiteShell";
import Link from "next/link";

export const metadata = {
  title: "Getting Started — FlipTheScript",
  description: "Everything you need to go from blank page to published breakdown.",
};

const DOWNLOAD_URL =
  "https://github.com/nickel8/flipthescript/releases/download/v1.10/FlipTheScript-1.10.zip";

const steps = [
  {
    number: "01",
    title: "Download & install",
    body: (
      <>
        <p>
          FlipTheScript is a Mac app. Download the latest version, unzip it, and drag{" "}
          <strong>FlipTheScript.app</strong> into your Applications folder.
        </p>
        <p>
          When you open it for the first time, macOS may ask you to confirm you want to run it.
          Go to <strong>System Settings → Privacy & Security</strong> and click{" "}
          <strong>Open Anyway</strong> if prompted.
        </p>
        <a
          href={DOWNLOAD_URL}
          className="inline-block mt-2 bg-black text-white text-sm font-bold px-5 py-2.5 hover:opacity-75 transition-opacity"
        >
          Download v1.10 →
        </a>
      </>
    ),
  },
  {
    number: "02",
    title: "Get a licence key",
    body: (
      <>
        <p>
          When you first open the app you get a <strong>free trial</strong> — no account or card
          required. Use it to run through a full breakdown and see if it fits your workflow.
        </p>
        <p>
          When the trial ends, head to the{" "}
          <Link href="/pricing" className="underline underline-offset-2 hover:opacity-60">
            pricing page
          </Link>
          , pick the plan that suits your role, and complete checkout. Your licence key will
          arrive by email within seconds. Paste it into the app when prompted and you&apos;re
          back in.
        </p>
      </>
    ),
  },
  {
    number: "03",
    title: "Add a production",
    body: (
      <>
        <p>
          A <strong>Production</strong> is a film, series, or commercial — the top-level
          container for everything. Click the <strong>+</strong> button in the top-left sidebar
          to create one, give it a name (e.g. <em>Series 2</em>), and hit Return.
        </p>
        <p>
          You can have as many productions as you like, and switch between them instantly from
          the sidebar.
        </p>
      </>
    ),
  },
  {
    number: "04",
    title: "Add an episode",
    body: (
      <>
        <p>
          Inside a production, click <strong>New Episode</strong> (or <strong>New Script</strong>{" "}
          for a feature). Give it a name — <em>Episode 1</em>, <em>Pilot</em>, whatever makes
          sense — and confirm.
        </p>
        <p>
          For a feature film you&apos;ll typically have one episode. For a series, add one per
          episode and work through them in order.
        </p>
      </>
    ),
  },
  {
    number: "05",
    title: "Upload a script",
    body: (
      <>
        <p>
          Select your episode in the sidebar, then click <strong>Import Script</strong>. Pick the
          PDF from your Mac. FlipTheScript reads the script automatically and pulls out every
          scene — location, INT/EXT, time of day, and page number.
        </p>
        <p>
          Got a revised draft? Import the new PDF on top of the existing one. Your breakdown
          notes carry over automatically to any scenes that haven&apos;t changed.
        </p>
      </>
    ),
  },
  {
    number: "06",
    title: "Do the breakdown",
    body: (
      <>
        <p>
          Click any scene in the scene list to open it. You&apos;ll see the full breakdown sheet
          for that scene. Work through each category:
        </p>
        <ul className="list-none space-y-2 mt-2">
          {[
            "Synopsis — a short description of what happens in the scene",
            "Characters — everyone who appears",
            "Props — anything handled or featured",
            "Set Dressing — furniture, artwork, background dressing",
            "Vehicles — any vehicle that features",
            "Weapons — practical or hero weapons",
            "Greens — plants, flowers, trees",
            "SFX — practical special effects",
            "Costume — specific costume notes",
            "Other — anything that doesn't fit elsewhere",
          ].map((item) => (
            <li key={item} className="flex gap-3 opacity-70 text-sm">
              <span className="opacity-40 shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          Type a new item and press Return to add it. Click the <strong>x</strong> next to any
          item to remove it. Changes save instantly — there&apos;s no save button.
        </p>
      </>
    ),
  },
  {
    number: "07",
    title: "Export",
    body: (
      <>
        <p>
          When you&apos;re ready to share, click the <strong>Export</strong> button (top right
          of any episode). You have three options:
        </p>
        <ul className="list-none space-y-2 mt-2">
          {[
            "Breakdown PDF — one page per scene, formatted and ready to print or email",
            "Styled Spreadsheet (.xlsx) — opens directly in Excel with your house colours applied",
            "Raw CSV — plain data if you need to do your own formatting",
          ].map((item) => (
            <li key={item} className="flex gap-3 opacity-70 text-sm">
              <span className="opacity-40 shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          Before exporting, use <strong>Preview Spreadsheet</strong> to see exactly what the
          XLSX will look like — column by column, scene by scene — without having to open Excel.
          You can also customise the header colour and toggle which categories appear.
        </p>
      </>
    ),
  },
  {
    number: "08",
    title: "Share with your team",
    body: (
      <>
        <p>
          When your breakdown is ready to go, click <strong>Publish</strong>. This pushes the
          latest version to the web so your whole department can see it — props, graphics,
          buyers, everyone — in real time, from any device.
        </p>
        <p>
          Send them the link, or they can sign in at{" "}
          <Link
            href="/cloud/sign-in"
            className="underline underline-offset-2 hover:opacity-60"
          >
            flip-the-script.app
          </Link>{" "}
          directly. They&apos;ll see the live breakdown, scene by scene, the moment you publish
          it.
        </p>
        <p>
          Team members can add their own to-do lists, track their prep, and flag anything that
          needs your attention — all in one place, no WhatsApp threads required.
        </p>
      </>
    ),
  },
];

export default function DocsPage() {
  return (
    <SiteShell>
      {/* Hero */}
      <section className="border-b border-black px-6 py-16">
        <p className="text-xs tracking-widest uppercase opacity-40 mb-8">Getting started</p>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
          From blank page to published breakdown.
        </h1>
        <p className="text-lg opacity-55 max-w-xl">
          Eight steps. Takes about ten minutes on your first script.
        </p>
      </section>

      {/* Steps */}
      <section className="divide-y divide-black">
        {steps.map((step) => (
          <div
            key={step.number}
            className="px-6 py-14 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6 md:gap-16 max-w-4xl"
          >
            <div>
              <span className="text-xs tracking-widest uppercase opacity-30 font-bold">
                Step {step.number}
              </span>
              <h2 className="text-xl font-bold mt-2">{step.title}</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed opacity-70">{step.body}</div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="border-t border-black px-6 py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <p className="font-bold text-lg mb-1">Ready to get started?</p>
          <p className="text-sm opacity-55">Download the app and run your first breakdown today.</p>
        </div>
        <a
          href={DOWNLOAD_URL}
          className="inline-block bg-black text-white text-sm font-bold px-6 py-3 hover:opacity-75 transition-opacity whitespace-nowrap"
        >
          Download free →
        </a>
      </section>
    </SiteShell>
  );
}
