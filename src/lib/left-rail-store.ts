/**
 * left-rail-store — tiny external store for the LeftRail's open state.
 *
 * Both LeftRail (controls open/close) and FoundationShell (shifts
 * page content rightward by the pane width) need to read the same
 * state. Lifting it into a useSyncExternalStore-friendly module
 * keeps the wiring minimal — no context provider, no prop drilling,
 * and both components stay decoupled.
 *
 * Persists to localStorage. Width constant is exported so the shift
 * amount in FoundationShell matches the pane size in LeftRail.
 */
const STORAGE_KEY = "smallbridges.leftrail.open";

/** Width of the LeftRail pane when open, in CSS pixels. */
export const LEFT_RAIL_WIDTH = 320;

function readInitial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let openState = readInitial();
const listeners = new Set<() => void>();

export function getLeftRailOpen(): boolean {
  return openState;
}

export function setLeftRailOpen(next: boolean): void {
  if (next === openState) return;
  openState = next;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    }
  } catch {
    // localStorage unavailable — silent.
  }
  for (const l of listeners) l();
}

export function subscribeLeftRail(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
