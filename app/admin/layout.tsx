import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-black px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
        <Link href="/admin" className="font-bold text-sm tracking-widest uppercase">
          FlipTheScript
        </Link>
        <span className="text-xs font-bold uppercase tracking-widest opacity-40">Admin</span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
