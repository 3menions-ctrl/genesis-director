/**
 * useCast — reactive read of the client-side cast roster.
 *
 * Subscribes to localStorage + the custom cast-changed event so the
 * Avatars page Cast Bar and the Studio CastPanel re-render the moment
 * an avatar is added or removed (including from a different tab).
 *
 * Returns the cast plus the same CRUD helpers as the underlying
 * cast-store so callers don't have to import both modules.
 */
import { useCallback, useEffect, useState } from "react";
import {
  CastMember,
  addToCast,
  clearCast,
  getCast,
  isInCast,
  removeFromCast,
  reorderCast,
  subscribeToCastChanges,
} from "@/lib/cast-store";

export function useCast() {
  const [cast, setCast] = useState<CastMember[]>(() => getCast());

  useEffect(() => {
    return subscribeToCastChanges(() => setCast(getCast()));
  }, []);

  const add = useCallback((m: CastMember) => addToCast(m), []);
  const remove = useCallback((id: string) => removeFromCast(id), []);
  const clear = useCallback(() => clearCast(), []);
  const reorder = useCallback((ids: string[]) => reorderCast(ids), []);
  const has = useCallback((id: string) => isInCast(id), []);

  return { cast, add, remove, clear, reorder, has };
}
