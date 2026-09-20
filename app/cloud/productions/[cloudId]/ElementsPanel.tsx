import type { SceneData } from "./types";

const CATEGORIES = [
  "Characters",
  "Props",
  "Set Dressing",
  "Vehicles",
  "Weapons",
  "Greens",
  "SFX",
  "VFX",
  "Costume",
  "Clearance",
  "Other",
] as const;

export default function ElementsPanel({ scene }: { scene: SceneData | null }) {
  if (!scene) {
    return (
      <div className="p-6 text-sm opacity-25">Select a scene to see its elements.</div>
    );
  }

  const sceneElements = scene.sheet?.scene_elements ?? [];
  const groups = CATEGORIES.map((cat) => ({
    category: cat,
    items: sceneElements.filter((se) => se.element.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="p-6">
      <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-1">
        {scene.scene_number}
      </p>
      <p className="text-sm font-bold leading-snug mb-5 truncate">{scene.location}</p>

      {groups.length === 0 ? (
        <p className="text-sm opacity-25">No elements added yet.</p>
      ) : (
        <div className="space-y-5">
          {groups.map(({ category, items }) => (
            <div key={category}>
              <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-1.5">
                {category} · {items.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((se) => (
                  <span
                    key={se.id}
                    className="text-xs border border-black/20 px-2 py-0.5"
                  >
                    {se.element.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
