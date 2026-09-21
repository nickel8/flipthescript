import { requireAdminSession } from "@/lib/admin-session";
import Link from "next/link";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
};

function dbFetch(path: string) {
  return fetch(`${SB_URL}/rest/v1/${path}`, { headers: HEADERS, cache: "no-store" });
}

interface SbUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

interface Production {
  id: string;
  cloud_id: string;
  name: string;
  owner_id: string;
  published_at: string;
}

export default async function AdminPage() {
  await requireAdminSession();

  // Fetch all auth users via admin API
  const usersRes = await fetch(`${SB_URL}/auth/v1/admin/users?per_page=200`, {
    headers: HEADERS,
    cache: "no-store",
  });
  const usersData = await usersRes.json();
  const users: SbUser[] = (usersData.users ?? []).sort(
    (a: SbUser, b: SbUser) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Fetch all productions
  const prodsRes = await dbFetch(
    "productions?order=published_at.desc&select=id,cloud_id,name,owner_id,published_at"
  );
  const productions: Production[] = await prodsRes.json();

  // Map userId → productions
  const prodsByUser = new Map<string, Production[]>();
  for (const p of productions) {
    if (!prodsByUser.has(p.owner_id)) prodsByUser.set(p.owner_id, []);
    prodsByUser.get(p.owner_id)!.push(p);
  }

  return (
    <div className="max-w-4xl mx-auto py-16 px-6 space-y-16">
      {/* Users */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Users <span className="font-normal opacity-40 text-sm">({users.length})</span></h2>
          <Link
            href="/admin/users/new"
            className="bg-black text-white text-xs font-bold uppercase tracking-widest px-4 py-2 hover:opacity-80 transition-opacity"
          >
            + Create user
          </Link>
        </div>

        {users.length === 0 ? (
          <p className="text-sm opacity-40">No users yet.</p>
        ) : (
          <table className="w-full text-sm border border-black/10">
            <thead>
              <tr className="border-b border-black/10 bg-black/[0.03]">
                <th className="text-left px-4 py-2 text-xs font-bold uppercase tracking-widest opacity-50">Email</th>
                <th className="text-left px-4 py-2 text-xs font-bold uppercase tracking-widest opacity-50">Created</th>
                <th className="text-left px-4 py-2 text-xs font-bold uppercase tracking-widest opacity-50">Last sign in</th>
                <th className="text-right px-4 py-2 text-xs font-bold uppercase tracking-widest opacity-50">Productions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {users.map((u) => {
                const userProds = prodsByUser.get(u.id) ?? [];
                return (
                  <tr key={u.id} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-xs opacity-50">
                      {new Date(u.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs opacity-50">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric",
                          })
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-xs text-right tabular-nums opacity-60">
                      {userProds.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Productions */}
      <section>
        <h2 className="text-lg font-bold mb-6">
          All productions <span className="font-normal opacity-40 text-sm">({productions.length})</span>
        </h2>

        {productions.length === 0 ? (
          <p className="text-sm opacity-40">No productions yet.</p>
        ) : (
          <table className="w-full text-sm border border-black/10">
            <thead>
              <tr className="border-b border-black/10 bg-black/[0.03]">
                <th className="text-left px-4 py-2 text-xs font-bold uppercase tracking-widest opacity-50">Name</th>
                <th className="text-left px-4 py-2 text-xs font-bold uppercase tracking-widest opacity-50">Owner</th>
                <th className="text-left px-4 py-2 text-xs font-bold uppercase tracking-widest opacity-50">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {productions.map((p) => {
                const owner = users.find((u) => u.id === p.owner_id);
                return (
                  <tr key={p.id} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/cloud/productions/${p.cloud_id}`}
                        className="font-bold hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs opacity-60">
                      {owner?.email ?? p.owner_id.slice(0, 8) + "…"}
                    </td>
                    <td className="px-4 py-3 text-xs opacity-50">
                      {new Date(p.published_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
