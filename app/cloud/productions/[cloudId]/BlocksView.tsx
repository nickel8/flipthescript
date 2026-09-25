"use client";

import { useState } from "react";
import Link from "next/link";

type Status = "prep" | "filming" | "wrapped";

const STATUS_LABEL: Record<Status, string> = {
  prep: "Prep",
  filming: "Filming",
  wrapped: "Wrapped",
};

const STATUS_STYLE: Record<Status, string> = {
  prep: "border border-black/30 text-black/50",
  filming: "bg-black text-white",
  wrapped: "border border-black/15 text-black/30",
};

export interface EpisodeData {
  id: string;
  episode_number: number | null;
  title: string | null;
  status: Status;
  total_scenes: number;
  complete_scenes: number;
  has_script: boolean;
}

export interface BlockData {
  id: string;
  block_number: number;
  label: string;
  status: Status;
  series_id: string | null;
  wrapped_at: string | null;
  episodes: EpisodeData[];
}

interface Props {
  blocks: BlockData[];
  unblockedEpisodes: EpisodeData[];
  productionId: string;
  cloudId: string;
  canEdit: boolean;
}

export default function BlocksView({
  blocks: initialBlocks,
  unblockedEpisodes,
  productionId,
  cloudId,
  canEdit,
}: Props) {
  const [blocks, setBlocks] = useState<BlockData[]>(initialBlocks);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);

  const filmingBlocks = blocks.filter((b) => b.status === "filming");
  const prepBlocks = blocks.filter((b) => b.status === "prep");
  const wrappedBlocks = blocks.filter((b) => b.status === "wrapped");

  async function createBlock() {
    if (!newLabel.trim() || creating) return;
    setCreating(true);
    const nextNum = blocks.length > 0 ? Math.max(...blocks.map((b) => b.block_number)) + 1 : 1;
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, block_number: nextNum, label: newLabel.trim() }),
      });
      const data = await res.json();
      if (data?.id) {
        setBlocks((prev) => [...prev, { ...data, episodes: [] }]);
        setNewLabel("");
        setShowCreateForm(false);
      }
    } finally {
      setCreating(false);
    }
  }

  async function setBlockStatus(blockId: string, status: Status) {
    const res = await fetch("/api/blocks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: blockId, status }),
    });
    const data = await res.json();
    if (data?.ok) {
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId ? { ...b, status, wrapped_at: data.wrapped_at ?? b.wrapped_at } : b
        )
      );
    }
  }

  return (
    <div className="space-y-3">
      {/* Filming blocks */}
      {filmingBlocks.map((block) => (
        <BlockCard
          key={block.id}
          block={block}
          cloudId={cloudId}
          canEdit={canEdit}
          onStatusChange={(s) => setBlockStatus(block.id, s)}
        />
      ))}

      {/* Prep blocks */}
      {prepBlocks.map((block) => (
        <BlockCard
          key={block.id}
          block={block}
          cloudId={cloudId}
          canEdit={canEdit}
          onStatusChange={(s) => setBlockStatus(block.id, s)}
        />
      ))}

      {/* Unblocked episodes (no block assigned yet) */}
      {unblockedEpisodes.length > 0 && (
        <div className="border border-black/15 p-4">
          <p className="text-[10px] uppercase tracking-widest opacity-30 mb-3">Unassigned</p>
          <div className="space-y-1">
            {unblockedEpisodes.map((ep) => (
              <EpisodeRow key={ep.id} episode={ep} cloudId={cloudId} />
            ))}
          </div>
        </div>
      )}

      {/* Wrapped blocks — collapsible */}
      {wrappedBlocks.length > 0 && (
        <div>
          <button
            onClick={() => setWrappedOpen((p) => !p)}
            className="text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity mb-2"
          >
            {wrappedOpen ? "▼" : "▶"} Wrapped ({wrappedBlocks.length})
          </button>
          {wrappedOpen && (
            <div className="space-y-2">
              {wrappedBlocks.map((block) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  cloudId={cloudId}
                  canEdit={canEdit}
                  onStatusChange={(s) => setBlockStatus(block.id, s)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {blocks.length === 0 && unblockedEpisodes.length === 0 && !showCreateForm && (
        <p className="text-sm opacity-30 py-4">No blocks yet. Create one to start organising episodes.</p>
      )}

      {/* Create block */}
      {canEdit && (
        <div className="pt-1">
          {showCreateForm ? (
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createBlock();
                  if (e.key === "Escape") { setShowCreateForm(false); setNewLabel(""); }
                }}
                placeholder="e.g. Block 3 — Eps 5 & 6"
                className="flex-1 text-sm border border-black/20 px-3 py-1.5 focus:outline-none focus:border-black/50"
              />
              <button
                onClick={createBlock}
                disabled={!newLabel.trim() || creating}
                className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 bg-black text-white disabled:opacity-30"
              >
                {creating ? "…" : "Create"}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setNewLabel(""); }}
                className="text-xs opacity-40 hover:opacity-70 transition-opacity"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity"
            >
              + New block
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Block card ────────────────────────────────────────────────────────────────

function BlockCard({
  block,
  cloudId,
  canEdit,
  onStatusChange,
}: {
  block: BlockData;
  cloudId: string;
  canEdit: boolean;
  onStatusChange: (s: Status) => void;
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const totalScenes = block.episodes.reduce((n, e) => n + e.total_scenes, 0);
  const completeScenes = block.episodes.reduce((n, e) => n + e.complete_scenes, 0);

  return (
    <div className={`border ${block.status === "wrapped" ? "border-black/10" : "border-black"}`}>
      {/* Block header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-black/10">
        {/* Status badge */}
        <div className="relative">
          <button
            disabled={!canEdit}
            onClick={() => setShowStatusMenu((p) => !p)}
            className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 ${STATUS_STYLE[block.status]} ${canEdit ? "cursor-pointer hover:opacity-80" : "cursor-default"} transition-opacity`}
          >
            {STATUS_LABEL[block.status]}
          </button>
          {showStatusMenu && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-black shadow-sm min-w-28">
              {(["prep", "filming", "wrapped"] as Status[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(s); setShowStatusMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 ${block.status === s ? "font-bold" : ""}`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className={`font-bold text-sm truncate flex-1 ${block.status === "wrapped" ? "opacity-40" : ""}`}>
          {block.label}
        </span>

        {/* Block-level progress */}
        {totalScenes > 0 && (
          <span className="text-xs opacity-30 tabular-nums shrink-0">
            {completeScenes}/{totalScenes}
          </span>
        )}

        {block.wrapped_at && (
          <span className="text-[10px] opacity-25 shrink-0">
            {new Date(block.wrapped_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>

      {/* Episodes */}
      <div className={`divide-y divide-black/5 ${block.status === "wrapped" ? "opacity-60" : ""}`}>
        {block.episodes.length === 0 ? (
          <div className="px-4 py-3">
            <Link
              href={`/cloud/productions/${cloudId}/upload`}
              className="text-xs opacity-40 hover:opacity-70 underline underline-offset-2 transition-opacity"
            >
              Upload first script for this block
            </Link>
          </div>
        ) : (
          block.episodes.map((ep) => (
            <EpisodeRow key={ep.id} episode={ep} cloudId={cloudId} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Episode row ───────────────────────────────────────────────────────────────

function EpisodeRow({ episode: ep, cloudId }: { episode: EpisodeData; cloudId: string }) {
  const pct = ep.total_scenes > 0 ? (ep.complete_scenes / ep.total_scenes) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02] group">
      <span className="text-xs font-bold opacity-40 w-14 shrink-0 tabular-nums">
        {ep.episode_number != null ? `Ep ${ep.episode_number}` : "—"}
      </span>
      <span className="text-sm truncate flex-1">
        {ep.title ?? <span className="opacity-30">Untitled</span>}
      </span>

      {ep.total_scenes > 0 ? (
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-24 h-0.5 bg-black/10">
            <div className="h-0.5 bg-black transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] opacity-30 tabular-nums w-14 text-right">
            {ep.complete_scenes}/{ep.total_scenes}
          </span>
        </div>
      ) : (
        <span className="text-[10px] opacity-25 shrink-0">No script</span>
      )}

      <Link
        href={`/cloud/productions/${cloudId}/breakdown`}
        className="text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity shrink-0"
      >
        Breakdown →
      </Link>

      {!ep.has_script && (
        <Link
          href={`/cloud/productions/${cloudId}/upload`}
          className="text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity shrink-0"
        >
          Upload →
        </Link>
      )}
    </div>
  );
}
