import { requireCloudSession } from "@/lib/cloud-session";
import Link from "next/link";
import SignOutButton from "./SignOutButton";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface Production {
  id: string;
  cloud_id: string;
  name: string;
  published_at: string;
  role: string;
}

async function getProductions(userId: string): Promise<Production[]> {
  // Fetch all productions the user is a member of (owner or collaborator)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/production_members?user_id=eq.${userId}&select=role,productions(id,cloud_id,name,published_at)`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: "no-store",
    }
  );
  if (!res.ok) return [];
  const rows = await res.json() as { role: string; productions: { id: string; cloud_id: string; name: string; published_at: string } }[];
  return rows
    .filter(r => r.productions)
    .map(r => ({ ...r.productions, role: r.role }))
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
}

export default async function CloudDashboardPage() {
  const session = await requireCloudSession();
  const productions = await getProductions(session.id);

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-16 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 sm:mb-10">
        <div>
          <h1 className="text-2xl font-bold">Productions</h1>
          <p className="text-sm opacity-50 mt-1">{session.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/cloud/productions/new"
            className="bg-black text-white text-xs font-bold uppercase tracking-widest px-4 py-2 hover:opacity-80 transition-opacity"
          >
            New production
          </Link>
          <SignOutButton />
        </div>
      </div>

      {productions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm opacity-40">No productions yet.</p>
          <Link
            href="/cloud/productions/new"
            className="bg-black text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 hover:opacity-80 transition-opacity"
          >
            New production
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-black/10 border border-black/10">
          {productions.map(p => (
            <li key={p.id}>
              <Link
                href={`/cloud/productions/${p.cloud_id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-black/5 transition-colors gap-4"
              >
                <span className="font-bold truncate">{p.name}</span>
                <span className="flex items-center gap-3 shrink-0">
                  {p.role !== "owner" && (
                    <span className="text-xs font-bold uppercase tracking-widest opacity-30 border border-black/20 px-1.5 py-0.5">
                      {p.role === "collaborator" ? "Editor" : "Viewer"}
                    </span>
                  )}
                  <span className="text-xs opacity-40">
                    {new Date(p.published_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
