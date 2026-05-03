import Link from "next/link";

const DOWNLOAD_URL = "https://github.com/nickel8/flipthescript/releases/download/v1.0/FlipTheScript.zip";

export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-black px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
        <Link href="/" className="font-bold text-sm tracking-widest uppercase">
          FlipTheScript
        </Link>
        <a
          href={DOWNLOAD_URL}
          download
          className="text-sm font-bold border border-black px-4 py-1.5 hover:bg-black hover:text-white transition-colors"
        >
          Try free →
        </a>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="px-6 py-5 flex items-center justify-between text-xs opacity-35 border-t border-black">
        <span>© {new Date().getFullYear()} FlipTheScript</span>
        <nav className="flex gap-6">
          <Link href="/pricing" className="hover:opacity-70">Pricing</Link>
          <Link href="/privacy" className="hover:opacity-70">Privacy</Link>
          <Link href="/terms" className="hover:opacity-70">Terms</Link>
          <Link href="/refunds" className="hover:opacity-70">Refunds</Link>
        </nav>
      </footer>
    </div>
  );
}
