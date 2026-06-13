/**
 * useLeftRail — reactive read of the LeftRail's open/closed state.
 *
 * Uses React's useSyncExternalStore so both LeftRail (the controller)
 * and FoundationShell (the content shifter) stay in lockstep without
 * a Context provider.
 */
import { useSyncExternalStore } from "react";
import {
  getLeftRailOpen,
  setLeftRailOpen,
  subscribeLeftRail,
} from "@/lib/left-rail-store";

export function useLeftRail() {
  const open = useSyncExternalStore(
    subscribeLeftRail,
    getLeftRailOpen,
    () => false, // SSR fallback
  );
  return {
    open,
    setOpen: setLeftRailOpen,
    toggle: () => setLeftRailOpen(!open),
  };
}
