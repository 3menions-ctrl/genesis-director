/**
 * HOPPY VIDEO PRODUCTION & EDITING — COMPREHENSIVE TESTS
 *
 * Mirrors the ACTUAL business logic from supabase/functions/agent-chat/index.ts
 * covering every tool, error path, edge case, and data shape that Hoppy uses
 * for video production workflows.
 *
 * Sections:
 *  1. Credit estimation (exact tiered pricing from agent-chat)
 *  2. Project CRUD (create, rename, delete, duplicate)
 *  3. Generation trigger (draft-only, credit checks, balance math)
 *  4. Start creation flow (quick-create variant)
 *  5. Clip editing (update prompt, retry failed, regenerate, reorder, delete)
 *  6. Video editor & post-production (open editor, add music, apply effects)
 *  7. Music library (genre browsing, filtering, structure)
 *  8. Script data shape (get_project_script_data response fidelity)
 *  9. Access control & authorization patterns
 * 10. Full lifecycle simulations (1–20 clips)
 * 11. Edge cases & boundary conditions
 */

import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════════════
// Shared types & helpers (mirror agent-chat exactly)
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
  reason?: string;
  [key: string]: unknown;
}

interface ProjectRow {
  id: string;
  title: string;
  status: string;
  clip_count: number;
  clip_duration: number;
  prompt: string;
  mode: string;
  aspect_ratio: string;
  video_url?: string | null;
  user_id: string;
}

interface ClipRow {
  id: string;
  project_id: string;
  shot_index: number;
  prompt: string;
  status: string;
  video_url?: string | null;
  last_frame_url?: string | null;
  duration_seconds?: number;
  error_message?: string | null;
  retry_count: number;
  quality_score?: number | null;
  motion_vectors?: Record<string, unknown> | null;
  created_at: string;
  completed_at?: string | null;
}

// ─── Credit calculation (exact copy from agent-chat lines 1435-1436) ───

function estimateCredits(clipCount: number, clipDuration: number = 5): number {
  let total = 0;
  for (let i = 0; i < clipCount; i++) {
    total += (i >= 6 || clipDuration > 6) ? 15 : 10;
  }
  return total;
}

function estimateRegenerationCredits(clipIndex: number, clipDuration: number = 5): number {
  const isExtended = clipIndex >= 6 || clipDuration > 6;
  return isExtended ? 15 : 10;
}

// Tool credit costs (from TOOL_CREDIT_COSTS in agent-chat)
const TOOL_CREDIT_COSTS: Record<string, number> = {
  create_project: 2,
  rename_project: 1,
  delete_project: 0,
  duplicate_project: 2,
  trigger_generation: 0, // pipeline handles
  open_video_editor: 0,
  get_clip_details: 0,
  get_project_script_data: 0,
  regenerate_clip: 0, // pipeline handles
  update_clip_prompt: 1,
  retry_failed_clip: 0,
  reorder_clips: 1,
  delete_clip: 0,
  add_music_to_project: 1,
  apply_video_effect: 1,
  get_music_library: 0,
};

function clampClipCount(raw: number): number {
  return Math.min(Math.max(raw, 1), 20);
}

// ─── Tool simulators (mirror actual case handlers) ───

function simulateCreateProject(args: {
  title?: string; prompt?: string; clip_count?: number;
  mode?: string; aspect_ratio?: string; clip_duration?: number;
}, userId: string): ToolResult {
  const cc = Math.min(Math.max((args.clip_count as number) || 6, 1), 20);
  const cd = (args.clip_duration as number) || 5;
  return {
    action: "project_created",
    project_id: "mock-uuid",
    title: args.title || "Untitled Project",
    message: `Project "${args.title || "Untitled Project"}" created!`,
    navigate_to: "/projects",
  };
}

function simulateRenameProject(project: ProjectRow | null, newTitle: string, userId: string): ToolResult {
  if (!project) return { error: "Project not found" };
  if (project.user_id !== userId) return { error: "Project not found" };
  return { action: "project_renamed", old_title: project.title, new_title: newTitle, message: `Renamed to "${newTitle}"` };
}

function simulateDeleteProject(project: ProjectRow | null, userId: string): ToolResult {
  if (!project) return { error: "Project not found" };
  if (project.user_id !== userId) return { error: "Project not found" };
  if (!["draft", "failed"].includes(project.status)) return { error: `Can't delete "${project.status}" project` };
  return { action: "confirm_delete", requires_confirmation: true, project_id: project.id, title: project.title, message: `Delete "${project.title}"? This can't be undone.` };
}

function simulateDuplicateProject(source: ProjectRow | null, newTitle: string | null, userId: string): ToolResult {
  if (!source) return { error: "Source project not found" };
  if (source.user_id !== userId) return { error: "Source project not found" };
  const title = newTitle || `${source.title} (copy)`;
  return { action: "project_created", project_id: "dup-uuid", title, message: `Duplicated as "${title}"`, navigate_to: "/projects" };
}

function simulateTriggerGeneration(project: ProjectRow | null, balance: number, userId: string): ToolResult {
  if (!project) return { error: "Project not found" };
  if (project.user_id !== userId) return { error: "Project not found" };
  if (project.status !== "draft") return { error: `Project is "${project.status}" — only drafts can generate.` };
  const cc = project.clip_count || 6;
  const cd = project.clip_duration || 5;
  const est = estimateCredits(cc, cd);
  if (balance < est) return { action: "insufficient_credits", required: est, available: balance, message: `Need ${est} credits, have ${balance}.` };
  return {
    action: "confirm_generation", requires_confirmation: true,
    project_id: project.id, title: project.title, estimated_credits: est,
    clip_count: cc, balance_after: balance - est,
    message: `Generate "${project.title}" (${cc} clips)? Uses ~${est} credits.`,
  };
}

function simulateStartCreationFlow(args: { clip_count?: number; mode?: string; prompt?: string; style?: string; aspect_ratio?: string }): ToolResult {
  const cc = (args.clip_count as number) || 4;
  let est = 0;
  // Note: start_creation_flow does NOT factor in clip_duration (unlike trigger_generation)
  for (let i = 0; i < cc; i++) est += (i >= 6) ? 15 : 10;
  return {
    action: "start_creation", requires_confirmation: true, estimated_credits: est,
    params: { mode: args.mode, prompt: args.prompt, style: args.style || "cinematic", aspect_ratio: args.aspect_ratio || "16:9", clip_count: cc },
  };
}

