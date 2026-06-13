/**
 * cast-store — shared client-side cast roster.
 *
 * The "cast" is the set of avatars the director has selected for the
 * next production. Persists across page reloads (localStorage), syncs
 * across tabs (storage event), and emits a custom event so the
 * `useCast` hook can re-render any subscriber immediately.
 *
 * Schema is intentionally minimal so a cast entry can survive in
 * storage even if the underlying avatar_templates row is updated
 * upstream (image URL changes, voice gets swapped). The Studio's
 * CastPanel re-fetches the full template by id when it needs the
 * complete identity bible.
 */

const STORAGE_KEY = "smallbridges.cast";
const EVENT = "smallbridges:cast-changed";

export interface CastMember {
  id: string;
  name: string;
  imageUrl: string;
  voiceId: string;
  voiceName: string | null;
  style: string | null;
  avatarType: "realistic" | "animated";
}

function readRaw(): CastMember[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is CastMember =>
        m && typeof m.id === "string" && typeof m.name === "string",
    );
  } catch {
    return [];
  }
}

function writeRaw(next: CastMember[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // localStorage quota / disabled — silent.
  }
}

export function getCast(): CastMember[] {
  return readRaw();
}

export function isInCast(id: string): boolean {
  return readRaw().some((m) => m.id === id);
}

export function addToCast(member: CastMember): void {
  const current = readRaw();
  if (current.some((m) => m.id === member.id)) return;
  // Cap the cast at 8 — beyond that the UI gets crowded and the
  // generation pipeline can't honor every character anyway.
  const capped = [...current, member].slice(-8);
  writeRaw(capped);
}

export function removeFromCast(id: string): void {
  writeRaw(readRaw().filter((m) => m.id !== id));
}

export function clearCast(): void {
  writeRaw([]);
}

export function reorderCast(orderedIds: string[]): void {
  const current = readRaw();
  const byId = new Map(current.map((m) => [m.id, m]));
  const next: CastMember[] = [];
  for (const id of orderedIds) {
    const found = byId.get(id);
    if (found) next.push(found);
  }
  // Append any members that weren't in the ordered list (shouldn't
  // happen but keeps the operation total).
  for (const m of current) {
    if (!orderedIds.includes(m.id)) next.push(m);
  }
  writeRaw(next);
}

export function subscribeToCastChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  const handleCustom = () => listener();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(EVENT, handleCustom);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(EVENT, handleCustom);
  };
}
