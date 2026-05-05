import SiteShell from "../components/SiteShell";

export const metadata = {
  title: "How to open FlipTheScript — macOS setup guide",
};

const steps = [
  {
    n: "01",
    heading: "Download and unzip",
    body: "Click the download button and wait for FlipTheScript.zip to finish downloading. Double-click the zip to unzip it — you'll see FlipTheScript.app appear.",
  },
  {
    n: "02",
    heading: "Move it to your Applications folder",
    body: "Drag FlipTheScript.app into your Applications folder. This isn't strictly required, but it keeps things tidy and makes sure Sparkle auto-updates work correctly.",
  },
  {
    n: "03",
    heading: "Try to open it",
    body: 'Double-click FlipTheScript in Applications. You\'ll see a warning from macOS saying it "could not be verified". Click Done — don\'t move it to bin. This warning appears because the app isn\'t yet notarised with Apple (that\'s coming). It\'s safe to proceed.',
  },
  {
    n: "04",
    heading: "Open System Settings → Privacy & Security",
    body: 'Go to the Apple menu → System Settings. Click "Privacy & Security" in the sidebar. Scroll down to the Security section — you\'ll see a message that FlipTheScript was blocked.',
  },
  {
    n: "05",
    heading: 'Click "Open Anyway"',
    body: 'Click the "Open Anyway" button next to the FlipTheScript message. macOS will ask you to confirm with your Mac password or Touch ID.',
  },
  {
    n: "06",
    heading: "You're in",
    body: "FlipTheScript opens. You only need to do this once — from now on it opens normally. Apple notarisation is on the roadmap and will remove this step entirely for future users.",
  },
];

export default function OpenPage() {
  return (
    <SiteShell>
      <section className="border-b border-black px-6 py-16">
        <p className="text-xs tracking-widest uppercase opacity-40 mb-8">Getting started</p>
        <h1 className="text-4xl font-bold mb-4">How to open FlipTheScript</h1>
        <p className="text-lg opacity-55 max-w-xl leading-relaxed">
          macOS will show a security warning the first time you open FlipTheScript.
          This is normal for apps distributed outside the App Store.
          It takes about 30 seconds to get past it.
        </p>
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
