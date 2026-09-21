"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SceneData, ShootDayData } from "./types";

interface Props {
  scenes: SceneData[];
  selectedSceneId: string | null;
  productionId: string;
  onSelect: (id: string) => void;
  initialShootDays: ShootDayData[];
  addDaySignal: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByDay(scenes: SceneData[]): Map<number, SceneData[]> {
  const map = new Map<number, SceneData[]>();
  for (const s of scenes) {
    const day = s.shoot_day ?? 0;
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(s);
  }
  for (const group of map.values()) {
    group.sort((a, b) => (a.shoot_order ?? 0) - (b.shoot_order ?? 0));
  }
  return map;
}

function orderedDays(map: Map<number, SceneData[]>): number[] {
  return [...map.keys()].sort((a, b) => {
    if (a === 0) return 1; // unscheduled goes last
    if (b === 0) return -1;
    return a - b;
  });
}

// Find which day container an item ID belongs to
function findDayForScene(id: string, map: Map<number, SceneData[]>): number | null {
  for (const [day, scenes] of map) {
    if (scenes.some((s) => s.id === id)) return day;
  }
  return null;
}

// ── Droppable day container ───────────────────────────────────────────────────

function DroppableDay({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef}>{children}</div>;
}

// ── Drag handle icon ─────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
      <circle cx="3" cy="2.5" r="1.2" />
      <circle cx="7" cy="2.5" r="1.2" />
      <circle cx="3" cy="7" r="1.2" />
      <circle cx="7" cy="7" r="1.2" />
      <circle cx="3" cy="11.5" r="1.2" />
      <circle cx="7" cy="11.5" r="1.2" />
    </svg>
  );
}

// ── Sortable scene row ────────────────────────────────────────────────────────

