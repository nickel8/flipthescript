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

export interface SeriesData {
  id: string;
  series_number: number;
  name: string;
  status: Status;
}

interface Props {
  series: SeriesData[];
  blocks: BlockData[];
  unblockedEpisodes: EpisodeData[];
  productionId: string;
  cloudId: string;
  canEdit: boolean;
  isOwner: boolean;
}

async function patchEpisodeBlock(episodeId: string, blockId: string | null) {
  return fetch("/api/episodes", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: episodeId, block_id: blockId }),
  });
}

export default function BlocksView({
  series: initialSeries,
  blocks: initialBlocks,
  unblockedEpisodes,
  productionId,
  cloudId,
  canEdit,
  isOwner,
}: Props) {
  const [series, setSeries] = useState<SeriesData[]>(initialSeries);
  const [blocks, setBlocks] = useState<BlockData[]>(initialBlocks);
  const [showCreateBlock, setShowCreateBlock] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [showCreateSeries, setShowCreateSeries] = useState(false);
  const [newSeriesNumber, setNewSeriesNumber] = useState("");
  const [newSeriesName, setNewSeriesName] = useState("");
  const [creatingSeries, setCreatingSeries] = useState(false);

  const allBlockOptions = blocks.map((b) => ({ id: b.id, label: b.label }));

  function moveEpisode(episodeId: string, fromBlockId: string | null, toBlockId: string | null) {
    patchEpisodeBlock(episodeId, toBlockId);
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === fromBlockId) return { ...b, episodes: b.episodes.filter((e) => e.id !== episodeId) };
        if (b.id === toBlockId) {
          const ep = prev.flatMap((x) => x.episodes).find((e) => e.id === episodeId);
          return ep ? { ...b, episodes: [...b.episodes, ep] } : b;
        }
        return b;
      })
    );
  }

  const filmingBlocks = blocks.filter((b) => b.status === "filming");
  const prepBlocks = blocks.filter((b) => b.status === "prep");
  const wrappedBlocks = blocks.filter((b) => b.status === "wrapped");

  async function createSeries() {
    if (!newSeriesNumber.trim() || creatingSeries) return;
    setCreatingSeries(true);
    try {
      const res = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productionId,
          series_number: parseInt(newSeriesNumber, 10),
          name: newSeriesName.trim() || `Series ${newSeriesNumber}`,
        }),
      });
      const data = await res.json();
      if (data?.id) {
        setSeries((prev) => [...prev, data as SeriesData]);
        setNewSeriesNumber("");
        setNewSeriesName("");
        setShowCreateSeries(false);
      }
    } finally {
      setCreatingSeries(false);
    }
  }

  async function setSeriesStatus(seriesId: string, status: Status) {
    const res = await fetch("/api/series", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: seriesId, status }),
    });
    const data = await res.json();
    if (data?.ok) setSeries((prev) => prev.map((s) => s.id === seriesId ? { ...s, status } : s));
  }

  async function createBlock(seriesId?: string) {
    if (!newLabel.trim() || creating) return;
    setCreating(true);
    const nextNum = blocks.length > 0 ? Math.max(...blocks.map((b) => b.block_number)) + 1 : 1;
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, block_number: nextNum, label: newLabel.trim(), series_id: seriesId ?? null }),
      });
      const data = await res.json();
      if (data?.id) {
        setBlocks((prev) => [...prev, { ...data, episodes: [] }]);
        setNewLabel("");
        setShowCreateBlock(false);
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

  const renderBlocks = (blocksToRender: BlockData[]) => {
    const active = blocksToRender.filter((b) => b.status !== "wrapped");
    const wrapped = blocksToRender.filter((b) => b.status === "wrapped");
    return (
      <div className="space-y-2">
        {active.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            cloudId={cloudId}
            canEdit={canEdit}
            allBlocks={allBlockOptions}
            onStatusChange={(s) => setBlockStatus(block.id, s)}
            onMoveEpisode={(epId, toId) => moveEpisode(epId, block.id, toId)}
          />
        ))}
        {wrapped.length > 0 && (
          <div>
            <button
              onClick={() => setWrappedOpen((p) => !p)}
              className="text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity mt-1 mb-1"
            >
              {wrappedOpen ? "▼" : "▶"} Wrapped ({wrapped.length})
            </button>
            {wrappedOpen && (
              <div className="space-y-2">
                {wrapped.map((block) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    cloudId={cloudId}
                    canEdit={canEdit}
                    allBlocks={allBlockOptions}
                    onStatusChange={(s) => setBlockStatus(block.id, s)}
                    onMoveEpisode={(epId, toId) => moveEpisode(epId, block.id, toId)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Blocks that belong to each series
  const unseriedBlocks = blocks.filter((b) => !b.series_id);

  return (
    <div className="space-y-6">

      {/* Series sections */}
      {series.map((s) => {
        const seriesBlocks = blocks.filter((b) => b.series_id === s.id);
        return (
          <div key={s.id}>
            {/* Series header */}
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-black">
              <span className="text-xs font-bold uppercase tracking-widest">{s.name}</span>
              <StatusBadge
                status={s.status}
                canEdit={isOwner}
                onChange={(st) => setSeriesStatus(s.id, st)}
              />
            </div>

            {/* Blocks within series */}
            {seriesBlocks.length > 0
              ? renderBlocks(seriesBlocks)
              : <p className="text-xs opacity-25 pb-2">No blocks yet.</p>
            }

            {/* Add block to this series */}
            {canEdit && (
              <CreateBlockForm
                seriesId={s.id}
                label={newLabel}
                setLabel={setNewLabel}
                show={showCreateBlock}
                setShow={setShowCreateBlock}
                creating={creating}
                onCreate={createBlock}
              />
            )}
          </div>
        );
      })}

      {/* Blocks without a series */}
      {unseriedBlocks.length > 0 && (
        <div>
          {series.length > 0 && (
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-black/20">
              <span className="text-xs font-bold uppercase tracking-widest opacity-30">Unassigned</span>
            </div>
          )}
          {renderBlocks(unseriedBlocks)}
        </div>
      )}

      {/* Unblocked episodes */}
      {unblockedEpisodes.length > 0 && (
        <div className="border border-black/15 p-4">
          <p className="text-[10px] uppercase tracking-widest opacity-30 mb-3">Episodes without a block</p>
          <div className="space-y-1">
            {unblockedEpisodes.map((ep) => (
              <EpisodeRow
                key={ep.id}
                episode={ep}
                cloudId={cloudId}
                canEdit={canEdit}
                allBlocks={allBlockOptions}
                currentBlockId={null}
                onMove={(toId) => moveEpisode(ep.id, null, toId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create block (when no series, or below series list) */}
      {canEdit && series.length === 0 && (
        <CreateBlockForm
          seriesId={undefined}
          label={newLabel}
          setLabel={setNewLabel}
          show={showCreateBlock}
          setShow={setShowCreateBlock}
          creating={creating}
          onCreate={createBlock}
        />
      )}

      {/* Empty state */}
      {series.length === 0 && blocks.length === 0 && unblockedEpisodes.length === 0 && (
        <p className="text-sm opacity-30 py-2">No blocks yet. Create a series or a block to get started.</p>
      )}

      {/* Create series — owner only */}
      {isOwner && (
        <div className="pt-2 border-t border-black/10">
          {showCreateSeries ? (
            <div className="flex gap-2 items-center flex-wrap">
              <input
                autoFocus
                type="number"
                min="1"
                value={newSeriesNumber}
                onChange={(e) => setNewSeriesNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createSeries();
                  if (e.key === "Escape") { setShowCreateSeries(false); setNewSeriesNumber(""); setNewSeriesName(""); }
                }}
                placeholder="Series no."
                className="text-sm border border-black/20 px-3 py-1.5 focus:outline-none focus:border-black/50 w-28"
              />
              <input
                type="text"
                value={newSeriesName}
                onChange={(e) => setNewSeriesName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createSeries();
                  if (e.key === "Escape") { setShowCreateSeries(false); setNewSeriesNumber(""); setNewSeriesName(""); }
                }}
                placeholder="Name — optional"
                className="text-sm border border-black/20 px-3 py-1.5 focus:outline-none focus:border-black/50 flex-1 min-w-40"
              />
              <button
                onClick={createSeries}
                disabled={!newSeriesNumber.trim() || creatingSeries}
                className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 bg-black text-white disabled:opacity-30 shrink-0"
              >
                {creatingSeries ? "…" : "Create series"}
              </button>
              <button
                onClick={() => { setShowCreateSeries(false); setNewSeriesNumber(""); setNewSeriesName(""); }}
                className="text-xs opacity-40 hover:opacity-70 transition-opacity shrink-0"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateSeries(true)}
              className="text-xs uppercase tracking-widest opacity-25 hover:opacity-50 transition-opacity"
            >
              + New series
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Status badge (shared by series + blocks) ──────────────────────────────────

function StatusBadge({
  status,
  canEdit,
  onChange,
}: {
  status: Status;
  canEdit: boolean;
  onChange: (s: Status) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        disabled={!canEdit}
        onClick={() => setOpen((p) => !p)}
        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 ${STATUS_STYLE[status]} ${canEdit ? "cursor-pointer hover:opacity-80" : "cursor-default"} transition-opacity`}
      >
        {STATUS_LABEL[status]}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-black shadow-sm min-w-28">
          {(["prep", "filming", "wrapped"] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 ${status === s ? "font-bold" : ""}`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create block form ─────────────────────────────────────────────────────────

function CreateBlockForm({
  seriesId,
  label,
  setLabel,
  show,
  setShow,
  creating,
  onCreate,
}: {
  seriesId: string | undefined;
  label: string;
  setLabel: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  creating: boolean;
  onCreate: (seriesId?: string) => void;
}) {
  return (
    <div className="pt-2">
      {show ? (
        <div className="flex gap-2 items-center">
          <input
            autoFocus
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreate(seriesId);
              if (e.key === "Escape") { setShow(false); setLabel(""); }
            }}
            placeholder="e.g. Block 1 — Eps 1 & 2"
            className="flex-1 text-sm border border-black/20 px-3 py-1.5 focus:outline-none focus:border-black/50"
          />
          <button
            onClick={() => onCreate(seriesId)}
            disabled={!label.trim() || creating}
            className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 bg-black text-white disabled:opacity-30 shrink-0"
          >
            {creating ? "…" : "Create block"}
          </button>
          <button onClick={() => { setShow(false); setLabel(""); }} className="text-xs opacity-40 hover:opacity-70 transition-opacity shrink-0">
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShow(true)}
          className="text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity"
        >
          + New block
        </button>
      )}
    </div>
  );
}

// ── Block card ────────────────────────────────────────────────────────────────

function BlockCard({
  block,
  cloudId,
  canEdit,
  allBlocks,
  onStatusChange,
  onMoveEpisode,
}: {
  block: BlockData;
  cloudId: string;
  canEdit: boolean;
  allBlocks: { id: string; label: string }[];
  onStatusChange: (s: Status) => void;
  onMoveEpisode: (episodeId: string, toBlockId: string | null) => void;
}) {
  const totalScenes = block.episodes.reduce((n, e) => n + e.total_scenes, 0);
  const completeScenes = block.episodes.reduce((n, e) => n + e.complete_scenes, 0);

  return (
    <div className={`border ${block.status === "wrapped" ? "border-black/10" : "border-black"}`}>
      {/* Block header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-black/10">
        <StatusBadge status={block.status} canEdit={canEdit} onChange={onStatusChange} />

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
            <EpisodeRow
              key={ep.id}
              episode={ep}
              cloudId={cloudId}
              canEdit={canEdit}
              allBlocks={allBlocks}
              currentBlockId={block.id}
              onMove={(toId) => onMoveEpisode(ep.id, toId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Episode row ───────────────────────────────────────────────────────────────

function EpisodeRow({
  episode: ep,
  cloudId,
  canEdit,
  allBlocks,
  currentBlockId,
  onMove,
}: {
  episode: EpisodeData;
  cloudId: string;
  canEdit: boolean;
  allBlocks: { id: string; label: string }[];
  currentBlockId: string | null;
  onMove: (toBlockId: string | null) => void;
}) {
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const pct = ep.total_scenes > 0 ? (ep.complete_scenes / ep.total_scenes) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02] group relative">
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

      {/* Block picker */}
      {canEdit && allBlocks.length > 1 && (
        <div className="relative shrink-0">
          <button
            onClick={() => setShowBlockPicker((p) => !p)}
            className="text-[10px] opacity-0 group-hover:opacity-30 hover:!opacity-70 transition-opacity uppercase tracking-widest"
          >
            Move
          </button>
          {showBlockPicker && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-black shadow-sm min-w-44">
              {allBlocks
                .filter((b) => b.id !== currentBlockId)
                .map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { onMove(b.id); setShowBlockPicker(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 truncate"
                  >
                    {b.label}
                  </button>
                ))}
              {currentBlockId && (
                <button
                  onClick={() => { onMove(null); setShowBlockPicker(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 opacity-40"
                >
                  Unassign
                </button>
              )}
            </div>
          )}
        </div>
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
