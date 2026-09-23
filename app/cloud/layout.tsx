import Link from "next/link";
import AccessibilityToggle from "./AccessibilityToggle";

export default function CloudLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-black px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10" style={{ height: "57px" }}>
        <Link href="/cloud/dashboard" className="font-bold text-sm tracking-widest uppercase">
          FlipTheScript
        </Link>
        <div className="flex items-center gap-5">
          <AccessibilityToggle />
          <span className="text-xs opacity-40 font-bold uppercase tracking-widest">Cloud</span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
