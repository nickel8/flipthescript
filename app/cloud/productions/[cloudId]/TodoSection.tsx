"use client";

import { useState, FormEvent } from "react";

interface Todo {
  id: string;
  title: string;
  is_done: boolean;
  scene_cloud_id: string | null;
}

interface SceneRef {
  cloudId: string;
  sceneNumber: string;
  slugLine: string;
}

interface Props {
  productionId: string;
  initialTodos: Todo[];
  scenes: SceneRef[];
}

export default function TodoSection({ productionId, initialTodos, scenes }: Props) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [title, setTitle] = useState("");
  const [sceneCloudId, setSceneCloudId] = useState("");
  const [adding, setAdding] = useState(false);

  async function addTodo(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);

    const res = await fetch("/api/cloud-todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        production_id: productionId,
        title: title.trim(),
        scene_cloud_id: sceneCloudId || null,
      }),
    });

    if (res.ok) {
      const todo = await res.json();
      setTodos(prev => [...prev, todo]);
      setTitle("");
      setSceneCloudId("");
    }
    setAdding(false);
  }

  async function toggleTodo(id: string, is_done: boolean) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, is_done } : t));

    await fetch("/api/cloud-todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_done }),
    });
  }

  async function deleteTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));

    await fetch("/api/cloud-todos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  const sceneLabel = (cloudId: string) => {
    const s = scenes.find(x => x.cloudId === cloudId);
    return s ? `${s.sceneNumber} — ${s.slugLine}` : cloudId;
  };

  const pending = todos.filter(t => !t.is_done);
  const done = todos.filter(t => t.is_done);

  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4">
        To-do ({pending.length})
      </h2>

      {/* Add form */}
      <form onSubmit={addTodo} className="mb-6 flex flex-col gap-2">
        <input
          type="text"
          placeholder="New to-do…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="border border-black/30 px-3 py-2 text-sm focus:outline-none focus:border-black w-full"
        />
        {scenes.length > 0 && (
          <select
            value={sceneCloudId}
            onChange={e => setSceneCloudId(e.target.value)}
            className="border border-black/30 px-3 py-2 text-xs focus:outline-none focus:border-black w-full bg-white"
          >
            <option value="">No scene (production-wide)</option>
            {scenes.map(s => (
              <option key={s.cloudId} value={s.cloudId}>
                {s.sceneNumber} — {s.slugLine}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={adding || !title.trim()}
          className="bg-black text-white text-xs font-bold uppercase tracking-widest px-3 py-2 hover:opacity-80 disabled:opacity-30 transition-opacity"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>

      {/* Pending */}
      {pending.length > 0 && (
        <ul className="flex flex-col gap-2 mb-4">
          {pending.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              sceneLabel={todo.scene_cloud_id ? sceneLabel(todo.scene_cloud_id) : null}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
            />
          ))}
        </ul>
      )}

      {/* Done */}
      {done.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-widest opacity-30 mt-6 mb-2">Done</p>
          <ul className="flex flex-col gap-2">
            {done.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                sceneLabel={todo.scene_cloud_id ? sceneLabel(todo.scene_cloud_id) : null}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
              />
            ))}
          </ul>
        </>
      )}

      {todos.length === 0 && (
        <p className="text-xs opacity-30">No to-dos yet.</p>
      )}
    </div>
  );
}

function TodoItem({
  todo,
  sceneLabel,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  sceneLabel: string | null;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="flex items-start gap-2 group">
      <button
        onClick={() => onToggle(todo.id, !todo.is_done)}
        className={`mt-0.5 w-4 h-4 shrink-0 border flex items-center justify-center transition-colors ${
          todo.is_done ? "bg-black border-black" : "border-black/40 hover:border-black"
        }`}
        aria-label={todo.is_done ? "Mark incomplete" : "Mark complete"}
      >
        {todo.is_done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${todo.is_done ? "line-through opacity-30" : ""}`}>
          {todo.title}
        </p>
        {sceneLabel && (
          <p className="text-xs opacity-30 mt-0.5">{sceneLabel}</p>
        )}
      </div>

      <button
        onClick={() => onDelete(todo.id)}
        className="opacity-0 group-hover:opacity-30 hover:!opacity-80 text-sm leading-none mt-0.5 transition-opacity"
        aria-label="Delete"
      >
        ×
      </button>
    </li>
  );
}
