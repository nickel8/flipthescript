"use client";

import { useState } from "react";

interface FlagItem {
  id: string;
  note: string;
  due_date: string | null;
  is_done: boolean;
  element_name: string;
  category: string;
  scene_number: string;
  location: string;
  int_ext: string;
  scene_cloud_id: string;
}

interface Props {
  initial: FlagItem[];
  cloudId: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(due: string | null) {
  if (!due) return false;
  return new Date(due).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);
}

export default function TaskList({ initial, cloudId }: Props) {
  const [items, setItems] = useState<FlagItem[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  const open = items.filter((i) => !i.is_done);
  const done = items.filter((i) => i.is_done);

  async function toggleDone(item: FlagItem) {
    const next = !item.is_done;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_done: next } : i)));
    await fetch("/api/element-flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isDone: next }),
    });
  }

  function startEdit(item: FlagItem) {
    setEditing(item.id);
    setEditNote(item.note);
    setEditDate(item.due_date ?? "");
  }

  async function saveEdit(id: string) {
    setSaving(true);
    await fetch("/api/element-flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, note: editNote, dueDate: editDate || null }),
    });
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, note: editNote, due_date: editDate || null } : i
      )
    );
    setSaving(false);
    setEditing(null);
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch("/api/element-flags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  function renderItem(item: FlagItem) {
    const isEditing = editing === item.id;
    const overdue = isOverdue(item.due_date);
    return (
      <div
        key={item.id}
        className={`border-b border-black/8 py-3 ${item.is_done ? "opacity-40" : ""}`}
      >
        <div className="flex items-start gap-3">
          {/* Done toggle */}
          <button
            onClick={() => toggleDone(item)}
            className={`mt-0.5 shrink-0 w-4 h-4 border flex items-center justify-center transition-colors ${
              item.is_done ? "border-black bg-black text-white" : "border-black/30 hover:border-black"
            }`}
            aria-label={item.is_done ? "Mark not done" : "Mark done"}
          >
            {item.is_done && <span className="text-[10px] leading-none">✓</span>}
          </button>

          <div className="flex-1 min-w-0">
            {/* Element + category */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">{item.element_name}</span>
              <span className="text-[10px] uppercase tracking-widest opacity-40 border border-black/20 px-1">
                {item.category}
              </span>
            </div>

            {/* Scene context */}
            <a
              href={`/cloud/productions/${cloudId}/breakdown`}
              className="text-xs opacity-40 hover:opacity-70 transition-opacity"
            >
              {item.int_ext} · {item.location} · Scene {item.scene_number}
            </a>

            {/* Note + date */}
            {isEditing ? (
              <div className="mt-2 flex flex-col gap-2">
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  autoFocus
                  className="w-full border border-black/30 px-2 py-1.5 text-xs focus:outline-none focus:border-black resize-none"
                />
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="border border-black/30 px-2 py-1 text-xs focus:outline-none focus:border-black w-40"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => saveEdit(item.id)}
                    disabled={saving}
                    className="text-xs font-bold uppercase tracking-widest bg-black text-white px-3 py-1 hover:opacity-80 disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="text-xs opacity-40 hover:opacity-70"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-3 flex-wrap">
                {item.note && (
                  <span className="text-xs opacity-60">{item.note}</span>
                )}
                {item.due_date && (
                  <span className={`text-xs font-bold ${overdue && !item.is_done ? "text-red-600" : "opacity-40"}`}>
                    Due {formatDate(item.due_date)}
                  </span>
                )}
                {!item.is_done && (
                  <button
                    onClick={() => startEdit(item)}
                    className="text-xs opacity-25 hover:opacity-60 transition-opacity"
                  >
                    {item.note || item.due_date ? "Edit" : "Add note / due date"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Remove */}
          {!item.is_done && (
            <button
              onClick={() => remove(item.id)}
              className="shrink-0 text-xs opacity-0 hover:opacity-40 group-hover:opacity-20 transition-opacity mt-0.5"
              title="Remove flag"
            >
              ×
            </button>
          )}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm opacity-30 mb-1">No flags yet.</p>
        <p className="text-xs opacity-25">
          Open the breakdown and click ⚑ on any element to flag it.
        </p>
      </div>
    );
  }

  return (
    <div>
      {open.length > 0 && (
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest opacity-30 mb-3">
            Outstanding — {open.length}
          </p>
          {open.map(renderItem)}
        </div>
      )}
      {done.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest opacity-30 mb-3">
            Done — {done.length}
          </p>
          {done.map(renderItem)}
        </div>
      )}
    </div>
  );
}