function SortableRow({
  scene,
  selected,
  onSelect,
  overlay = false,
}: {
  scene: SceneData;
  selected: boolean;
  onSelect: (id: string) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch ${isDragging && !overlay ? "opacity-30" : ""}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="px-2 flex items-center opacity-20 hover:opacity-50 cursor-grab active:cursor-grabbing touch-none shrink-0"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <GripIcon />
      </button>

      {/* Scene button */}
      <button
        onClick={() => onSelect(scene.id)}
        className={`flex-1 text-left px-2 py-2 flex items-start gap-2 min-w-0 transition-colors ${
          selected ? "bg-black text-white" : "hover:bg-black/5"
        }`}
      >
        <span className={`font-mono text-xs shrink-0 w-6 mt-0.5 tabular-nums ${selected ? "opacity-50" : "opacity-30"}`}>
          {scene.scene_number}
        </span>
        <span className="text-xs leading-snug flex-1 min-w-0 line-clamp-2">{scene.slug_line}</span>
        {scene.is_complete && (
          <svg className="shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="6" fill={selected ? "rgba(255,255,255,0.6)" : "#16a34a"} />
            <path d="M3.5 6l2 2L8.5 4" stroke={selected ? "black" : "white"} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Main ShootView ────────────────────────────────────────────────────────────

// Format ISO date "YYYY-MM-DD" → "Sat 16 May" for display
function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function ShootView({ scenes, selectedSceneId, productionId, onSelect, initialShootDays, addDaySignal }: Props) {
  const [groups, setGroups] = useState<Map<number, SceneData[]>>(() => groupByDay(scenes));
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const [activeScene, setActiveScene] = useState<SceneData | null>(null);
  const [saving, setSaving] = useState(false);

  // dayNumber → ISO date string
  const [dayDates, setDayDates] = useState<Map<number, string>>(() => {
    const m = new Map<number, string>();
    for (const d of initialShootDays) {
      if (d.shootDate) m.set(d.dayNumber, d.shootDate);
    }
    return m;
  });
  const [editingDay, setEditingDay] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const save = useCallback(
    async (updated: Map<number, SceneData[]>) => {
      setSaving(true);
      const payload: { id: string; shoot_day: number; shoot_order: number }[] = [];
      for (const [day, dayScenes] of updated) {
        dayScenes.forEach((s, i) => {
          payload.push({ id: s.id, shoot_day: day, shoot_order: i + 1 });
        });
      }
      const res = await fetch("/api/update-shoot-order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, scenes: payload }),
      });
      if (!res.ok) console.error("update-shoot-order failed", res.status, await res.text());
      setSaving(false);
    },
    [productionId]
  );

  async function saveDate(day: number, iso: string | null) {
    const next = new Map(dayDates);
    if (iso) next.set(day, iso); else next.delete(day);
    setDayDates(next);
    setEditingDay(null);
    await fetch("/api/update-shoot-day", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productionId, dayNumber: day, shootDate: iso }),
    });
  }

  function onDragStart({ active }: DragStartEvent) {
    const id = active.id as string;
    for (const dayScenes of groups.values()) {
      const found = dayScenes.find((s) => s.id === id);
      if (found) { setActiveScene(found); break; }
    }
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    const activeDay = findDayForScene(activeId, groups);
    if (activeDay === null) return;

    // overId is either a scene id or a day container id (prefixed "day-")
    const overDay = overId.startsWith("day-")
      ? parseInt(overId.slice(4), 10)
      : findDayForScene(overId, groups);

    if (overDay === null || overDay === activeDay) return;

    // Move scene to the new day
    setGroups((prev) => {
      const next = new Map(prev);
      const fromGroup = [...(next.get(activeDay) ?? [])];
      const scene = fromGroup.find((s) => s.id === activeId)!;
      const toGroup = [...(next.get(overDay) ?? [])];

      next.set(activeDay, fromGroup.filter((s) => s.id !== activeId));
      next.set(overDay, [...toGroup, scene]);

      // Remove empty days (except day 0 — keep unscheduled even if empty)
      if (activeDay !== 0 && next.get(activeDay)?.length === 0) next.delete(activeDay);
      return next;
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveScene(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Use ref to get the latest committed state (avoids stale closure)
    const current = groupsRef.current;
    const day = findDayForScene(activeId, current);
    if (day === null) return;

    // Reorder within the same day
    if (!overId.startsWith("day-")) {
      const overDay = findDayForScene(overId, current);
      if (overDay === day) {
        const group = current.get(day)!;
        const from = group.findIndex((s) => s.id === activeId);
        const to = group.findIndex((s) => s.id === overId);
        if (from !== to) {
          const reordered = arrayMove(group, from, to);
          const next = new Map(current);
          next.set(day, reordered);
          setGroups(next);
          save(next);
        }
        return;
      }
    }

    // Cross-day move already handled in onDragOver — save current ref state
    save(current);
  }

  useEffect(() => {
    if (addDaySignal === 0) return;
    setGroups((prev) => {
      const next = new Map(prev);
      const maxDay = Math.max(0, ...[...next.keys()].filter((d) => d > 0));
      next.set(maxDay + 1, []);
      return next;
    });
  }, [addDaySignal]);

  const days = orderedDays(groups);

  return (
    <div className="relative">
      {saving && (
        <div className="absolute top-0 right-0 text-xs opacity-30 px-3 py-2 pointer-events-none">
          saving…
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {days.map((day) => {
          const dayScenes = groups.get(day) ?? [];
          const doneCount = dayScenes.filter((s) => s.is_complete).length;

          return (
            <div key={day}>
              {/* Day header */}
              <div
                id={`day-${day}`}
                className="px-3 py-1.5 border-b border-black/10 bg-black/[0.03] flex items-center gap-2"
              >
                <span className="text-xs font-bold uppercase tracking-widest opacity-50 shrink-0">
                  {day === 0 ? "Unscheduled" : `Day ${day}`}
                </span>

                {day !== 0 && (
                  editingDay === day ? (
                    <input
                      type="date"
                      autoFocus
                      defaultValue={dayDates.get(day) ?? ""}
                      onBlur={(e) => saveDate(day, e.target.value || null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveDate(day, (e.target as HTMLInputElement).value || null);
                        if (e.key === "Escape") setEditingDay(null);
                      }}
                      className="text-xs border-0 bg-transparent outline-none flex-1 min-w-0 opacity-50"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingDay(day)}
                      className="text-xs opacity-30 hover:opacity-60 transition-opacity flex-1 text-left truncate"
                    >
                      {dayDates.has(day) ? formatDate(dayDates.get(day)!) : <span className="italic">add date</span>}
                    </button>
                  )
                )}

                <span className="text-xs opacity-25 tabular-nums shrink-0 ml-auto">
                  {doneCount}/{dayScenes.length}
                </span>
              </div>

              <DroppableDay id={`day-${day}`}>
                <SortableContext
                  id={`day-${day}`}
                  items={dayScenes.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {dayScenes.map((scene) => (
                    <SortableRow
                      key={scene.id}
                      scene={scene}
                      selected={scene.id === selectedSceneId}
                      onSelect={onSelect}
                    />
                  ))}
                  {dayScenes.length === 0 && (
                    <div className="px-3 py-2 text-xs opacity-20 italic">Drop scenes here</div>
                  )}
                </SortableContext>
              </DroppableDay>
            </div>
          );
        })}

        <DragOverlay>
          {activeScene && (
            <div className="bg-white border border-black/20 shadow-lg">
              <SortableRow
                scene={activeScene}
                selected={activeScene.id === selectedSceneId}
                onSelect={() => {}}
                overlay
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