function simulateOpenVideoEditor(project: ProjectRow | null, userId: string): ToolResult {
  if (!project) return { error: "Project not found" };
  if (project.user_id !== userId) return { error: "Project not found" };
  if (!project.video_url && project.status !== "completed") return { error: "Project needs to be completed first to edit." };
  return { action: "navigate", path: `/video-editor?project=${project.id}`, reason: `Opening editor for "${project.title}"` };
}

function simulateUpdateClipPrompt(clip: ClipRow | null, project: ProjectRow | null, newPrompt: string, userId: string): ToolResult {
  if (!clip) return { error: "Clip not found" };
  if (!project) return { error: "Access denied" };
  if (project.user_id !== userId) return { error: "Access denied" };
  if (!["draft", "failed", "pending"].includes(clip.status)) return { error: `Can't edit a "${clip.status}" clip — only draft/pending/failed clips can be updated.` };
  return { message: `Clip prompt updated! The new prompt is ready for generation. ✨`, old_prompt: clip.prompt, new_prompt: newPrompt };
}

function simulateRetryFailedClip(clip: ClipRow | null, project: ProjectRow | null, userId: string): ToolResult {
  if (!clip) return { error: "Clip not found" };
  if (!project) return { error: "Access denied" };
  if (project.user_id !== userId) return { error: "Access denied" };
  if (clip.status !== "failed") return { error: `Clip is "${clip.status}" — only failed clips can be retried.` };
  return { message: `Clip reset to pending! It will be picked up by the pipeline automatically. 🔄`, retry_count: (clip.retry_count || 0) + 1 };
}

function simulateRegenerateClip(project: ProjectRow | null, clipIndex: number, clip: ClipRow | null, balance: number, newPrompt: string | null, userId: string): ToolResult {
  if (!project) return { error: "Project not found or access denied" };
  if (project.user_id !== userId) return { error: "Project not found or access denied" };
  if (!clip) return { error: `No clip found at position ${clipIndex}` };
  const isExtended = clipIndex >= 6 || (project.clip_duration || 5) > 6;
  const estimatedCredits = isExtended ? 15 : 10;
  if (balance < estimatedCredits) {
    return { action: "insufficient_credits", required: estimatedCredits, available: balance, message: `Regenerating clip #${clipIndex + 1} costs ~${estimatedCredits} credits but you have ${balance}. Top up at /pricing!` };
  }
  return {
    action: "confirm_regenerate_clip", requires_confirmation: true,
    project_id: project.id, project_title: project.title,
    clip_index: clipIndex, clip_id: clip.id,
    current_status: clip.status,
    current_prompt_preview: (clip.prompt || "").substring(0, 120),
    new_prompt: newPrompt,
    estimated_credits: estimatedCredits,
    balance_after: balance - estimatedCredits,
  };
}

function simulateReorderClips(project: ProjectRow | null, clipOrder: Array<{ clip_id: string; new_index: number }>, userId: string): ToolResult {
  if (!project) return { error: "Project not found or access denied" };
  if (project.user_id !== userId) return { error: "Project not found or access denied" };
  if (project.status !== "draft" && project.status !== "completed") return { error: `Can only reorder clips in draft or completed projects.` };
  if (!clipOrder || clipOrder.length === 0) return { error: "No clip order provided" };
  return { message: `Clips reordered successfully! 🎬`, reordered: clipOrder.length };
}

function simulateDeleteClip(clip: ClipRow | null, project: ProjectRow | null, userId: string): ToolResult {
  if (!clip) return { error: "Clip not found" };
  if (!project) return { error: "Access denied" };
  if (project.user_id !== userId) return { error: "Access denied" };
  if (project.status !== "draft") return { error: "Can only delete clips from draft projects." };
  return { message: `Clip #${clip.shot_index + 1} deleted! 🗑️` };
}

function simulateAddMusic(project: ProjectRow | null, trackName: string, volume: number, userId: string): ToolResult {
  if (!project) return { error: "Project not found or access denied" };
  if (project.user_id !== userId) return { error: "Project not found or access denied" };
  if (project.status !== "completed") return { error: "Project must be completed before adding music. Try opening the Video Editor instead!" };
  return {
    action: "navigate",
    path: `/video-editor?project=${project.id}&addMusic=${encodeURIComponent(trackName || "cinematic")}&volume=${volume || 70}`,
    reason: `Opening editor to add "${trackName || "cinematic"}" music to "${project.title}"`,
    message: `Opening the Video Editor with music ready to add! 🎵`,
  };
}

function simulateApplyEffect(project: ProjectRow | null, effect: string, intensity: number, userId: string): ToolResult {
  if (!project) return { error: "Project not found or access denied" };
  if (project.user_id !== userId) return { error: "Project not found or access denied" };
  if (project.status !== "completed") return { error: "Project must be completed before applying effects." };
  return {
    action: "navigate",
    path: `/video-editor?project=${project.id}&effect=${effect}&intensity=${intensity || 50}`,
    reason: `Opening editor to apply "${effect}" effect to "${project.title}"`,
    message: `Opening the Video Editor with the ${effect} effect ready! ✨`,
  };
}

const MUSIC_GENRES: Record<string, string[]> = {
  cinematic: ["Epic Rise", "Dramatic Tension", "Heroic Journey", "Emotional Piano", "Battle Hymn"],
  pop: ["Feel Good Summer", "Upbeat Vibes", "Dance Energy", "Pop Anthem", "Chill Pop"],
  ambient: ["Calm Waters", "Forest Dawn", "Deep Space", "Meditation Flow", "Night Sky"],
  electronic: ["Neon Pulse", "Synthwave Drive", "Cyber City", "Bass Drop", "Future Funk"],
  "hip-hop": ["Urban Beat", "Trap Melody", "Boom Bap Classic", "Lo-Fi Chill", "Street Anthem"],
  classical: ["Moonlight Sonata", "Four Seasons", "Symphony No. 5", "Clair de Lune", "Canon in D"],
};

function simulateGetMusicLibrary(genre?: string): ToolResult {
  if (genre && MUSIC_GENRES[genre.toLowerCase()]) {
    const g = genre.toLowerCase();
    return { tracks: MUSIC_GENRES[g].map(t => ({ name: t, genre: g })), genre: g, total: MUSIC_GENRES[g].length };
  }
  return {
    genres: Object.keys(MUSIC_GENRES),
    total_tracks: Object.values(MUSIC_GENRES).flat().length,
    sample: Object.entries(MUSIC_GENRES).map(([g, tracks]) => ({ genre: g, sample_track: tracks[0] })),
  };
}

// ─── Factory helpers ───

const USER_ID = "user-123";
const OTHER_USER = "user-other";

