"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function CloudSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/cloud-auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Sign in failed");
      return;
    }

    router.push("/cloud/dashboard");
  }

  return (
    <div className="max-w-sm mx-auto py-24 px-6">
      <h1 className="text-2xl font-bold mb-8">Sign in to Cloud</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full border border-black px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full border border-black px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white text-sm font-bold px-4 py-2.5 hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
