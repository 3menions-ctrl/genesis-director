/**
 * useEditor — reactive read of the editor's external state.
 *
 * Returns the full state object plus all the mutator functions. UI
 * components that only care about one slice (e.g. just `view`) can
 * still use this hook; React + useSyncExternalStore will keep
 * re-renders minimal because the store batches updates per mutation.
 *
 * Player playhead is deliberately NOT in this store — see store.ts.
 */
import { useSyncExternalStore } from "react";
import {
  getEditorState,
  subscribeEditor,
  setView,
  setProject,
  setLoading,
  setError,
  selectScene,
  selectClip,
  resetEditor,
} from "@/lib/editor/store";

export function useEditor() {
  const state = useSyncExternalStore(
    subscribeEditor,
    getEditorState,
    getEditorState, // SSR fallback — same data, no flicker
  );
  return {
    ...state,
    setView,
    setProject,
    setLoading,
    setError,
    selectScene,
    selectClip,
    resetEditor,
  };
}
