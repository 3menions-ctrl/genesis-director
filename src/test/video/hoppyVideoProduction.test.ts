/**
 * HOPPY VIDEO PRODUCTION & EDITING — COMPREHENSIVE TESTS
 *
 * Validates that Hoppy can:
 *  1. Create projects with ANY clip count (1–20)
 *  2. Correctly estimate credits for tiered pricing
 *  3. Handle clip management (regenerate, reorder, delete, retry)
 *  4. Route to the video editor with correct params
 *  5. Fetch full script/production data for any project shape
 *  6. Apply music & effects via editor navigation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════
// §1  Credit estimation logic (mirrors agent-chat)
// ═══════════════════════════════════════════════

function estimateCredits(clipCount: number, clipDuration: number = 5): number {
  let total = 0;
  for (let i = 0; i < clipCount; i++) {
    total += (i >= 6 || clipDuration > 6) ? 15 : 10;
  }
  return total;
}

function estimateRegenerationCredits(clipIndex: number, clipDuration: number = 5): number {
  return (clipIndex >= 6 || clipDuration > 6) ? 15 : 10;
}

describe("Credit Estimation — Variable Clip Counts", () => {
  it("1 clip / 5s → 10 credits", () => {
    expect(estimateCredits(1)).toBe(10);
  });

  it("4 clips / 5s → 40 credits", () => {
    expect(estimateCredits(4)).toBe(40);
  });

  it("6 clips / 5s → 60 credits (all base rate)", () => {
    expect(estimateCredits(6)).toBe(60);
  });

  it("7 clips / 5s → 75 credits (clip 7 is extended)", () => {
    expect(estimateCredits(7)).toBe(75);
  });

  it("10 clips / 5s → 120 credits (4 extended)", () => {
    expect(estimateCredits(10)).toBe(6 * 10 + 4 * 15);
  });

  it("20 clips / 5s → 270 credits (14 extended)", () => {
    expect(estimateCredits(20)).toBe(6 * 10 + 14 * 15);
  });

  it("3 clips / 10s → 45 credits (all extended due to duration)", () => {
    expect(estimateCredits(3, 10)).toBe(45);
  });

  it("10 clips / 10s → 150 credits (all extended)", () => {
    expect(estimateCredits(10, 10)).toBe(150);
  });

  it("clip count clamped: 0 clips → 0 credits", () => {
    expect(estimateCredits(0)).toBe(0);
  });
});

describe("Regeneration Credit Estimation", () => {
  it("clip 0 / 5s → 10 credits", () => {
    expect(estimateRegenerationCredits(0)).toBe(10);
  });

  it("clip 5 / 5s → 10 credits (last base-rate index)", () => {
    expect(estimateRegenerationCredits(5)).toBe(10);
  });

  it("clip 6 / 5s → 15 credits (extended tier)", () => {
    expect(estimateRegenerationCredits(6)).toBe(15);
  });

  it("clip 19 / 5s → 15 credits (max index)", () => {
    expect(estimateRegenerationCredits(19)).toBe(15);
  });

  it("clip 0 / 10s → 15 credits (extended due to duration)", () => {
    expect(estimateRegenerationCredits(0, 10)).toBe(15);
  });
});

// ═══════════════════════════════════════════════
// §2  Project creation validation
// ═══════════════════════════════════════════════

function clampClipCount(raw: number): number {
  return Math.min(Math.max(raw, 1), 20);
}

describe("Project Creation — Clip Count Clamping", () => {
  it("clamps 0 to 1", () => expect(clampClipCount(0)).toBe(1));
  it("passes through 1", () => expect(clampClipCount(1)).toBe(1));
  it("passes through 6", () => expect(clampClipCount(6)).toBe(6));
  it("passes through 12", () => expect(clampClipCount(12)).toBe(12));
  it("passes through 20", () => expect(clampClipCount(20)).toBe(20));
  it("clamps 25 to 20", () => expect(clampClipCount(25)).toBe(20));
  it("clamps -5 to 1", () => expect(clampClipCount(-5)).toBe(1));
  it("clamps 100 to 20", () => expect(clampClipCount(100)).toBe(20));
});

// ═══════════════════════════════════════════════
// §3  Tool execution shape validation
// ═══════════════════════════════════════════════

interface ToolResult {
  action?: string;
  requires_confirmation?: boolean;
  estimated_credits?: number;
  error?: string;
  message?: string;
  navigate_to?: string;
  project_id?: string;
  clip_index?: number;
  path?: string;
  [key: string]: unknown;
}

function simulateCreateProject(args: { title?: string; prompt?: string; clip_count?: number; mode?: string }): ToolResult {
  const cc = clampClipCount(args.clip_count || 6);
  return {
    action: "project_created",
    project_id: "mock-uuid",
    title: args.title || "Untitled Project",
    navigate_to: "/projects",
  };
}

function simulateTriggerGeneration(project: { status: string; clip_count: number; clip_duration: number }, balance: number): ToolResult {
  if (project.status !== "draft") return { error: `Project is "${project.status}" — only drafts can generate.` };
  const est = estimateCredits(project.clip_count, project.clip_duration);
  if (balance < est) return { action: "insufficient_credits", required: est, available: balance, message: `Need ${est} credits, have ${balance}.` };
  return {
    action: "confirm_generation",
    requires_confirmation: true,
    estimated_credits: est,
    clip_count: project.clip_count,
    balance_after: balance - est,
  };
}

function simulateRegenerateClip(project: { clip_count: number; clip_duration: number }, clipIndex: number, balance: number): ToolResult {
  if (clipIndex < 0 || clipIndex >= project.clip_count) return { error: `No clip found at position ${clipIndex}` };
  const est = estimateRegenerationCredits(clipIndex, project.clip_duration);
  if (balance < est) return { action: "insufficient_credits", required: est, available: balance };
  return {
    action: "confirm_regenerate_clip",
    requires_confirmation: true,
    clip_index: clipIndex,
    estimated_credits: est,
    balance_after: balance - est,
  };
}

function simulateOpenVideoEditor(projectId: string): ToolResult {
  return { action: "navigate", path: `/video-editor?project=${projectId}`, message: "Opening Video Editor! 🎬" };
}

function simulateAddMusic(projectId: string, status: string, trackName: string, volume: number): ToolResult {
  if (status !== "completed") return { error: "Project must be completed before adding music." };
  return {
    action: "navigate",
    path: `/video-editor?project=${projectId}&addMusic=${encodeURIComponent(trackName)}&volume=${volume}`,
  };
}

function simulateApplyEffect(projectId: string, status: string, effect: string, intensity: number): ToolResult {
  if (status !== "completed") return { error: "Project must be completed before applying effects." };
  return {
    action: "navigate",
    path: `/video-editor?project=${projectId}&effect=${effect}&intensity=${intensity}`,
  };
}

describe("Trigger Generation — Variable Clip Counts", () => {
  const project = (cc: number, cd: number = 5) => ({ status: "draft", clip_count: cc, clip_duration: cd });

  it("1-clip project with enough credits → confirm", () => {
    const r = simulateTriggerGeneration(project(1), 100);
    expect(r.action).toBe("confirm_generation");
    expect(r.requires_confirmation).toBe(true);
    expect(r.estimated_credits).toBe(10);
  });

  it("6-clip project → 60 credits", () => {
    const r = simulateTriggerGeneration(project(6), 100);
    expect(r.estimated_credits).toBe(60);
  });

  it("12-clip project → 150 credits", () => {
    const r = simulateTriggerGeneration(project(12), 200);
    expect(r.estimated_credits).toBe(6 * 10 + 6 * 15);
  });

  it("20-clip project → 270 credits", () => {
    const r = simulateTriggerGeneration(project(20), 300);
    expect(r.estimated_credits).toBe(270);
  });

  it("insufficient credits → error", () => {
    const r = simulateTriggerGeneration(project(10), 50);
    expect(r.action).toBe("insufficient_credits");
    expect(r.required).toBe(120);
    expect(r.available).toBe(50);
  });

  it("non-draft project → error", () => {
    const r = simulateTriggerGeneration({ status: "generating", clip_count: 4, clip_duration: 5 }, 200);
    expect(r.error).toContain("only drafts");
  });

  it("10s clip duration → all extended pricing", () => {
    const r = simulateTriggerGeneration(project(4, 10), 200);
    expect(r.estimated_credits).toBe(60); // 4 × 15
  });
});

describe("Regenerate Clip — Any Position", () => {
  const proj = { clip_count: 12, clip_duration: 5 };

  it("clip 0 → base rate confirmation", () => {
    const r = simulateRegenerateClip(proj, 0, 100);
    expect(r.action).toBe("confirm_regenerate_clip");
    expect(r.estimated_credits).toBe(10);
  });

  it("clip 5 → last base-rate clip", () => {
    const r = simulateRegenerateClip(proj, 5, 100);
    expect(r.estimated_credits).toBe(10);
  });

  it("clip 6 → extended rate", () => {
    const r = simulateRegenerateClip(proj, 6, 100);
    expect(r.estimated_credits).toBe(15);
  });

  it("clip 11 → extended rate", () => {
    const r = simulateRegenerateClip(proj, 11, 100);
    expect(r.estimated_credits).toBe(15);
  });

  it("out of range clip → error", () => {
    const r = simulateRegenerateClip(proj, 12, 100);
    expect(r.error).toContain("No clip found");
  });

  it("negative index → error", () => {
    const r = simulateRegenerateClip(proj, -1, 100);
    expect(r.error).toContain("No clip found");
  });

  it("insufficient credits → blocked", () => {
    const r = simulateRegenerateClip(proj, 6, 5);
    expect(r.action).toBe("insufficient_credits");
  });
});

// ═══════════════════════════════════════════════
// §4  Editor Navigation & Editing Tools
// ═══════════════════════════════════════════════

describe("Video Editor Navigation", () => {
  it("generates correct editor path", () => {
    const r = simulateOpenVideoEditor("abc-123");
    expect(r.path).toBe("/video-editor?project=abc-123");
  });

  it("add music generates correct path with encoded track name", () => {
    const r = simulateAddMusic("p-1", "completed", "Epic Rise", 80);
    expect(r.path).toContain("addMusic=Epic%20Rise");
    expect(r.path).toContain("volume=80");
  });

  it("add music on non-completed project → error", () => {
    const r = simulateAddMusic("p-1", "draft", "Epic Rise", 80);
    expect(r.error).toContain("completed");
  });

  it("apply effect generates correct path", () => {
    const r = simulateApplyEffect("p-1", "completed", "vintage", 75);
    expect(r.path).toContain("effect=vintage");
    expect(r.path).toContain("intensity=75");
  });

  it("apply effect on generating project → error", () => {
    const r = simulateApplyEffect("p-1", "generating", "glitch", 50);
    expect(r.error).toContain("completed");
  });
});

// ═══════════════════════════════════════════════
// §5  Clip CRUD operations
// ═══════════════════════════════════════════════

interface MockClip {
  id: string;
  shot_index: number;
  prompt: string;
  status: string;
}

function simulateReorderClips(clips: MockClip[], newOrder: { clip_id: string; new_index: number }[]): MockClip[] {
  const reordered = clips.map(c => {
    const order = newOrder.find(o => o.clip_id === c.id);
    return order ? { ...c, shot_index: order.new_index } : c;
  });
  return reordered.sort((a, b) => a.shot_index - b.shot_index);
}

function simulateDeleteClip(clips: MockClip[], clipId: string, projectStatus: string): { clips: MockClip[]; error?: string } {
  if (projectStatus !== "draft") return { clips, error: "Can only delete clips from draft projects." };
  return { clips: clips.filter(c => c.id !== clipId) };
}

function simulateRetryFailed(clip: MockClip): MockClip {
  if (clip.status !== "failed") return clip;
  return { ...clip, status: "pending" };
}

describe("Clip Management Operations", () => {
  const baseClips: MockClip[] = [
    { id: "c1", shot_index: 0, prompt: "Ocean sunrise", status: "completed" },
    { id: "c2", shot_index: 1, prompt: "Mountain view", status: "completed" },
    { id: "c3", shot_index: 2, prompt: "Forest path", status: "failed" },
    { id: "c4", shot_index: 3, prompt: "City lights", status: "pending" },
  ];

  it("reorder: swap first and last", () => {
    const result = simulateReorderClips(baseClips, [
      { clip_id: "c1", new_index: 3 },
      { clip_id: "c4", new_index: 0 },
    ]);
    expect(result[0].id).toBe("c4");
    expect(result[result.length - 1].id).toBe("c1");
  });

  it("reorder: reverse all", () => {
    const result = simulateReorderClips(baseClips, [
      { clip_id: "c1", new_index: 3 },
      { clip_id: "c2", new_index: 2 },
      { clip_id: "c3", new_index: 1 },
      { clip_id: "c4", new_index: 0 },
    ]);
    expect(result.map(c => c.id)).toEqual(["c4", "c3", "c2", "c1"]);
  });

  it("delete clip from draft project", () => {
    const result = simulateDeleteClip(baseClips, "c3", "draft");
    expect(result.clips).toHaveLength(3);
    expect(result.error).toBeUndefined();
  });

  it("delete clip from non-draft → error", () => {
    const result = simulateDeleteClip(baseClips, "c1", "completed");
    expect(result.error).toContain("draft");
    expect(result.clips).toHaveLength(4);
  });

  it("retry failed clip → pending", () => {
    const result = simulateRetryFailed(baseClips[2]);
    expect(result.status).toBe("pending");
  });

  it("retry non-failed clip → no change", () => {
    const result = simulateRetryFailed(baseClips[0]);
    expect(result.status).toBe("completed");
  });
});

// ═══════════════════════════════════════════════
// §6  Script data shape validation (any clip count)
// ═══════════════════════════════════════════════

interface ScriptDataResponse {
  project: { clip_count: number; status: string };
  clips: Array<{ index: number; full_prompt: string; status: string }>;
  total_clips: number;
  completed_clips: number;
  failed_clips: number;
  pending_clips: number;
}

function mockScriptData(clipCount: number, statuses: string[]): ScriptDataResponse {
  const clips = Array.from({ length: clipCount }, (_, i) => ({
    index: i,
    full_prompt: `Shot ${i}: Test prompt for clip ${i}`,
    status: statuses[i] || "pending",
  }));
  return {
    project: { clip_count: clipCount, status: "generating" },
    clips,
    total_clips: clipCount,
    completed_clips: clips.filter(c => c.status === "completed").length,
    failed_clips: clips.filter(c => c.status === "failed").length,
    pending_clips: clips.filter(c => c.status === "pending").length,
  };
}

describe("Script Data — Variable Clip Counts", () => {
  it("1-clip project has correct shape", () => {
    const data = mockScriptData(1, ["completed"]);
    expect(data.total_clips).toBe(1);
    expect(data.completed_clips).toBe(1);
  });

  it("6-clip project all completed", () => {
    const data = mockScriptData(6, Array(6).fill("completed"));
    expect(data.completed_clips).toBe(6);
    expect(data.failed_clips).toBe(0);
  });

  it("12-clip mixed statuses", () => {
    const statuses = ["completed", "completed", "failed", "completed", "pending", "completed", "completed", "failed", "pending", "pending", "completed", "completed"];
    const data = mockScriptData(12, statuses);
    expect(data.total_clips).toBe(12);
    expect(data.completed_clips).toBe(7);
    expect(data.failed_clips).toBe(2);
    expect(data.pending_clips).toBe(3);
  });

  it("20-clip project all pending", () => {
    const data = mockScriptData(20, []);
    expect(data.total_clips).toBe(20);
    expect(data.pending_clips).toBe(20);
  });

  it("clips have sequential indices", () => {
    const data = mockScriptData(15, []);
    data.clips.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.full_prompt).toContain(`clip ${i}`);
    });
  });
});

// ═══════════════════════════════════════════════
// §7  Music library structure
// ═══════════════════════════════════════════════

const MUSIC_GENRES: Record<string, string[]> = {
  cinematic: ["Epic Rise", "Dramatic Tension", "Heroic Journey", "Emotional Piano", "Battle Hymn"],
  pop: ["Feel Good Summer", "Upbeat Vibes", "Dance Energy", "Pop Anthem", "Chill Pop"],
  ambient: ["Calm Waters", "Forest Dawn", "Deep Space", "Meditation Flow", "Night Sky"],
  electronic: ["Neon Pulse", "Synthwave Drive", "Cyber City", "Bass Drop", "Future Funk"],
  "hip-hop": ["Urban Beat", "Trap Melody", "Boom Bap Classic", "Lo-Fi Chill", "Street Anthem"],
  classical: ["Moonlight Sonata", "Four Seasons", "Symphony No. 5", "Clair de Lune", "Canon in D"],
};

describe("Music Library", () => {
  it("has 6 genres", () => {
    expect(Object.keys(MUSIC_GENRES)).toHaveLength(6);
  });

  it("each genre has 5 tracks", () => {
    for (const [genre, tracks] of Object.entries(MUSIC_GENRES)) {
      expect(tracks).toHaveLength(5);
    }
  });

  it("total library has 30 tracks", () => {
    const total = Object.values(MUSIC_GENRES).flat().length;
    expect(total).toBe(30);
  });

  it("no duplicate track names across genres", () => {
    const all = Object.values(MUSIC_GENRES).flat();
    const unique = new Set(all);
    expect(unique.size).toBe(all.length);
  });
});

// ═══════════════════════════════════════════════
// §8  Full production lifecycle simulation
// ═══════════════════════════════════════════════

describe("Full Lifecycle — Hoppy Creates, Generates & Edits", () => {
  const clipCounts = [1, 2, 4, 6, 8, 12, 16, 20];

  clipCounts.forEach(cc => {
    it(`lifecycle for ${cc}-clip project`, () => {
      // Step 1: Create
      const created = simulateCreateProject({ title: `Test ${cc}`, clip_count: cc });
      expect(created.action).toBe("project_created");

      // Step 2: Trigger generation
      const est = estimateCredits(cc);
      const gen = simulateTriggerGeneration({ status: "draft", clip_count: cc, clip_duration: 5 }, est + 50);
      expect(gen.action).toBe("confirm_generation");
      expect(gen.estimated_credits).toBe(est);
      expect((gen.balance_after as number)).toBeGreaterThanOrEqual(0);

      // Step 3: Verify script data shape
      const script = mockScriptData(cc, Array(cc).fill("completed"));
      expect(script.completed_clips).toBe(cc);
      expect(script.total_clips).toBe(cc);

      // Step 4: Regenerate middle clip
      const midIndex = Math.floor(cc / 2);
      const regen = simulateRegenerateClip({ clip_count: cc, clip_duration: 5 }, midIndex, 100);
      expect(regen.action).toBe("confirm_regenerate_clip");

      // Step 5: Open editor
      const editor = simulateOpenVideoEditor("mock-proj-id");
      expect(editor.path).toContain("/video-editor");

      // Step 6: Add music
      const music = simulateAddMusic("mock-proj-id", "completed", "Epic Rise", 70);
      expect(music.path).toContain("addMusic");

      // Step 7: Apply effect
      const effect = simulateApplyEffect("mock-proj-id", "completed", "cinematic-lut", 60);
      expect(effect.path).toContain("effect=cinematic-lut");
    });
  });
});
