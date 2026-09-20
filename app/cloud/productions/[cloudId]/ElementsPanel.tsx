import type { ProductionElement } from "./types";

const CATEGORIES = [
  "Characters",
  "Props",
  "Set Dressing",
  "Vehicles",
  "Weapons",
  "Greens",
  "SFX",
  "Costume",
  "Other",
] as const;

export default function ElementsPanel({ elements }: { elements: ProductionElement[] }) {
  const groups = CATEGORIES.map((cat) => ({
    category: cat,
    items: elements.filter((el) => el.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="p-6">
      <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-5">
        All elements · {elements.length}
      </p>

      {groups.length === 0 ? (
        <p className="text-sm opacity-25">No elements yet. Add them scene by scene.</p>
      ) : (
        <div className="space-y-6">
          {groups.map(({ category, items }) => (
            <div key={category}>
              <p className="text-xs font-bold uppercase tracking-widest opacity-30 mb-2">
                {category} · {items.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((el) => (
                  <span
                    key={el.id}
                    className="text-xs border border-black/20 px-2 py-0.5"
                  >
                    {el.name}
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
