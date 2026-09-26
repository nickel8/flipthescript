import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ── Types ────────────────────────────────────────────────────────────────────

interface ElementItem {
  name: string;
  category: string;
}

interface Sheet {
  synopsis: string;
  notes: string;
  elements: ElementItem[];
  special_notes?: string[];
}

export interface SceneRow {
  scene_number: string;
  slug_line: string;
  int_ext: string;
  time_of_day: string;
  page_start: number;
  is_complete: boolean;
  sheet: Sheet | null;
}

// ── Layout constants ─────────────────────────────────────────────────────────

// A4: 595.28 × 841.89pt — margins 30pt top/bottom, 36pt sides
const COL_LEFT = [
  "Characters",
  "Set Dressing",
  "Weapons",
  "SFX",
  "Costume",
  "Clearance",
];
const COL_RIGHT = ["Props", "Vehicles", "Greens", "VFX", "Other"];

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 36,
    backgroundColor: "#ffffff",
  },
  // Production title at top of first page
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 8,
    color: "#666666",
    marginBottom: 20,
  },
  // Scene block
  scene: {
    marginBottom: 10,
  },
  // Scene header bar
  header: {
    backgroundColor: "#000000",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  headerNum: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    width: 24,
    opacity: 0.6,
  },
  headerSlug: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    flex: 1,
  },
  headerPage: {
    color: "#ffffff",
    fontSize: 7,
    opacity: 0.5,
    marginRight: 6,
  },
  headerDone: {
    color: "#ffffff",
    fontSize: 7,
    opacity: 0.8,
  },
  // Scene body
  body: {
    borderLeft: "1pt solid #e5e5e5",
    borderRight: "1pt solid #e5e5e5",
    borderBottom: "1pt solid #e5e5e5",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  synopsis: {
    fontSize: 7,
    color: "#444444",
    fontFamily: "Helvetica-Oblique",
    marginBottom: 6,
  },
  // 2-column element grid
  grid: {
    flexDirection: "row",
    gap: 8,
  },
  col: {
    flex: 1,
  },
  category: {
    marginBottom: 4,
  },
  catLabel: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  catItems: {
    fontSize: 7,
    color: "#222222",
    lineHeight: 1.4,
  },
  notes: {
    fontSize: 7,
    color: "#666666",
    borderTop: "0.5pt solid #e5e5e5",
    marginTop: 4,
    paddingTop: 4,
  },
  specialNotesLabel: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  specialNotesItem: {
    fontSize: 7,
    color: "#222222",
    lineHeight: 1.4,
  },
  // Page number footer
  pageNum: {
    position: "absolute",
    bottom: 18,
    right: 36,
    fontSize: 7,
    color: "#aaaaaa",
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupElements(elements: ElementItem[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const el of elements) {
    if (!map.has(el.category)) map.set(el.category, []);
    map.get(el.category)!.push(el.name);
  }
  return map;
}

function CategoryBlock({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <View style={s.category}>
      <Text style={s.catLabel}>{label}</Text>
      <Text style={s.catItems}>{items.join(", ")}</Text>
    </View>
  );
}

function SceneBlock({ scene }: { scene: SceneRow }) {
  const elements = groupElements(scene.sheet?.elements ?? []);
  const leftCats = COL_LEFT.filter((c) => (elements.get(c) ?? []).length > 0);
  const rightCats = COL_RIGHT.filter((c) => (elements.get(c) ?? []).length > 0);
  const hasElements = leftCats.length > 0 || rightCats.length > 0;
  const hasSynopsis = !!scene.sheet?.synopsis?.trim();
  const hasNotes = !!scene.sheet?.notes?.trim();
  const specialNotes = scene.sheet?.special_notes?.filter((n) => n.trim()) ?? [];
  const hasSpecialNotes = specialNotes.length > 0;

  return (
    <View style={s.scene} wrap={false}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerNum}>{scene.scene_number}</Text>
        <Text style={s.headerSlug}>{scene.slug_line}</Text>
        {scene.page_start > 0 && (
          <Text style={s.headerPage}>p.{scene.page_start}</Text>
        )}
        {scene.is_complete && <Text style={s.headerDone}>✓</Text>}
      </View>

      {/* Body — only render if there's something to show */}
      {(hasSynopsis || hasElements || hasNotes || hasSpecialNotes) && (
        <View style={s.body}>
          {hasSynopsis && (
            <Text style={s.synopsis}>{scene.sheet!.synopsis}</Text>
          )}

          {hasElements && (
            <View style={s.grid}>
              <View style={s.col}>
                {leftCats.map((c) => (
                  <CategoryBlock key={c} label={c} items={elements.get(c)!} />
                ))}
              </View>
              <View style={s.col}>
                {rightCats.map((c) => (
                  <CategoryBlock key={c} label={c} items={elements.get(c)!} />
                ))}
              </View>
            </View>
          )}

          {hasNotes && (
            <Text style={s.notes}>Notes: {scene.sheet!.notes}</Text>
          )}

          {hasSpecialNotes && (
            <View style={{ borderTop: "0.5pt solid #e5e5e5", marginTop: 4, paddingTop: 4 }}>
              <Text style={s.specialNotesLabel}>Special Notes</Text>
              {specialNotes.map((n, i) => (
                <Text key={i} style={s.specialNotesItem}>• {n}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Document ─────────────────────────────────────────────────────────────────

export function BreakdownDocument({
  productionName,
  scenes,
}: {
  productionName: string;
  scenes: SceneRow[];
}) {
  const complete = scenes.filter((s) => s.is_complete).length;
  return (
    <Document title={`${productionName} — Breakdown`}>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{productionName}</Text>
        <Text style={s.subtitle}>
          Breakdown — {scenes.length} scenes · {complete} complete
        </Text>

        {scenes.map((scene) => (
          <SceneBlock key={scene.scene_number} scene={scene} />
        ))}

        <Text
          style={s.pageNum}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