function makeProject(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: "proj-1", title: "Test Project", status: "draft",
    clip_count: 6, clip_duration: 5, prompt: "A cinematic video",
    mode: "text-to-video", aspect_ratio: "16:9", video_url: null,
    user_id: USER_ID, ...overrides,
  };
}

function makeClip(overrides: Partial<ClipRow> = {}): ClipRow {
  return {
    id: "clip-1", project_id: "proj-1", shot_index: 0,
    prompt: "A beautiful sunrise over the ocean", status: "completed",
    retry_count: 0, created_at: "2025-01-01T00:00:00Z",
    motion_vectors: null, quality_score: null, ...overrides,
  };
}


// ═══════════════════════════════════════════════
// §1  Credit Estimation — Exact Tiered Pricing
// ═══════════════════════════════════════════════

describe("Credit Estimation — Tiered Pricing", () => {
  describe("batch generation pricing", () => {
    it.each([
      [0, 5, 0],
      [1, 5, 10],
      [2, 5, 20],
      [3, 5, 30],
      [4, 5, 40],
      [5, 5, 50],
      [6, 5, 60],    // all 6 at base rate
      [7, 5, 75],    // 6×10 + 1×15
      [8, 5, 90],    // 6×10 + 2×15
      [10, 5, 120],  // 6×10 + 4×15
      [12, 5, 150],  // 6×10 + 6×15
      [15, 5, 195],  // 6×10 + 9×15
      [20, 5, 270],  // 6×10 + 14×15
    ])("%i clips @ %is → %i credits", (clips, dur, expected) => {
      expect(estimateCredits(clips, dur)).toBe(expected);
    });

    it("extended duration (>6s) makes ALL clips cost 15", () => {
      expect(estimateCredits(1, 7)).toBe(15);
      expect(estimateCredits(1, 10)).toBe(15);
      expect(estimateCredits(6, 8)).toBe(90);  // 6×15
      expect(estimateCredits(10, 10)).toBe(150); // 10×15
      expect(estimateCredits(20, 10)).toBe(300); // 20×15
    });

    it("duration exactly 6s stays base rate for first 6 clips", () => {
      expect(estimateCredits(6, 6)).toBe(60);   // 6×10 — NOT extended
      expect(estimateCredits(7, 6)).toBe(75);    // 6×10 + 1×15
    });
  });

  describe("single clip regeneration pricing", () => {
    it.each([
      [0, 5, 10],  [1, 5, 10],  [5, 5, 10],   // base rate
      [6, 5, 15],  [11, 5, 15], [19, 5, 15],   // extended tier
    ])("clip %i @ %is → %i credits", (idx, dur, expected) => {
      expect(estimateRegenerationCredits(idx, dur)).toBe(expected);
    });

    it("extended duration overrides index-based pricing", () => {
      expect(estimateRegenerationCredits(0, 7)).toBe(15);
      expect(estimateRegenerationCredits(0, 10)).toBe(15);
      expect(estimateRegenerationCredits(5, 8)).toBe(15);
    });
  });
});

describe("Tool Credit Costs", () => {
  it("free tools cost 0", () => {
    const freeTools = ["trigger_generation", "open_video_editor", "get_clip_details", "get_project_script_data", "regenerate_clip", "retry_failed_clip", "delete_clip", "get_music_library"];
    freeTools.forEach(t => expect(TOOL_CREDIT_COSTS[t]).toBe(0));
  });

  it("cheap tools cost 1-2", () => {
    expect(TOOL_CREDIT_COSTS.create_project).toBe(2);
    expect(TOOL_CREDIT_COSTS.duplicate_project).toBe(2);
    expect(TOOL_CREDIT_COSTS.rename_project).toBe(1);
    expect(TOOL_CREDIT_COSTS.update_clip_prompt).toBe(1);
    expect(TOOL_CREDIT_COSTS.reorder_clips).toBe(1);
    expect(TOOL_CREDIT_COSTS.add_music_to_project).toBe(1);
    expect(TOOL_CREDIT_COSTS.apply_video_effect).toBe(1);
  });
});


// ═══════════════════════════════════════════════
// §2  Project CRUD
// ═══════════════════════════════════════════════

describe("Project Creation", () => {
  it("creates with defaults", () => {
    const r = simulateCreateProject({}, USER_ID);
    expect(r.action).toBe("project_created");
    expect(r.title).toBe("Untitled Project");
    expect(r.navigate_to).toBe("/projects");
    expect(r.project_id).toBeTruthy();
  });

  it("uses provided title and navigates to /projects", () => {
    const r = simulateCreateProject({ title: "My Film" }, USER_ID);
    expect(r.title).toBe("My Film");
    expect(r.message).toContain("My Film");
  });

  it("clip count is clamped between 1 and 20", () => {
    expect(clampClipCount(0)).toBe(1);
    expect(clampClipCount(-10)).toBe(1);
    expect(clampClipCount(1)).toBe(1);
    expect(clampClipCount(10)).toBe(10);
    expect(clampClipCount(20)).toBe(20);
    expect(clampClipCount(21)).toBe(20);
    expect(clampClipCount(100)).toBe(20);
    expect(clampClipCount(NaN)).toBeNaN(); // Math.min/max with NaN propagates NaN
  });
});

describe("Project Rename", () => {
  it("renames owned project", () => {
    const r = simulateRenameProject(makeProject(), "New Title", USER_ID);
    expect(r.action).toBe("project_renamed");
    expect(r.old_title).toBe("Test Project");
    expect(r.new_title).toBe("New Title");
  });

  it("rejects null project", () => {
    expect(simulateRenameProject(null, "New", USER_ID).error).toBe("Project not found");
  });

  it("rejects unowned project", () => {
    expect(simulateRenameProject(makeProject({ user_id: OTHER_USER }), "New", USER_ID).error).toBe("Project not found");
  });
});

describe("Project Delete", () => {
  it("allows deleting draft projects", () => {
    const r = simulateDeleteProject(makeProject({ status: "draft" }), USER_ID);
    expect(r.action).toBe("confirm_delete");
    expect(r.requires_confirmation).toBe(true);
  });

  it("allows deleting failed projects", () => {
    const r = simulateDeleteProject(makeProject({ status: "failed" }), USER_ID);
    expect(r.action).toBe("confirm_delete");
  });

  it.each(["completed", "generating", "processing", "stitching"])(
    "blocks deleting %s projects", (status) => {
      const r = simulateDeleteProject(makeProject({ status }), USER_ID);
      expect(r.error).toContain(`Can't delete "${status}"`);
    }
  );

  it("rejects unowned project", () => {
    expect(simulateDeleteProject(makeProject({ user_id: OTHER_USER }), USER_ID).error).toBe("Project not found");
  });
});

