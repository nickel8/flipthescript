import SiteShell from "../components/SiteShell";

const DOWNLOAD_URL = "https://github.com/nickel8/flipthescript/releases/download/v1.7/FlipTheScript-1.7.zip";

export const metadata = {
  title: "Download FlipTheScript — macOS",
};

const steps = [
  {
    n: "01",
    heading: "Download and unzip",
    body: "Click the download button and wait for FlipTheScript-1.7.zip to finish downloading. Double-click the zip to unzip it — you'll see FlipTheScript.app appear.",
  },
  {
    n: "02",
    heading: "Move it to your Applications folder",
    body: "Drag FlipTheScript.app into your Applications folder. This keeps things tidy and ensures automatic updates work correctly.",
  },
  {
    n: "03",
    heading: "Open it",
    body: "Double-click FlipTheScript in your Applications folder. It'll open straight away — no security warnings, no extra steps. FlipTheScript is notarised by Apple.",
  },
];

export default function OpenPage() {
  return (
    <SiteShell>
      <section className="border-b border-black px-6 py-16">
        <p className="text-xs tracking-widest uppercase opacity-40 mb-8">Getting started</p>
        <h1 className="text-4xl font-bold mb-4">Download FlipTheScript</h1>
        <p className="text-lg opacity-55 max-w-xl leading-relaxed mb-10">
          macOS · Requires macOS 13 or later · Free to try
        </p>
        <a
          href={DOWNLOAD_URL}
          download
          className="inline-block bg-black text-white font-bold text-sm tracking-wide px-8 py-4 hover:opacity-75 transition-opacity"
        >
          Download FlipTheScript →
        </a>
      </section>

      <section className="px-6 py-16 max-w-2xl">
        <ol>
          {steps.map((s) => (
            <li
              key={s.n}
              className="flex items-start gap-8 py-8 border-b border-black last:border-b-0"
            >
              <span className="text-sm opacity-25 font-bold shrink-0 mt-0.5 w-6">{s.n}</span>
              <div>
                <h2 className="font-bold text-lg mb-2">{s.heading}</h2>
                <p className="opacity-60 leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-black px-6 py-12">
        <p className="text-sm opacity-40">
          Still stuck?{" "}
          <a href="mailto:hello@flip-the-script.app" className="underline underline-offset-4">
            hello@flip-the-script.app
          </a>
        </p>
      </section>
    </SiteShell>
  );
}
