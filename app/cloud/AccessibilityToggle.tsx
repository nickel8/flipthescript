"use client";

import { useEffect, useRef, useState } from "react";

type Scale = "md" | "lg" | "xl";

const OPTIONS: { value: Scale; label: string; hint: string }[] = [
  { value: "md", label: "Normal", hint: "16px" },
  { value: "lg", label: "Large", hint: "19px" },
  { value: "xl", label: "Extra large", hint: "22px" },
];

export default function AccessibilityToggle() {
  const [scale, setScale] = useState<Scale>("md");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load saved preference on mount
  useEffect(() => {
    const saved = (localStorage.getItem("fts_font_scale") ?? "md") as Scale;
    applyScale(saved, false);
    setScale(saved);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function applyScale(s: Scale, save = true) {
    if (s === "md") {
      document.documentElement.removeAttribute("data-font-scale");
    } else {
      document.documentElement.setAttribute("data-font-scale", s);
    }
    if (save) localStorage.setItem("fts_font_scale", s);
  }

  function choose(s: Scale) {
    setScale(s);
    applyScale(s);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        title="Text size"
        aria-label="Text size settings"
        aria-expanded={open}
        className={`text-xs font-bold uppercase tracking-widest transition-opacity ${
          open ? "opacity-70" : "opacity-30 hover:opacity-60"
        }`}
      >
        Aa
        {scale !== "md" && (
          <span className="ml-0.5 text-[10px] align-super opacity-70">
            {scale === "lg" ? "+" : "++"}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 bg-white border border-black z-50 w-44 shadow-sm"
        >
          <p className="text-[10px] uppercase tracking-widest opacity-40 px-4 pt-3 pb-1">
            Text size
          </p>
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="menuitem"
              onClick={() => choose(opt.value)}
              className={`w-full text-left px-4 py-2.5 text-xs flex items-center justify-between hover:bg-black/5 transition-colors ${
                scale === opt.value ? "font-bold" : ""
              }`}
            >
              <span>{opt.label}</span>
              <span className="opacity-30 text-[11px]">
                {scale === opt.value ? "✓" : opt.hint}
              </span>
            </button>
          ))}
          <p className="text-[10px] leading-snug opacity-30 px-4 py-3 border-t border-black/10">
            Preference saved per device. Profile sync coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