describe("Project Duplicate", () => {
  it("duplicates with auto-generated title", () => {
    const r = simulateDuplicateProject(makeProject({ title: "Original" }), null, USER_ID);
    expect(r.action).toBe("project_created");
    expect(r.title).toBe("Original (copy)");
    expect(r.navigate_to).toBe("/projects");
  });

  it("duplicates with custom title", () => {
    const r = simulateDuplicateProject(makeProject(), "My Copy", USER_ID);
    expect(r.title).toBe("My Copy");
  });

  it("rejects missing source", () => {
    expect(simulateDuplicateProject(null, null, USER_ID).error).toBe("Source project not found");
  });

  it("rejects unowned source", () => {
    expect(simulateDuplicateProject(makeProject({ user_id: OTHER_USER }), null, USER_ID).error).toBe("Source project not found");
  });
});


// ═══════════════════════════════════════════════
// §3  Generation Trigger
// ═══════════════════════════════════════════════

describe("Trigger Generation", () => {
  it("confirms generation for draft project with sufficient credits", () => {
    const proj = makeProject({ clip_count: 6 });
    const r = simulateTriggerGeneration(proj, 100, USER_ID);
    expect(r.action).toBe("confirm_generation");
    expect(r.requires_confirmation).toBe(true);
    expect(r.estimated_credits).toBe(60);
    expect(r.clip_count).toBe(6);
    expect(r.balance_after).toBe(40);
  });

  it("uses project's clip_duration for pricing", () => {
    const proj = makeProject({ clip_count: 4, clip_duration: 10 });
    const r = simulateTriggerGeneration(proj, 200, USER_ID);
    expect(r.estimated_credits).toBe(60); // 4×15 (extended duration)
  });

  it("defaults clip_count to 6 when 0/null", () => {
    const proj = makeProject({ clip_count: 0 });
    const r = simulateTriggerGeneration(proj, 200, USER_ID);
    // clip_count || 6 = 6
    expect(r.estimated_credits).toBe(60);
  });

  it("rejects non-draft statuses", () => {
    ["generating", "completed", "processing", "stitching", "failed"].forEach(status => {
      const r = simulateTriggerGeneration(makeProject({ status }), 500, USER_ID);
      expect(r.error).toContain("only drafts");
    });
  });

  it("returns insufficient_credits with details", () => {
    const r = simulateTriggerGeneration(makeProject({ clip_count: 10 }), 50, USER_ID);
    expect(r.action).toBe("insufficient_credits");
    expect(r.required).toBe(120);
    expect(r.available).toBe(50);
    expect(r.message).toContain("Need 120 credits");
  });

  it("handles exact credit balance (no excess)", () => {
    const r = simulateTriggerGeneration(makeProject({ clip_count: 6 }), 60, USER_ID);
    expect(r.action).toBe("confirm_generation");
    expect(r.balance_after).toBe(0);
  });

  it("handles 1 credit short", () => {
    const r = simulateTriggerGeneration(makeProject({ clip_count: 6 }), 59, USER_ID);
    expect(r.action).toBe("insufficient_credits");
  });

  it.each([1, 2, 4, 6, 8, 10, 12, 16, 20])(
    "correct pricing for %i-clip project", (cc) => {
      const proj = makeProject({ clip_count: cc });
      const r = simulateTriggerGeneration(proj, 999, USER_ID);
      expect(r.estimated_credits).toBe(estimateCredits(cc));
    }
  );
});


// ═══════════════════════════════════════════════
// §4  Start Creation Flow
// ═══════════════════════════════════════════════

describe("Start Creation Flow", () => {
  it("returns confirmation with params and defaults", () => {
    const r = simulateStartCreationFlow({ prompt: "test" });
    expect(r.action).toBe("start_creation");
    expect(r.requires_confirmation).toBe(true);
    expect(r.estimated_credits).toBe(40); // default 4 clips × 10
    expect((r.params as any).style).toBe("cinematic");
    expect((r.params as any).aspect_ratio).toBe("16:9");
    expect((r.params as any).clip_count).toBe(4);
  });

  it("does NOT use clip_duration for pricing (unlike trigger_generation)", () => {
    // start_creation_flow in agent-chat line 1451 doesn't check clip_duration
    const r = simulateStartCreationFlow({ clip_count: 4 });
    expect(r.estimated_credits).toBe(40); // always base, no duration check
  });

  it("applies extended pricing for clips > 6", () => {
    const r = simulateStartCreationFlow({ clip_count: 10 });
    expect(r.estimated_credits).toBe(6 * 10 + 4 * 15); // 120
  });
});


// ═══════════════════════════════════════════════
// §5  Clip Editing Tools
// ═══════════════════════════════════════════════

describe("Update Clip Prompt", () => {
  const proj = makeProject();

  it("updates draft clip", () => {
    const clip = makeClip({ status: "draft" });
    const r = simulateUpdateClipPrompt(clip, proj, "new prompt", USER_ID);
    expect(r.message).toContain("updated");
    expect(r.old_prompt).toBe("A beautiful sunrise over the ocean");
    expect(r.new_prompt).toBe("new prompt");
  });

  it("updates pending clip", () => {
    const r = simulateUpdateClipPrompt(makeClip({ status: "pending" }), proj, "x", USER_ID);
    expect(r.message).toContain("updated");
  });

  it("updates failed clip", () => {
    const r = simulateUpdateClipPrompt(makeClip({ status: "failed" }), proj, "x", USER_ID);
    expect(r.message).toContain("updated");
  });

  it("rejects completed clip", () => {
    const r = simulateUpdateClipPrompt(makeClip({ status: "completed" }), proj, "x", USER_ID);
    expect(r.error).toContain("completed");
    expect(r.error).toContain("only draft/pending/failed");
  });

  it("rejects generating clip", () => {
    const r = simulateUpdateClipPrompt(makeClip({ status: "generating" }), proj, "x", USER_ID);
    expect(r.error).toContain("generating");
  });

  it("rejects null clip", () => {
    expect(simulateUpdateClipPrompt(null, proj, "x", USER_ID).error).toBe("Clip not found");
  });

  it("rejects unauthorized access", () => {
    expect(simulateUpdateClipPrompt(makeClip(), makeProject({ user_id: OTHER_USER }), "x", USER_ID).error).toBe("Access denied");
  });
});

