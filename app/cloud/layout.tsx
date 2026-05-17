import Link from "next/link";

export default function CloudLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-black px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
        <Link href="/cloud/dashboard" className="font-bold text-sm tracking-widest uppercase">
          FlipTheScript
        </Link>
        <span className="text-xs opacity-40 font-bold uppercase tracking-widest">Cloud</span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
