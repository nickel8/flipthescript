"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

// ---------------------------------------------------------------------------
// Breakdown snapshot types
// ---------------------------------------------------------------------------

interface SceneElement {
  category: string;
  items: string[];
}

interface Scene {
  sceneNumber: string;
  slugLine: string;
  synopsis: string;
  pageStart: number;
  shootDate?: string;
  dailyOrder?: number;
  elements: SceneElement[];
}

interface Snapshot {
  scenes: Scene[];
}

// Old blobs were serialised as a bare array — normalise on load
function normaliseSnapshot(raw: unknown): Snapshot {
  if (Array.isArray(raw)) return { scenes: raw as Scene[] };
  return raw as Snapshot;
}

interface ViewData {
  email: string;
  productionName: string;
  scriptVersion: string;
  snapshot: Snapshot;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ViewBreakdown() {
  const { breakdownId } = useParams<{ breakdownId: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [data, setData] = useState<ViewData | null>(null);
  const [error, setError] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    if (!token) { setState("error"); setError("No access token in this link."); return; }

    fetch(`/api/view/${breakdownId}?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) { setState("error"); setError(json.error); }
        else { setData({ ...json, snapshot: normaliseSnapshot(json.snapshot) }); setState("ready"); }
      })
      .catch(() => { setState("error"); setError("Something went wrong loading this breakdown."); });
  }, [breakdownId, token]);

  async function requestNewLink() {
    await fetch(`/api/magic-link/${breakdownId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: requestEmail }),
    });
    setRequestSent(true);
  }

  // --- Loading ---
  if (state === "loading") {
    return (
      <div style={styles.center}>
        <p style={styles.muted}>Loading breakdown…</p>
      </div>
    );
  }

  // --- Error ---
  if (state === "error") {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h2 style={styles.title}>Access required</h2>
          <p style={styles.muted}>{error}</p>
          {!requestSent ? (
            <>
              <p style={{ ...styles.muted, marginTop: 16 }}>Enter your email to request a new link:</p>
              <input
                type="email"
                placeholder="your@email.com"
                value={requestEmail}
                onChange={e => setRequestEmail(e.target.value)}
                style={styles.input}
              />
              <button onClick={requestNewLink} style={styles.button}>Send access link</button>
            </>
          ) : (
            <p style={{ ...styles.muted, marginTop: 16, color: "#22c55e" }}>
              If your email is on the access list, a new link is on its way.
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- Ready ---
  const { productionName, scriptVersion, snapshot, email } = data!;

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <h1 style={styles.prodName}>{productionName}</h1>
            <p style={styles.version}>{scriptVersion} breakdown</p>
          </div>
          <p style={styles.emailBadge}>{email}</p>
        </div>
      </header>

      {/* Scene list */}
      <main style={styles.main}>
        {snapshot.scenes.map(scene => (
          <div key={scene.sceneNumber} style={styles.sceneCard}>
            <div style={styles.sceneHeader}>
              <span style={styles.sceneNum}>Scene {scene.sceneNumber}</span>
              {scene.shootDate && (
                <span style={styles.shootDate}>
                  {new Date(scene.shootDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  {scene.dailyOrder != null && ` · #${scene.dailyOrder}`}
                </span>
              )}
            </div>
            <p style={styles.slugLine}>{scene.slugLine}</p>
            {scene.synopsis && <p style={styles.synopsis}>{scene.synopsis}</p>}
            {scene.elements.length > 0 && (
              <div style={styles.elements}>
                {scene.elements.map(group => (
                  <div key={group.category} style={styles.elementGroup}>
                    <span style={styles.elementCat}>{group.category}</span>
                    <span style={styles.elementItems}>{group.items.join(", ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </main>

      <footer style={styles.footer}>
        <p>Powered by <strong>FlipTheScript</strong> · <a href="https://www.flip-the-script.app" style={{ color: "#141417" }}>flip-the-script.app</a></p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles (no Tailwind dependency for this public-facing page)
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  center:       { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#f9f9f9" },
  card:         { background: "#fff", borderRadius: 12, padding: 32, maxWidth: 400, width: "100%", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  title:        { margin: "0 0 8px", fontSize: 20, fontWeight: 700 },
  muted:        { margin: 0, color: "#666", fontSize: 14 },
  input:        { display: "block", width: "100%", marginTop: 8, padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box" },
  button:       { display: "inline-block", marginTop: 12, padding: "10px 20px", background: "#141417", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  page:         { minHeight: "100vh", background: "#f5f5f5", fontFamily: "system-ui, sans-serif" },
  header:       { background: "#141417", color: "#fff", padding: "20px 0" },
  headerInner:  { maxWidth: 760, margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  prodName:     { margin: 0, fontSize: 20, fontWeight: 700, color: "#fff" },
  version:      { margin: "2px 0 0", fontSize: 13, color: "rgba(255,255,255,0.6)" },
  emailBadge:   { fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0 },
  main:         { maxWidth: 760, margin: "0 auto", padding: "24px 24px 48px" },
  sceneCard:    { background: "#fff", borderRadius: 10, padding: 20, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  sceneHeader:  { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  sceneNum:     { fontWeight: 700, fontSize: 15 },
  shootDate:    { fontSize: 12, color: "#888" },
  slugLine:     { margin: "0 0 8px", fontSize: 13, color: "#444", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.03em" },
  synopsis:     { margin: "0 0 12px", fontSize: 14, color: "#555", lineHeight: 1.5 },
  elements:     { borderTop: "1px solid #f0f0f0", paddingTop: 10, display: "flex", flexDirection: "column", gap: 4 },
  elementGroup: { display: "flex", gap: 8, fontSize: 13 },
  elementCat:   { color: "#888", minWidth: 90, flexShrink: 0 },
  elementItems: { color: "#333" },
  footer:       { textAlign: "center", padding: "24px 0", fontSize: 12, color: "#aaa" },
};