describe("Retry Failed Clip", () => {
  const proj = makeProject();

  it("resets failed clip to pending", () => {
    const clip = makeClip({ status: "failed", retry_count: 2 });
    const r = simulateRetryFailedClip(clip, proj, USER_ID);
    expect(r.message).toContain("pending");
    expect(r.retry_count).toBe(3);
  });

  it("increments retry_count from 0", () => {
    const clip = makeClip({ status: "failed", retry_count: 0 });
    const r = simulateRetryFailedClip(clip, proj, USER_ID);
    expect(r.retry_count).toBe(1);
  });

  it.each(["completed", "pending", "generating", "draft"])(
    "rejects %s clip", (status) => {
      const r = simulateRetryFailedClip(makeClip({ status }), proj, USER_ID);
      expect(r.error).toContain(`Clip is "${status}"`);
      expect(r.error).toContain("only failed");
    }
  );

  it("rejects null clip", () => {
    expect(simulateRetryFailedClip(null, proj, USER_ID).error).toBe("Clip not found");
  });
});

describe("Regenerate Clip", () => {
  const proj = makeProject({ clip_count: 12, clip_duration: 5 });

  it("confirms regeneration with base-rate clip", () => {
    const clip = makeClip({ shot_index: 3 });
    const r = simulateRegenerateClip(proj, 3, clip, 100, null, USER_ID);
    expect(r.action).toBe("confirm_regenerate_clip");
    expect(r.requires_confirmation).toBe(true);
    expect(r.estimated_credits).toBe(10);
    expect(r.balance_after).toBe(90);
    expect(r.new_prompt).toBeNull();
  });

  it("confirms regeneration with extended-rate clip", () => {
    const clip = makeClip({ shot_index: 8 });
    const r = simulateRegenerateClip(proj, 8, clip, 100, null, USER_ID);
    expect(r.estimated_credits).toBe(15);
    expect(r.balance_after).toBe(85);
  });

  it("includes new_prompt when provided", () => {
    const clip = makeClip({ shot_index: 0 });
    const r = simulateRegenerateClip(proj, 0, clip, 100, "New cinematic angle", USER_ID);
    expect(r.new_prompt).toBe("New cinematic angle");
  });

  it("truncates current_prompt_preview to 120 chars", () => {
    const longPrompt = "A".repeat(200);
    const clip = makeClip({ prompt: longPrompt });
    const r = simulateRegenerateClip(proj, 0, clip, 100, null, USER_ID);
    expect((r.current_prompt_preview as string).length).toBe(120);
  });

  it("blocks when credits insufficient", () => {
    const clip = makeClip({ shot_index: 6 });
    const r = simulateRegenerateClip(proj, 6, clip, 10, null, USER_ID);
    expect(r.action).toBe("insufficient_credits");
    expect(r.required).toBe(15);
    expect(r.available).toBe(10);
    expect(r.message).toContain("/pricing");
  });

  it("uses extended pricing when project clip_duration > 6", () => {
    const longDurProj = makeProject({ clip_duration: 8, clip_count: 12 });
    const clip = makeClip({ shot_index: 0 });
    const r = simulateRegenerateClip(longDurProj, 0, clip, 100, null, USER_ID);
    expect(r.estimated_credits).toBe(15); // index 0 but duration > 6
  });

  it("rejects missing clip", () => {
    expect(simulateRegenerateClip(proj, 99, null, 100, null, USER_ID).error).toContain("No clip found");
  });

  it("rejects unowned project", () => {
    const r = simulateRegenerateClip(makeProject({ user_id: OTHER_USER }), 0, makeClip(), 100, null, USER_ID);
    expect(r.error).toContain("access denied");
  });
});

describe("Reorder Clips", () => {
  it("allows reordering in draft projects", () => {
    const r = simulateReorderClips(makeProject({ status: "draft" }), [{ clip_id: "c1", new_index: 1 }], USER_ID);
    expect(r.message).toContain("reordered");
    expect(r.reordered).toBe(1);
  });

  it("allows reordering in completed projects", () => {
    const r = simulateReorderClips(makeProject({ status: "completed" }), [{ clip_id: "c1", new_index: 0 }], USER_ID);
    expect(r.message).toContain("reordered");
  });

  it.each(["generating", "processing", "stitching", "failed"])(
    "blocks reordering in %s projects", (status) => {
      const r = simulateReorderClips(makeProject({ status }), [{ clip_id: "c1", new_index: 0 }], USER_ID);
      expect(r.error).toContain("draft or completed");
    }
  );

  it("rejects empty clip_order", () => {
    const r = simulateReorderClips(makeProject(), [], USER_ID);
    expect(r.error).toContain("No clip order");
  });

  it("rejects null clip_order", () => {
    const r = simulateReorderClips(makeProject(), null as any, USER_ID);
    expect(r.error).toContain("No clip order");
  });

  it("handles multiple clips", () => {
    const order = Array.from({ length: 20 }, (_, i) => ({ clip_id: `c${i}`, new_index: 19 - i }));
    const r = simulateReorderClips(makeProject(), order, USER_ID);
    expect(r.reordered).toBe(20);
  });
});

describe("Delete Clip", () => {
  it("deletes from draft project", () => {
    const r = simulateDeleteClip(makeClip({ shot_index: 2 }), makeProject({ status: "draft" }), USER_ID);
    expect(r.message).toContain("Clip #3 deleted");
  });

  it("rejects from completed project", () => {
    const r = simulateDeleteClip(makeClip(), makeProject({ status: "completed" }), USER_ID);
    expect(r.error).toContain("draft projects");
  });

  it("rejects missing clip", () => {
    expect(simulateDeleteClip(null, makeProject(), USER_ID).error).toBe("Clip not found");
  });

  it("rejects unauthorized", () => {
    expect(simulateDeleteClip(makeClip(), makeProject({ user_id: OTHER_USER }), USER_ID).error).toBe("Access denied");
  });
});


// ═══════════════════════════════════════════════
// §6  Video Editor & Post-Production
// ═══════════════════════════════════════════════

describe("Open Video Editor", () => {
  it("navigates for completed project", () => {
    const r = simulateOpenVideoEditor(makeProject({ status: "completed", video_url: "https://x.mp4" }), USER_ID);
    expect(r.action).toBe("navigate");
    expect(r.path).toBe("/video-editor?project=proj-1");
    expect(r.reason).toContain("Test Project");
  });

  it("navigates when status is completed even without video_url", () => {
    const r = simulateOpenVideoEditor(makeProject({ status: "completed", video_url: null }), USER_ID);
    expect(r.action).toBe("navigate");
  });

  it("navigates when video_url exists regardless of status", () => {
    const r = simulateOpenVideoEditor(makeProject({ status: "draft", video_url: "https://x.mp4" }), USER_ID);
    expect(r.action).toBe("navigate");
  });

  it("rejects draft without video_url", () => {
    const r = simulateOpenVideoEditor(makeProject({ status: "draft", video_url: null }), USER_ID);
    expect(r.error).toContain("completed first");
  });

  it("rejects generating without video_url", () => {
    const r = simulateOpenVideoEditor(makeProject({ status: "generating", video_url: null }), USER_ID);
    expect(r.error).toContain("completed first");
  });

  it("rejects missing project", () => {
    expect(simulateOpenVideoEditor(null, USER_ID).error).toBe("Project not found");
  });
});

