"use client";

import { useState, useEffect } from "react";
import { NotesProvider } from "./NotesContext";
import NotesSidebar from "./NotesSidebar";

export default function ProductionShell({
  children,
  cloudId,
  userId,
  productionName,
  canEdit,
}: {
  children: React.ReactNode;
  cloudId: string;
  userId: string;
  productionName: string;
  canEdit: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Persist open/close preference
  useEffect(() => {
    const stored = localStorage.getItem("notes-sidebar-open");
    if (stored !== null) setSidebarOpen(stored === "true");
  }, []);

  function toggleSidebar() {
    setSidebarOpen((prev) => {
      localStorage.setItem("notes-sidebar-open", String(!prev));
      return !prev;
    });
  }

  return (
    <NotesProvider cloudId={cloudId} userId={userId} productionName={productionName} canEdit={canEdit}>
      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>
        <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
        <NotesSidebar open={sidebarOpen} onToggle={toggleSidebar} />
      </div>
    </NotesProvider>
  );
}
