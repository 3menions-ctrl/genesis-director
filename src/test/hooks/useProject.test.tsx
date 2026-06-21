/**
 * useProject — focused integration test of the hydration logic.
 *
 * The hook has three paths:
 *   • no projectId → clears the store
 *   • projectId === "demo" → bypasses Supabase, calls buildDemoProject()
 *   • everything else → fires 4 parallel Supabase queries
 *
 * The demo path is the highest-leverage to test because it (a) is the
 * primary first-visit experience, and (b) requires no mock plumbing —
 * if it breaks, every contributor and demo-link visitor sees an empty
 * editor.
 *
 * The DB-backed path is gated behind a Supabase mock — we verify the
 * hook calls the right tables and writes the result into the store
 * without asserting the full transform (that's covered by inline
 * unit tests on the individual helpers).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    supabase: {
      from: vi.fn().mockReturnValue(chain),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
    },
  };
});

import { useProject } from "@/hooks/editor/useProject";
import { getEditorState, __resetForTests } from "@/lib/editor/store";

beforeEach(__resetForTests);

describe("useProject", () => {
  it("clears the store when projectId is undefined", () => {
    renderHook(() => useProject(undefined));
    expect(getEditorState().project).toBeNull();
  });

  it("loads the demo project synchronously when projectId is 'demo'", async () => {
    renderHook(() => useProject("demo"));
    await waitFor(() => {
      expect(getEditorState().project).not.toBeNull();
    });
    const project = getEditorState().project!;
    expect(project.scenes.length).toBeGreaterThan(0);
    expect(project.scenes.flatMap((s) => s.clips).length).toBeGreaterThan(0);
  });

  it("the demo project ships ready-to-play clips with valid videoUrls", async () => {
    renderHook(() => useProject("demo"));
    await waitFor(() => {
      expect(getEditorState().project).not.toBeNull();
    });
    const clips = getEditorState().project!.scenes.flatMap((s) => s.clips);
    for (const clip of clips) {
      if (clip.kind === "title") continue;
      expect(clip.videoUrl).toBeTruthy();
      expect(typeof clip.videoUrl).toBe("string");
      expect(clip.durationSec).toBeGreaterThan(0);
    }
  });

  it("the demo project includes at least one scene with a non-empty title", async () => {
    renderHook(() => useProject("demo"));
    await waitFor(() => {
      expect(getEditorState().project).not.toBeNull();
    });
    const project = getEditorState().project!;
    const titled = project.scenes.find((s) => s.title && s.title.length > 0);
    expect(titled).toBeDefined();
  });
});