describe("Add Music to Project", () => {
  it("navigates with encoded track name and volume", () => {
    const proj = makeProject({ status: "completed" });
    const r = simulateAddMusic(proj, "Epic Rise", 80, USER_ID);
    expect(r.action).toBe("navigate");
    expect(r.path).toContain("addMusic=Epic%20Rise");
    expect(r.path).toContain("volume=80");
    expect(r.message).toContain("🎵");
  });

  it("defaults track name and volume", () => {
    const proj = makeProject({ status: "completed" });
    const r = simulateAddMusic(proj, "", 0, USER_ID);
    expect(r.path).toContain("addMusic=cinematic");
    expect(r.path).toContain("volume=70");
  });

  it("rejects non-completed project with specific message", () => {
    const r = simulateAddMusic(makeProject({ status: "draft" }), "x", 50, USER_ID);
    expect(r.error).toContain("completed before adding music");
    expect(r.error).toContain("Video Editor");
  });

  it.each(["draft", "generating", "processing", "failed"])(
    "rejects %s project", (status) => {
      expect(simulateAddMusic(makeProject({ status }), "x", 50, USER_ID).error).toContain("completed");
    }
  );
});

describe("Apply Video Effect", () => {
  it("navigates with effect and intensity", () => {
    const proj = makeProject({ status: "completed" });
    const r = simulateApplyEffect(proj, "vintage", 75, USER_ID);
    expect(r.path).toContain("effect=vintage");
    expect(r.path).toContain("intensity=75");
    expect(r.message).toContain("vintage");
  });

  it("defaults intensity to 50", () => {
    const proj = makeProject({ status: "completed" });
    const r = simulateApplyEffect(proj, "glitch", 0, USER_ID);
    expect(r.path).toContain("intensity=50");
  });

  it("rejects non-completed", () => {
    expect(simulateApplyEffect(makeProject({ status: "generating" }), "x", 50, USER_ID).error).toContain("completed");
  });

  it("handles various effect names", () => {
    const effects = ["vintage", "glitch", "cinematic-lut", "noir", "vhs", "neon", "film-grain"];
    const proj = makeProject({ status: "completed" });
    effects.forEach(fx => {
      const r = simulateApplyEffect(proj, fx, 50, USER_ID);
      expect(r.path).toContain(`effect=${fx}`);
    });
  });
});


// ═══════════════════════════════════════════════
// §7  Music Library
// ═══════════════════════════════════════════════

