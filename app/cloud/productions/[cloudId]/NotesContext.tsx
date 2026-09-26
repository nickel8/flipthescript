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
  canEdit: boolean;
  productionName: string;
  focus: NotesFocus;
  setFocus: (type: NoteEntityType, id: string | null, label: string) => void;
  notesVersion: number;
  bumpNotesVersion: () => void;
}

const NotesCtx = createContext<NotesContextValue | null>(null);

export function NotesProvider({
  children,
  cloudId,
  userId,
  canEdit,
  productionName,
}: {
  children: React.ReactNode;
  cloudId: string;
  userId: string;
  canEdit: boolean;
  productionName: string;
}) {
  const [focus, setFocusState] = useState<NotesFocus>({
    type: "production",
    id: null,
    label: productionName,
  });
  const [notesVersion, setNotesVersion] = useState(0);

  function setFocus(type: NoteEntityType, id: string | null, label: string) {
    setFocusState({ type, id, label });
  }

  function bumpNotesVersion() {
    setNotesVersion((v) => v + 1);
  }

  return (
    <NotesCtx.Provider value={{ cloudId, userId, canEdit, productionName, focus, setFocus, notesVersion, bumpNotesVersion }}>
      {children}
    </NotesCtx.Provider>
  );
}

export function useNotesContext() {
  const ctx = useContext(NotesCtx);
  if (!ctx) throw new Error("useNotesContext must be inside NotesProvider");
  return ctx;
}
