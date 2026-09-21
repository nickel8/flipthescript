"use client";

import { useState, useEffect, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Member {
  id: string;
  userId: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function MembersPage() {
  const params = useParams();
  const router = useRouter();
  const cloudId = params.cloudId as string;

  const [productionId, setProductionId] = useState<string | null>(null);
  const [productionName, setProductionName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"collaborator" | "viewer">("collaborator");
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Resolve cloudId → internal productionId
  useEffect(() => {
    fetch(`/api/production-id?cloudId=${cloudId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setProductionId(data.id);
          setProductionName(data.name ?? "");
        } else {
          router.push("/cloud/dashboard");
        }
      });
  }, [cloudId, router]);

  // Fetch members once we have productionId
  useEffect(() => {
    if (!productionId) return;
    setLoading(true);
    fetch(`/api/production-members?productionId=${productionId}`)
      .then((r) => {
        if (r.status === 403) { router.push(`/cloud/productions/${cloudId}`); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setMembers(data);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load members"); setLoading(false); });
  }, [productionId, cloudId, router]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!productionId) return;
    setInviteError("");
    setInviteLoading(true);

    const res = await fetch("/api/production-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productionId, email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();
    setInviteLoading(false);

    if (!res.ok) {
      setInviteError(data.error ?? "Failed to add member");
      return;
    }

    setInviteEmail("");
    // Refresh members
    const membersRes = await fetch(`/api/production-members?productionId=${productionId}`);
    setMembers(await membersRes.json());
  }

  async function handleRoleChange(userId: string, newRole: string) {
    if (!productionId) return;
    await fetch("/api/production-members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productionId, userId, role: newRole }),
    });
    setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role: newRole } : m));
  }

  async function handleRemove(userId: string) {
    if (!productionId) return;
    await fetch("/api/production-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productionId, userId }),
    });
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  const nonOwners = members.filter((m) => m.role !== "owner");
  const owner = members.find((m) => m.role === "owner");

  return (
    <div className="max-w-xl mx-auto py-16 px-6">
      <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-6">
        <Link href="/cloud/dashboard" className="hover:opacity-100">Dashboard</Link>
        {" / "}
        <Link href={`/cloud/productions/${cloudId}`} className="hover:opacity-100">
          {productionName || cloudId}
        </Link>
        {" / Members"}
      </p>

      <h1 className="text-2xl font-bold mb-10">Collaborators</h1>

      {loading ? (
        <p className="text-sm opacity-40">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-10">
          {/* Current members */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4">Access</h2>
            <table className="w-full text-sm border border-black/10">
              <thead>
                <tr className="border-b border-black/10 bg-black/[0.03]">
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase tracking-widest opacity-50">Email</th>
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase tracking-widest opacity-50">Role</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {/* Owner row */}
                {owner && (
                  <tr className="bg-black/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs">{owner.email}</td>
                    <td className="px-4 py-3 text-xs font-bold uppercase tracking-widest">Owner</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                )}
                {/* Collaborators / viewers */}
                {nonOwners.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-xs opacity-40 text-center">
                      No collaborators yet
                    </td>
                  </tr>
                ) : (
                  nonOwners.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-mono text-xs">{m.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                          className="text-xs font-bold uppercase tracking-widest border border-black/20 px-2 py-1 focus:outline-none focus:border-black bg-white"
                        >
                          <option value="collaborator">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemove(m.userId)}
                          className="text-xs opacity-30 hover:opacity-80 hover:text-red-600 transition-opacity"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          {/* Invite form */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4">Add collaborator</h2>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="their@email.com"
                  className="w-full border border-black px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">Permission</label>
                <div className="flex gap-3">
                  {(["collaborator", "viewer"] as const).map((r) => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={inviteRole === r}
                        onChange={() => setInviteRole(r)}
                        className="accent-black"
                      />
                      <span className="text-sm">
                        {r === "collaborator" ? (
                          <>
                            <span className="font-bold">Editor</span>
                            <span className="opacity-50 ml-1">— can edit breakdown</span>
                          </>
                        ) : (
                          <>
                            <span className="font-bold">Viewer</span>
                            <span className="opacity-50 ml-1">— read only</span>
                          </>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}

              <button
                type="submit"
                disabled={inviteLoading}
                className="self-start bg-black text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 hover:opacity-80 disabled:opacity-40 transition-opacity"
              >
                {inviteLoading ? "Adding…" : "Add"}
              </button>
            </form>
            <p className="mt-4 text-xs opacity-40">
              The person must already have an account. Contact your admin to create one.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
