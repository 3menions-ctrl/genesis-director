/**
 * document-store — regression tests for authoredAt timestamp stamping.
 *
 * Guards against the "epoch timestamp" bug: document-store once stamped
 * meta.authoredAt (and approval/flush timestamps) with `new Date(0)` — the
 * 1970 epoch — instead of wall-clock now. Because the realtime conflict
 * guard in src/hooks/editor/useScriptDocument.ts (~L143-148) skips an
 * incoming echo only when `cur.meta.authoredAt > incoming.meta.authoredAt`,
 * a constant epoch made that comparison ALWAYS false, so every realtime
 * echo overwrote the user's in-flight local edit → silent lost-update.
 *
 * These tests pin the fix: edits stamp a real, monotonically-advancing
 * timestamp, and the guard therefore protects newer local state.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// document-store imports the supabase client at module load. Mock it so the
// import needs no live env, and so the debounced flush (never advanced here)
// is a harmless no-op rather than a network call.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: async () => ({ error: null }) }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    }),
  },
}));

import { setDocument, getDocument, addScene } from "@/lib/editor/document-store";
import { emptyDocument, type ScriptDocument } from "@/lib/editor/script-document";

const EPOCH = new Date(0).toISOString(); // "1970-01-01T00:00:00.000Z"

/**
 * Mirror of the realtime conflict guard in useScriptDocument.ts (~L143-148):
 * skip an incoming realtime echo when our in-memory doc is strictly fresher.
 */
function skipsIncoming(cur: ScriptDocument | null, incoming: ScriptDocument): boolean {
  return !!(cur && cur.meta.authoredAt > incoming.meta.authoredAt);
}

const clone = (doc: ScriptDocument): ScriptDocument => structuredClone(doc);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-18T00:00:00.000Z"));
  setDocument(null);
});

afterEach(() => {
  vi.useRealTimers();
  setDocument(null);
});

describe("document-store authoredAt stamping (epoch-timestamp regression)", () => {
  it("a brand-new document keeps the epoch sentinel until the first edit", () => {
    setDocument(emptyDocument("p1", "Test", "16:9"));
    // Intentional: a blank doc must lose the conflict guard to any real doc.
    expect(getDocument()!.meta.authoredAt).toBe(EPOCH);
  });

  it("stamps a real wall-clock authoredAt on edit — not the 1970 epoch", () => {
    const now = new Date("2026-06-18T12:00:00.000Z");
    vi.setSystemTime(now);
    setDocument(emptyDocument("p1", "Test", "16:9"));

    addScene({ slug: "INT. KITCHEN - NIGHT" });

    const stamped = getDocument()!.meta.authoredAt;
    expect(stamped).not.toBe(EPOCH);
    expect(stamped).toBe(now.toISOString());
  });

  it("preserves an in-flight local edit against a stale realtime echo", () => {
    // t0: load + first edit. This is the snapshot whose echo arrives late.
    vi.setSystemTime(new Date("2026-06-18T00:00:00.000Z"));
    setDocument(emptyDocument("p1", "Test", "16:9"));
    addScene({ slug: "SCENE A" });
    const staleEcho = clone(getDocument()!); // authoredAt = 00:00:00

    // t1: the user makes a newer edit before the first edit's echo returns.
    vi.setSystemTime(new Date("2026-06-18T00:00:05.000Z"));
    addScene({ slug: "SCENE B" });

    const cur = getDocument()!; // authoredAt = 00:00:05, two scenes
    expect(cur.scenes).toHaveLength(2);

    // The late echo of the FIRST edit must be skipped — else SCENE B is lost.
    // Under the epoch bug both timestamps were equal → guard returned false
    // → the echo would have been applied, dropping SCENE B.
    expect(skipsIncoming(cur, staleEcho)).toBe(true);
  });

  it("applies a genuinely fresher incoming doc (another tab/client)", () => {
    vi.setSystemTime(new Date("2026-06-18T00:00:00.000Z"));
    setDocument(emptyDocument("p1", "Test", "16:9"));
    addScene({ slug: "SCENE A" });
    const cur = getDocument()!;

    const fresher = clone(cur);
    fresher.meta.authoredAt = new Date("2026-06-18T00:00:10.000Z").toISOString();

    expect(skipsIncoming(cur, fresher)).toBe(false); // not skipped → applied
  });

  it("advances authoredAt monotonically across sequential edits", () => {
    vi.setSystemTime(new Date("2026-06-18T00:00:00.000Z"));
    setDocument(emptyDocument("p1", "Test", "16:9"));
    addScene({ slug: "A" });
    const t1 = getDocument()!.meta.authoredAt;

    vi.setSystemTime(new Date("2026-06-18T00:00:01.000Z"));
    addScene({ slug: "B" });
    const t2 = getDocument()!.meta.authoredAt;

    expect(t1).not.toBe(EPOCH);
    expect(t2).not.toBe(EPOCH);
    expect(t2 > t1).toBe(true);
  });
});
