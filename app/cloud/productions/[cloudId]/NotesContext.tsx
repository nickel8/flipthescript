"use client";

import { createContext, useContext, useState } from "react";

export type NoteEntityType = "production" | "series" | "block" | "episode" | "scene" | "element";

export interface NotesFocus {
  type: NoteEntityType;
  id: string | null; // null = production-level
  label: string;
}

interface NotesContextValue {
  cloudId: string;
  userId: string;
  productionName: string;
  focus: NotesFocus;
  setFocus: (type: NoteEntityType, id: string | null, label: string) => void;
}

const NotesCtx = createContext<NotesContextValue | null>(null);

export function NotesProvider({
  children,
  cloudId,
  userId,
  productionName,
}: {
  children: React.ReactNode;
  cloudId: string;
  userId: string;
  productionName: string;
}) {
  const [focus, setFocusState] = useState<NotesFocus>({
    type: "production",
    id: null,
    label: productionName,
  });

  function setFocus(type: NoteEntityType, id: string | null, label: string) {
    setFocusState({ type, id, label });
  }

  return (
    <NotesCtx.Provider value={{ cloudId, userId, productionName, focus, setFocus }}>
      {children}
    </NotesCtx.Provider>
  );
}

export function useNotesContext() {
  const ctx = useContext(NotesCtx);
  if (!ctx) throw new Error("useNotesContext must be inside NotesProvider");
  return ctx;
}