describe("Music Library", () => {
  it("returns all genres when no filter", () => {
    const r = simulateGetMusicLibrary();
    expect(r.genres).toHaveLength(6);
    expect(r.total_tracks).toBe(30);
    expect((r.sample as any[]).length).toBe(6);
  });

  it("filters by specific genre", () => {
    const r = simulateGetMusicLibrary("cinematic");
    expect(r.genre).toBe("cinematic");
    expect(r.total).toBe(5);
    expect((r.tracks as any[])[0].name).toBe("Epic Rise");
  });

  it("genre filter is case-insensitive", () => {
    const r = simulateGetMusicLibrary("CINEMATIC");
    expect(r.genre).toBe("cinematic");
  });

  it("returns browse view for unknown genre", () => {
    const r = simulateGetMusicLibrary("jazz");
    expect(r.genres).toBeDefined(); // falls through to browse
    expect(r.genre).toBeUndefined();
  });

  it("each genre has exactly 5 tracks", () => {
    Object.entries(MUSIC_GENRES).forEach(([genre, tracks]) => {
      expect(tracks).toHaveLength(5);
      const r = simulateGetMusicLibrary(genre);
      expect(r.total).toBe(5);
    });
  });

  it("no duplicate track names across all genres", () => {
    const all = Object.values(MUSIC_GENRES).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it("hip-hop genre accessible with hyphen", () => {
    const r = simulateGetMusicLibrary("hip-hop");
    expect(r.genre).toBe("hip-hop");
    expect(r.total).toBe(5);
  });

  it("sample tracks use first track from each genre", () => {
    const r = simulateGetMusicLibrary();
    const samples = r.sample as Array<{ genre: string; sample_track: string }>;
    samples.forEach(s => {
      expect(s.sample_track).toBe(MUSIC_GENRES[s.genre][0]);
    });
  });
});


// ═══════════════════════════════════════════════
// §8  Script Data Shape (get_project_script_data)
// ═══════════════════════════════════════════════

interface ScriptDataResponse {
  project: {
    id: string; title: string; master_prompt: string; status: string;
    mode: string; aspect_ratio: string; clip_count: number; clip_duration: number;
    quality_tier: string | null; pipeline_stage: string | null; music_prompt: string | null;
  };
  clips: Array<{
    id: string; index: number; full_prompt: string; status: string;
    video_url: string | null; last_frame_url: string | null; duration_seconds: number | null;
    quality_score: number | null; error: string | null; retries: number;
    has_motion_vectors: boolean; created_at: string; completed_at: string | null;
  }>;
  voice_assignments: Array<{ character_name: string; voice_id: string }>;
  credit_phases: Array<{ shot_id: string; phase: string; credits_amount: number }>;
  pending_video_tasks: unknown;
  pipeline_context: { stage: string; progress: number; currentClipIndex: number; totalClips: number; failedClips: number } | null;
  generation_checkpoint: unknown;
  total_clips: number;
  completed_clips: number;
  failed_clips: number;
  pending_clips: number;
}

function mockScriptData(clipCount: number, statuses: string[], motionVectorIndices: number[] = []): ScriptDataResponse {
  const clips = Array.from({ length: clipCount }, (_, i) => ({
    id: `clip-${i}`,
    index: i,
    full_prompt: `Shot ${i}: Cinematic test prompt for clip ${i}`,
    status: statuses[i] || "pending",
    video_url: statuses[i] === "completed" ? `https://cdn.example.com/clip-${i}.mp4` : null,
    last_frame_url: statuses[i] === "completed" ? `https://cdn.example.com/frame-${i}.jpg` : null,
    duration_seconds: statuses[i] === "completed" ? 5 : null,
    quality_score: statuses[i] === "completed" ? 0.85 : null,
    error: statuses[i] === "failed" ? "Generation timeout" : null,
    retries: statuses[i] === "failed" ? 1 : 0,
    has_motion_vectors: motionVectorIndices.includes(i),
    created_at: "2025-01-01T00:00:00Z",
    completed_at: statuses[i] === "completed" ? "2025-01-01T00:05:00Z" : null,
  }));

  return {
    project: {
      id: "proj-1", title: "Test Film", master_prompt: "A cinematic masterpiece",
      status: "generating", mode: "text-to-video", aspect_ratio: "16:9",
      clip_count: clipCount, clip_duration: 5,
      quality_tier: "standard", pipeline_stage: "generating", music_prompt: null,
    },
    clips,
    voice_assignments: [],
    credit_phases: [],
    pending_video_tasks: null,
    pipeline_context: null,
    generation_checkpoint: null,
    total_clips: clipCount,
    completed_clips: clips.filter(c => c.status === "completed").length,
    failed_clips: clips.filter(c => c.status === "failed").length,
    pending_clips: clips.filter(c => c.status === "pending").length,
  };
}

describe("Script Data — Response Shape & Content", () => {
  it("1-clip completed project", () => {
    const data = mockScriptData(1, ["completed"]);
    expect(data.total_clips).toBe(1);
    expect(data.completed_clips).toBe(1);
    expect(data.clips[0].video_url).toBeTruthy();
    expect(data.clips[0].quality_score).toBe(0.85);
    expect(data.clips[0].error).toBeNull();
  });

  it("20-clip all pending project", () => {
    const data = mockScriptData(20, []);
    expect(data.total_clips).toBe(20);
    expect(data.pending_clips).toBe(20);
    expect(data.completed_clips).toBe(0);
    expect(data.failed_clips).toBe(0);
    data.clips.forEach(c => {
      expect(c.video_url).toBeNull();
      expect(c.completed_at).toBeNull();
    });
  });

  it("mixed status project with accurate counts", () => {
    const statuses = ["completed", "completed", "failed", "completed", "pending", "completed", "completed", "failed", "pending", "pending", "completed", "completed"];
    const data = mockScriptData(12, statuses);
    expect(data.completed_clips).toBe(7);
    expect(data.failed_clips).toBe(2);
    expect(data.pending_clips).toBe(3);
    expect(data.total_clips).toBe(12);
  });

  it("clips have sequential indices starting from 0", () => {
    const data = mockScriptData(15, []);
    data.clips.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.id).toBe(`clip-${i}`);
    });
  });

  it("failed clips have error messages and retries > 0", () => {
    const data = mockScriptData(3, ["completed", "failed", "pending"]);
    expect(data.clips[1].error).toBe("Generation timeout");
    expect(data.clips[1].retries).toBe(1);
    expect(data.clips[0].error).toBeNull();
    expect(data.clips[0].retries).toBe(0);
  });

  it("completed clips have video_url, last_frame_url, duration, quality_score, completed_at", () => {
    const data = mockScriptData(1, ["completed"]);
    const c = data.clips[0];
    expect(c.video_url).toContain(".mp4");
    expect(c.last_frame_url).toContain(".jpg");
    expect(c.duration_seconds).toBe(5);
    expect(c.quality_score).toBe(0.85);
    expect(c.completed_at).toBeTruthy();
  });

  it("motion_vectors flag correctly set", () => {
    const data = mockScriptData(5, Array(5).fill("completed"), [1, 3]);
    expect(data.clips[0].has_motion_vectors).toBe(false);
    expect(data.clips[1].has_motion_vectors).toBe(true);
    expect(data.clips[2].has_motion_vectors).toBe(false);
    expect(data.clips[3].has_motion_vectors).toBe(true);
    expect(data.clips[4].has_motion_vectors).toBe(false);
  });

  it("project metadata fields present", () => {
    const data = mockScriptData(6, []);
    expect(data.project.mode).toBe("text-to-video");
    expect(data.project.aspect_ratio).toBe("16:9");
    expect(data.project.quality_tier).toBe("standard");
    expect(data.project.pipeline_stage).toBe("generating");
    expect(data.project.master_prompt).toBeTruthy();
  });
});


// ═══════════════════════════════════════════════
// §9  Access Control Patterns
// ═══════════════════════════════════════════════

describe("Access Control — All Tools Reject Unauthorized Access", () => {
  const otherProj = makeProject({ user_id: OTHER_USER });
  const otherClip = makeClip({ project_id: otherProj.id });

  it("rename rejects other user's project", () => {
    expect(simulateRenameProject(otherProj, "x", USER_ID).error).toBeTruthy();
  });

  it("delete rejects other user's project", () => {
    expect(simulateDeleteProject(otherProj, USER_ID).error).toBeTruthy();
  });

  it("duplicate rejects other user's project", () => {
    expect(simulateDuplicateProject(otherProj, null, USER_ID).error).toBeTruthy();
  });

  it("trigger_generation rejects other user's project", () => {
    expect(simulateTriggerGeneration(otherProj, 999, USER_ID).error).toBeTruthy();
  });

  it("open_video_editor rejects other user's project", () => {
    expect(simulateOpenVideoEditor(otherProj, USER_ID).error).toBeTruthy();
  });

  it("update_clip_prompt rejects other user's project", () => {
    expect(simulateUpdateClipPrompt(otherClip, otherProj, "x", USER_ID).error).toBeTruthy();
  });

  it("retry_failed_clip rejects other user's project", () => {
    expect(simulateRetryFailedClip(makeClip({ status: "failed" }), otherProj, USER_ID).error).toBeTruthy();
  });

  it("regenerate_clip rejects other user's project", () => {
    expect(simulateRegenerateClip(otherProj, 0, otherClip, 999, null, USER_ID).error).toBeTruthy();
  });

  it("reorder_clips rejects other user's project", () => {
    expect(simulateReorderClips(otherProj, [{ clip_id: "c1", new_index: 0 }], USER_ID).error).toBeTruthy();
  });

  it("delete_clip rejects other user's project", () => {
    expect(simulateDeleteClip(otherClip, otherProj, USER_ID).error).toBeTruthy();
  });

  it("add_music rejects other user's project", () => {
    expect(simulateAddMusic(otherProj, "x", 50, USER_ID).error).toBeTruthy();
  });

  it("apply_effect rejects other user's project", () => {
    expect(simulateApplyEffect(otherProj, "x", 50, USER_ID).error).toBeTruthy();
  });
});


