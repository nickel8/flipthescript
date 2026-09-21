"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewProductionPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/create-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create production.");
        return;
      }
      router.push(`/cloud/productions/${data.cloudId}/upload`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <div className="mb-1 text-xs opacity-30 uppercase tracking-widest">
        <Link href="/cloud/dashboard" className="hover:opacity-60 transition-opacity">
          ← Dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-bold mt-3 mb-1">New production</h1>
      <p className="text-sm opacity-40 mb-10">
        You can upload the script after naming the production.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest opacity-30 block mb-1.5">
            Production name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Crackula"
            autoFocus
            className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:border-black/50"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="bg-black text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-30"
        >
          {saving ? "Creating…" : "Create production"}
        </button>
      </form>
    </div>
  );
}
