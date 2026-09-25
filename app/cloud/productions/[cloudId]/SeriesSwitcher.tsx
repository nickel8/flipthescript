"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeriesData } from "./BlocksView";

const STATUS_STYLE: Record<SeriesData["status"], string> = {
  prep: "opacity-40",
  filming: "font-bold",
  wrapped: "opacity-25 line-through",
};

interface Props {
  current: SeriesData | null;
  all: SeriesData[];
  cloudId: string;
  productionId: string;
  isOwner: boolean;
}

export default function SeriesSwitcher({ current, all, cloudId, productionId, isOwner }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [seriesNumber, setSeriesNumber] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createSeries() {
    if (!seriesNumber.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productionId,
          series_number: parseInt(seriesNumber, 10),
          name: seriesName.trim() || `Series ${seriesNumber}`,
        }),
      });
      const data = await res.json();
      if (data?.id) {
        setOpen(false);
        setShowCreateForm(false);
        setSeriesNumber("");
        setSeriesName("");
        router.push(`/cloud/productions/${cloudId}?series=${data.id}`);
        router.refresh();
      }
    } finally {
      setCreating(false);
    }
  }

  const others = all.filter((s) => s.id !== current?.id);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 text-sm font-bold hover:opacity-70 transition-opacity"
      >
        {current ? current.name : "No series"}
        {(all.length > 1 || isOwner) && (
          <span className="text-[10px] opacity-40">▼</span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setShowCreateForm(false); }} />

          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-black shadow-lg min-w-52 py-1">
            {/* Other series */}
            {others.length > 0 && (
              <>
                <p className="px-3 py-1 text-[9px] uppercase tracking-widest opacity-30">Switch series</p>
                {others.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setOpen(false);
                      router.push(`/cloud/productions/${cloudId}?series=${s.id}`);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-black/5 flex items-center justify-between gap-3 ${STATUS_STYLE[s.status]}`}
                  >
                    <span>{s.name}</span>
                    <span className="text-[9px] uppercase tracking-widest opacity-40">{s.status}</span>
                  </button>
                ))}
                {isOwner && <div className="border-t border-black/10 my-1" />}
              </>
            )}

            {/* Create new series — owner only */}
            {isOwner && (
              showCreateForm ? (
                <div className="px-3 py-2 space-y-2">
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="number"
                      min="1"
                      value={seriesNumber}
                      onChange={(e) => setSeriesNumber(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createSeries();
                        if (e.key === "Escape") setShowCreateForm(false);
                      }}
                      placeholder="No."
                      className="w-14 text-xs border border-black/20 px-2 py-1 focus:outline-none focus:border-black/50"
                    />
                    <input
                      type="text"
                      value={seriesName}
                      onChange={(e) => setSeriesName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createSeries();
                        if (e.key === "Escape") setShowCreateForm(false);
                      }}
                      placeholder="Name — optional"
                      className="flex-1 text-xs border border-black/20 px-2 py-1 focus:outline-none focus:border-black/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={createSeries}
                      disabled={!seriesNumber.trim() || creating}
                      className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-black text-white disabled:opacity-30"
                    >
                      {creating ? "…" : "Create"}
                    </button>
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="text-[10px] opacity-40 hover:opacity-70 transition-opacity"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full text-left px-3 py-2 text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity"
                >
                  + New series
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
