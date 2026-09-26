"use client";

import { useState, useEffect, useRef } from "react";
import { useNotesContext, type NoteEntityType } from "./NotesContext";

interface Note {
  id: string;
  body: string;
  author_id: string;
  tag: string | null;
  on_breakdown: boolean;
  created_at: string;
  updated_at: string;
}

const ENTITY_ICON: Record<NoteEntityType, string> = {
  production: "P",
  series:     "S",
  block:      "B",
  episode:    "E",
  scene:      "Sc",
  element:    "El",
};

const TAGS: { value: string; label: string }[] = [
  { value: "page_turn",     label: "Page Turn" },
  { value: "recce",         label: "Recce" },
  { value: "shoot",         label: "Shoot" },
  { value: "shoot_amends",  label: "Shoot Amends" },
  { value: "syllabus",      label: "Syllabus" },
];

const TAG_STYLE: Record<string, string> = {
  page_turn:    "border-red-300 text-red-600",
  recce:        "border-pink-300 text-pink-600",
  shoot:        "border-blue-300 text-blue-600",
  shoot_amends: "border-green-300 text-green-600",
  syllabus:     "border-black/20 text-black/50",
};

function TagLabel({ tag }: { tag: string }) {
  const def = TAGS.find((t) => t.value === tag);
  if (!def) return null;
  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest border px-1.5 py-px ${TAG_STYLE[tag] ?? "border-black/20 text-black/40"}`}>
      {def.label}
    </span>
  );
}

function TagPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {TAGS.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(value === t.value ? null : t.value)}
          className={`text-[9px] uppercase tracking-widest border px-1.5 py-px transition-colors ${
            value === t.value
              ? (TAG_STYLE[t.value] ?? "border-black text-black")
              : "border-black/15 text-black/30 hover:border-black/30 hover:text-black/50"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function NotesSidebar({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const { cloudId, userId, canEdit, focus, bumpNotesVersion } = useNotesContext();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  // Draft state
  const [draft, setDraft] = useState("");
  const [draftTag, setDraftTag] = useState<string | null>(null);
  const [draftOnBreakdown, setDraftOnBreakdown] = useState(false);
  const [posting, setPosting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editTag, setEditTag] = useState<string | null>(null);
  const [editOnBreakdown, setEditOnBreakdown] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setNotes([]);

    const params = new URLSearchParams({ cloudId, entityType: focus.type });
    if (focus.id) params.set("entityId", focus.id);

    fetch(`/api/notes?${params}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled && Array.isArray(data)) setNotes(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, cloudId, focus.type, focus.id]);

  async function postNote() {
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloudId,
          entityType: focus.type,
          entityId: focus.id,
          body: draft.trim(),
          tag: draftTag,
          onBreakdown: draftOnBreakdown,
        }),
      });
      const note = await res.json();
      if (note?.id) {
        setNotes((prev) => [...prev, note]);
        setDraft("");
        setDraftTag(null);
        setDraftOnBreakdown(false);
        bumpNotesVersion();
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } finally {
      setPosting(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editBody.trim()) return;
    const res = await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, body: editBody.trim(), tag: editTag, onBreakdown: editOnBreakdown }),
    });
    const updated = await res.json();
    if (updated?.id) {
      setNotes((prev) => prev.map((n) =>
        n.id === id ? { ...n, body: updated.body, tag: updated.tag, on_breakdown: updated.on_breakdown, updated_at: updated.updated_at } : n
      ));
    }
    setEditingId(null);
  }

  async function deleteNote(id: string) {
    await fetch("/api/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditBody(note.body);
    setEditTag(note.tag);
    setEditOnBreakdown(note.on_breakdown);
  }

  if (!open) {
    return (
      <div className="shrink-0 border-l border-black/15 flex flex-col items-center py-4 w-10">
        <button
          onClick={onToggle}
          className="text-[9px] uppercase tracking-widest opacity-30 hover:opacity-70 transition-opacity"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          title="Open notes"
        >
          Notes {notes.length > 0 ? `(${notes.length})` : ""}
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-l border-black/15 flex flex-col w-64 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-black/10">
        <span className="text-[9px] font-bold uppercase tracking-widest bg-black text-white px-1.5 py-0.5">
          {ENTITY_ICON[focus.type]}
        </span>
        <span className="text-xs font-bold truncate flex-1" title={focus.label}>
          {focus.label}
        </span>
        <button
          onClick={onToggle}
          className="text-xs opacity-25 hover:opacity-70 transition-opacity shrink-0"
          title="Close notes"
        >
          ×
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {loading && (
          <p className="text-[10px] opacity-25 text-center pt-4">Loading…</p>
        )}
        {!loading && notes.length === 0 && (
          <p className="text-[10px] opacity-25 text-center pt-4">
            No notes for this {focus.type}.
          </p>
        )}
        {notes.map((note) => {
          const isOwn = note.author_id === userId;
          const isEditing = editingId === note.id;

          return (
            <div key={note.id} className="group">
              {isEditing ? (
                <div className="space-y-1.5">
                  <textarea
                    autoFocus
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(note.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    rows={3}
                    className="w-full text-xs border border-black/30 px-2 py-1.5 focus:outline-none focus:border-black/60 resize-none"
                  />
                  <TagPicker value={editTag} onChange={setEditTag} />
                  {canEdit && (
                    <label className="flex items-center gap-1.5 cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={editOnBreakdown}
                        onChange={(e) => setEditOnBreakdown(e.target.checked)}
                        className="cursor-pointer"
                      />
                      <span className="text-[10px] uppercase tracking-widest opacity-50">Add to breakdown</span>
                    </label>
                  )}
                  <div className="flex gap-2 pt-0.5">
                    <button
                      onClick={() => saveEdit(note.id)}
                      disabled={!editBody.trim()}
                      className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-black text-white disabled:opacity-30"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-[10px] opacity-40 hover:opacity-70"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Tag + breakdown flag */}
                  {(note.tag || note.on_breakdown) && (
                    <div className="flex items-center gap-1.5 mb-1">
                      {note.tag && <TagLabel tag={note.tag} />}
                      {note.on_breakdown && (
                        <span className="text-[9px] font-bold uppercase tracking-widest border border-black bg-black text-white px-1.5 py-px">
                          BD
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs leading-snug whitespace-pre-wrap break-words">{note.body}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] opacity-25">
                      {isOwn ? "You" : "Collaborator"} · {formatDate(note.created_at)}
                      {note.updated_at !== note.created_at ? " · edited" : ""}
                    </span>
                    {isOwn && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(note)}
                          className="text-[9px] uppercase tracking-widest opacity-40 hover:opacity-80"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="text-[9px] uppercase tracking-widest opacity-30 hover:opacity-70"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Add note */}
      <div className="shrink-0 border-t border-black/10 px-3 py-2 space-y-1.5">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postNote();
          }}
          placeholder={`Note on this ${focus.type}…`}
          rows={2}
          className="w-full text-xs border border-black/20 px-2 py-1.5 focus:outline-none focus:border-black/50 resize-none placeholder:opacity-30"
        />
        <TagPicker value={draftTag} onChange={setDraftTag} />
        {canEdit && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={draftOnBreakdown}
              onChange={(e) => setDraftOnBreakdown(e.target.checked)}
              className="cursor-pointer"
            />
            <span className="text-[10px] uppercase tracking-widest opacity-50">Add to breakdown</span>
          </label>
        )}
        <button
          onClick={postNote}
          disabled={!draft.trim() || posting}
          className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-black text-white disabled:opacity-30 w-full"
        >
          {posting ? "…" : "Post"}
        </button>
      </div>
    </div>
  );
}
