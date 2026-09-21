"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewUserPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to create user");
      return;
    }

    setCreated({ email, password });
  }

  if (created) {
    return (
      <div className="max-w-sm mx-auto py-24 px-6">
        <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-6">
          <Link href="/admin" className="hover:opacity-100">Admin</Link> / New user
        </p>
        <div className="border border-black/20 p-6 space-y-4">
          <p className="text-sm font-bold">User created</p>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-xs opacity-40 uppercase tracking-widest block mb-0.5">Email</span>
              <span className="font-mono">{created.email}</span>
            </div>
            <div>
              <span className="text-xs opacity-40 uppercase tracking-widest block mb-0.5">Password</span>
              <span className="font-mono">{created.password}</span>
            </div>
          </div>
          <p className="text-xs opacity-50">Share these credentials with the user. They can change their password after signing in.</p>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => { setCreated(null); setEmail(""); setPassword(""); }}
            className="text-xs font-bold uppercase tracking-widest border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
          >
            Create another
          </button>
          <button
            onClick={() => router.push("/admin")}
            className="text-xs font-bold uppercase tracking-widest bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity"
          >
            Back to admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto py-24 px-6">
      <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-6">
        <Link href="/admin" className="hover:opacity-100">Admin</Link> / New user
      </p>
      <h1 className="text-2xl font-bold mb-8">Create user</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full border border-black px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">
            Initial password
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Min. 8 characters"
            className="w-full border border-black px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black font-mono"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white text-sm font-bold px-4 py-2.5 hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          {loading ? "Creating…" : "Create user"}
        </button>
      </form>
    </div>
  );
}
