"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-xs font-bold uppercase tracking-widest border border-black px-4 py-1.5 hover:bg-black hover:text-white transition-colors"
    >
      Print
    </button>
  );
}
