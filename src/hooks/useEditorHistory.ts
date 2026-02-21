import { useCallback, useEffect, useRef, useState } from "react";
import type { TimelineTrack } from "@/components/editor/types";

interface HistorySnapshot {
  tracks: TimelineTrack[];
  duration: number;
  selectedClipId: string | null;
}

const MAX_HISTORY = 50;

export function useEditorHistory(initialSnapshot: HistorySnapshot) {
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);
  const currentRef = useRef<HistorySnapshot>(initialSnapshot);

  // Update current ref without pushing history
  const syncCurrent = useCallback((snapshot: HistorySnapshot) => {
    currentRef.current = snapshot;
  }, []);

  // Push current state to undo stack before a change
  const pushState = useCallback((newSnapshot: HistorySnapshot) => {
    setUndoStack((prev) => {
      const next = [...prev, currentRef.current];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
    setRedoStack([]);
    currentRef.current = newSnapshot;
  }, []);

  const undo = useCallback((): HistorySnapshot | null => {
    // Read directly from the ref-backed stacks to avoid async setState race
    const stack = undoStack;
    if (stack.length === 0) return null;

    const snapshot = stack[stack.length - 1];
    const previous = currentRef.current;

    setUndoStack(stack.slice(0, -1));
    setRedoStack((r) => [...r, previous]);
    currentRef.current = snapshot;
    return snapshot;
  }, [undoStack]);

  const redo = useCallback((): HistorySnapshot | null => {
    const stack = redoStack;
    if (stack.length === 0) return null;

    const snapshot = stack[stack.length - 1];
    const previous = currentRef.current;

    setRedoStack(stack.slice(0, -1));
    setUndoStack((u) => [...u, previous]);
    currentRef.current = snapshot;
    return snapshot;
  }, [redoStack]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const snapshot = undo();
        if (snapshot) window.dispatchEvent(new CustomEvent("editor-undo", { detail: snapshot }));
      }
      if (mod && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        e.preventDefault();
        const snapshot = redo();
        if (snapshot) window.dispatchEvent(new CustomEvent("editor-redo", { detail: snapshot }));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  return {
    pushState,
    syncCurrent,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    historySize: undoStack.length,
  };
}