// ═══════════════════════════════════════════════
// §10  Full Lifecycle — Every Clip Count
// ═══════════════════════════════════════════════

describe("Full Production Lifecycle — 1 to 20 Clips", () => {
  const clipCounts = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 16, 20];

  clipCounts.forEach(cc => {
    it(`complete lifecycle for ${cc}-clip project`, () => {
      // 1. Create project
      const created = simulateCreateProject({ title: `Film ${cc}`, clip_count: cc }, USER_ID);
      expect(created.action).toBe("project_created");

      // 2. Trigger generation (verify credit math)
      const est = estimateCredits(cc);
      const proj = makeProject({ clip_count: cc, title: `Film ${cc}` });
      const gen = simulateTriggerGeneration(proj, est + 100, USER_ID);
      expect(gen.action).toBe("confirm_generation");
      expect(gen.estimated_credits).toBe(est);
      expect(gen.clip_count).toBe(cc);
      expect((gen.balance_after as number)).toBe(100);

      // 3. Verify script data shape during generation
      const allPending = mockScriptData(cc, []);
      expect(allPending.total_clips).toBe(cc);
      expect(allPending.pending_clips).toBe(cc);

      // 4. Simulate completion
      const allDone = mockScriptData(cc, Array(cc).fill("completed"));
      expect(allDone.completed_clips).toBe(cc);
      expect(allDone.failed_clips).toBe(0);

      // 5. Regenerate a clip from each tier
      const baseClipIdx = Math.min(3, cc - 1);
      const baseClip = makeClip({ shot_index: baseClipIdx });
      const regen1 = simulateRegenerateClip(proj, baseClipIdx, baseClip, 100, "Better angle", USER_ID);
      expect(regen1.action).toBe("confirm_regenerate_clip");
      expect(regen1.estimated_credits).toBe(baseClipIdx >= 6 ? 15 : 10);

      if (cc > 6) {
        const extClipIdx = Math.min(8, cc - 1);
        const extClip = makeClip({ shot_index: extClipIdx });
        const regen2 = simulateRegenerateClip(proj, extClipIdx, extClip, 100, null, USER_ID);
        expect(regen2.estimated_credits).toBe(15);
      }

      // 6. Open editor
      const completedProj = makeProject({ status: "completed", video_url: "https://x.mp4", clip_count: cc });
      const editor = simulateOpenVideoEditor(completedProj, USER_ID);
      expect(editor.action).toBe("navigate");
      expect(editor.path).toContain("/video-editor");

      // 7. Add music
      const music = simulateAddMusic(completedProj, "Epic Rise", 70, USER_ID);
      expect(music.action).toBe("navigate");
      expect(music.path).toContain("addMusic");

      // 8. Apply effect
      const effect = simulateApplyEffect(completedProj, "cinematic-lut", 60, USER_ID);
      expect(effect.path).toContain("effect=cinematic-lut");
      expect(effect.path).toContain("intensity=60");

      // 9. Reorder clips
      const reorder = simulateReorderClips(completedProj, [{ clip_id: "c0", new_index: cc - 1 }], USER_ID);
      expect(reorder.message).toContain("reordered");

      // 10. Browse music library
      const lib = simulateGetMusicLibrary("cinematic");
      expect(lib.total).toBe(5);
    });
  });
});


// ═══════════════════════════════════════════════
// §11  Edge Cases & Boundary Conditions
// ═══════════════════════════════════════════════

describe("Edge Cases", () => {
  it("0-credit balance blocks all generation", () => {
    const r = simulateTriggerGeneration(makeProject({ clip_count: 1 }), 0, USER_ID);
    expect(r.action).toBe("insufficient_credits");
  });

  it("negative balance blocks generation", () => {
    const r = simulateTriggerGeneration(makeProject({ clip_count: 1 }), -10, USER_ID);
    expect(r.action).toBe("insufficient_credits");
  });

  it("URL-encodes special characters in music track names", () => {
    const proj = makeProject({ status: "completed" });
    const r = simulateAddMusic(proj, "Track & Roll (feat. DJ)", 50, USER_ID);
    expect(r.path).toContain(encodeURIComponent("Track & Roll (feat. DJ)"));
  });

  it("prompt preview handles empty/null prompt gracefully", () => {
    const clip = makeClip({ prompt: "" });
    const proj = makeProject();
    const r = simulateRegenerateClip(proj, 0, clip, 100, null, USER_ID);
    expect(r.current_prompt_preview).toBe("");
  });

  it("retry_count correctly handles null/undefined as 0", () => {
    const clip = makeClip({ status: "failed", retry_count: undefined as any });
    const r = simulateRetryFailedClip(clip, makeProject(), USER_ID);
    // (undefined || 0) + 1 = 1
    expect(r.retry_count).toBe(1);
  });

  it("script data handles all-failed project", () => {
    const data = mockScriptData(10, Array(10).fill("failed"));
    expect(data.failed_clips).toBe(10);
    expect(data.completed_clips).toBe(0);
    expect(data.pending_clips).toBe(0);
    data.clips.forEach(c => {
      expect(c.error).toBeTruthy();
      expect(c.video_url).toBeNull();
    });
  });

  it("script data handles single-clip project with every field", () => {
    const data = mockScriptData(1, ["completed"], [0]);
    const c = data.clips[0];
    expect(c.index).toBe(0);
    expect(c.has_motion_vectors).toBe(true);
    expect(c.video_url).toBeTruthy();
    expect(c.last_frame_url).toBeTruthy();
    expect(c.completed_at).toBeTruthy();
    expect(c.error).toBeNull();
    expect(c.retries).toBe(0);
  });

  it("delete_clip message uses 1-indexed shot number", () => {
    const r = simulateDeleteClip(makeClip({ shot_index: 0 }), makeProject(), USER_ID);
    expect(r.message).toContain("Clip #1");

    const r2 = simulateDeleteClip(makeClip({ shot_index: 19 }), makeProject(), USER_ID);
    expect(r2.message).toContain("Clip #20");
  });

  it("large clip count (max 20) full credit calculation", () => {
    // 6 × 10 + 14 × 15 = 60 + 210 = 270
    expect(estimateCredits(20, 5)).toBe(270);
    // All extended: 20 × 15 = 300
    expect(estimateCredits(20, 10)).toBe(300);
  });

  it("clamp preserves valid clip counts exactly", () => {
    for (let i = 1; i <= 20; i++) {
      expect(clampClipCount(i)).toBe(i);
    }
  });
});
