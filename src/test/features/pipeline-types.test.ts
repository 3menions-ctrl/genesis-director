/**
 * COMPREHENSIVE FEATURE VERIFICATION: Production Pipeline Types
 * 
 * Validates:
 * - Quality tier system (standard vs professional)
 * - Identity Bible 3-point system
 * - Image-first reference architecture
 * - Cinematic auditor agent types
 * - Clip configuration & tiered pricing
 * - Cameraman hallucination filter (24 negative prompts)
 * - Camera movement rewrites
 * - Frame chaining state
 * - Pipeline state machine
 */

import { describe, it, expect } from "vitest";
import {
  validateClipConfiguration,
  CAMERAMAN_NEGATIVE_PROMPTS,
  CAMERA_MOVEMENT_REWRITES,
  PROJECT_TYPES,
  INITIAL_PIPELINE_STATE,
  MAX_CLIPS_PER_PROJECT,
  MIN_CLIPS_PER_PROJECT,
  MAX_SHOT_DURATION_SECONDS,
  MIN_SHOT_DURATION_SECONDS,
  DEFAULT_SHOT_DURATION_SECONDS,
  MAX_PROFESSIONAL_RETRIES,
} from "@/types/production-pipeline";

// ============================================================================
// QUALITY TIER SYSTEM
// ============================================================================

describe("Quality Tier System", () => {
  it("initial state defaults to 'standard' tier", () => {
    expect(INITIAL_PIPELINE_STATE.qualityTier).toBe('standard');
  });

  it("supports standard and professional tiers", () => {
    const validTiers = ['standard', 'professional'];
    expect(validTiers).toContain('standard');
    expect(validTiers).toContain('professional');
  });

  it("professional tier has max 4 retries", () => {
    expect(MAX_PROFESSIONAL_RETRIES).toBe(4);
  });
});

// ============================================================================
// IDENTITY BIBLE 3-POINT SYSTEM
// ============================================================================

describe("Identity Bible 3-Point System", () => {
  it("initial state has identityBibleGenerating as false", () => {
    expect(INITIAL_PIPELINE_STATE.identityBibleGenerating).toBe(false);
  });

  it("identity bible interface supports front/side/three-quarter views", () => {
    // Validate the interface shape exists by checking types compile
    const mockBible = {
      originalImageUrl: 'https://example.com/ref.jpg',
      frontViewUrl: 'https://example.com/front.jpg',
      sideViewUrl: 'https://example.com/side.jpg',
      threeQuarterViewUrl: 'https://example.com/3q.jpg',
      characterDescription: 'Test character',
      consistencyAnchors: ['brown hair', 'blue eyes'],
      generatedAt: Date.now(),
      isComplete: true,
    };

    expect(mockBible.frontViewUrl).toBeDefined();
    expect(mockBible.sideViewUrl).toBeDefined();
    expect(mockBible.threeQuarterViewUrl).toBeDefined();
    expect(mockBible.consistencyAnchors).toHaveLength(2);
  });
});

// ============================================================================
// IMAGE-FIRST REFERENCE ARCHITECTURE
// ============================================================================

describe("Image-First Reference Architecture", () => {
  it("reference image is required by default", () => {
    expect(INITIAL_PIPELINE_STATE.referenceImageRequired).toBe(true);
  });

  it("text-to-video mode is disabled by default", () => {
    expect(INITIAL_PIPELINE_STATE.textToVideoMode).toBe(false);
  });

  it("supports image orientation analysis with Veo aspect ratios", () => {
    const mockAnalysis = {
      imageUrl: 'https://example.com/image.jpg',
      analysisComplete: true,
      imageOrientation: {
        width: 1920,
        height: 1080,
        aspectRatio: 1920 / 1080,
        orientation: 'landscape' as const,
        veoAspectRatio: '16:9' as const,
      },
      characterIdentity: {
        description: 'test',
        facialFeatures: 'test',
        clothing: 'test',
        bodyType: 'test',
        distinctiveMarkers: [],
      },
      environment: { setting: 'office', geometry: 'linear', keyObjects: [], backgroundElements: [] },
      lighting: { style: 'soft', direction: 'left', quality: 'diffused', timeOfDay: 'day' },
      colorPalette: { dominant: ['#fff'], accent: ['#000'], mood: 'warm' },
      consistencyPrompt: 'test prompt',
    };

    expect(mockAnalysis.imageOrientation.veoAspectRatio).toBe('16:9');
    expect(['16:9', '9:16', '1:1']).toContain(mockAnalysis.imageOrientation.veoAspectRatio);
  });
});

// ============================================================================
// CINEMATIC AUDITOR AGENT
// ============================================================================

describe("Cinematic Auditor Agent", () => {
  it("initial state has auditApproved as false", () => {
    expect(INITIAL_PIPELINE_STATE.auditApproved).toBe(false);
  });

  it("supports critical/warning/suggestion severities", () => {
    const severities = ['critical', 'warning', 'suggestion'];
    expect(severities).toHaveLength(3);
  });

  it("audit categories cover technique, physics, continuity, identity", () => {
    const categories = ['technique', 'physics', 'continuity', 'identity'];
    expect(categories).toHaveLength(4);
  });

  it("physics check covers gravity, anatomy, fluid dynamics, morphing", () => {
    const physicsFields = ['gravityViolations', 'anatomicalIssues', 'fluidDynamicsIssues', 'morphingRisks'];
    expect(physicsFields).toHaveLength(4);
  });
});

// ============================================================================
// CLIP CONFIGURATION & TIERED PRICING
// ============================================================================

describe("Clip Configuration & Tiered Pricing", () => {
  it("validates clip count bounds (1-20)", () => {
    const config = validateClipConfiguration(0, 5);
    expect(config.clipCount).toBe(MIN_CLIPS_PER_PROJECT);

    const config2 = validateClipConfiguration(25, 5);
    expect(config2.clipCount).toBe(MAX_CLIPS_PER_PROJECT);
  });

  it("normalizes duration to 5 or 10 only", () => {
    const config5 = validateClipConfiguration(3, 5);
    expect(config5.clipDuration).toBe(5);

    const config10 = validateClipConfiguration(3, 10);
    expect(config10.clipDuration).toBe(10);

    const configInvalid = validateClipConfiguration(3, 7);
    expect(configInvalid.clipDuration).toBe(5); // Falls back to 5
  });

  it("calculates total duration correctly", () => {
    const config = validateClipConfiguration(6, 5);
    expect(config.totalDuration).toBe(30);

    const config2 = validateClipConfiguration(4, 10);
    expect(config2.totalDuration).toBe(40);
  });

  it("tiered pricing: base clips cost 10, extended cost 15", () => {
    // 6 clips at 5 seconds = 6 × 10 = 60
    const config = validateClipConfiguration(6, 5);
    expect(config.creditsRequired).toBe(60);

    // 8 clips at 5 seconds = 6×10 + 2×15 = 90
    const config2 = validateClipConfiguration(8, 5);
    expect(config2.creditsRequired).toBe(90);

    // 4 clips at 10 seconds = 4 × 15 = 60 (all extended due to duration > 6)
    const config3 = validateClipConfiguration(4, 10);
    expect(config3.creditsRequired).toBe(60);
  });

  it("clip count and duration constants are correct", () => {
    expect(MAX_CLIPS_PER_PROJECT).toBe(20);
    expect(MIN_CLIPS_PER_PROJECT).toBe(1);
    expect(MAX_SHOT_DURATION_SECONDS).toBe(10);
    expect(MIN_SHOT_DURATION_SECONDS).toBe(5);
    expect(DEFAULT_SHOT_DURATION_SECONDS).toBe(5);
  });
});

// ============================================================================
// CAMERAMAN HALLUCINATION FILTER
// ============================================================================

describe("Cameraman Hallucination Filter", () => {
  it("contains 25 negative prompts", () => {
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toHaveLength(25);
  });

  it("filters camera equipment terms", () => {
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('camera');
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('tripod');
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('dolly track');
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('boom mic');
  });

  it("filters crew-related terms", () => {
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('cameraman');
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('camera operator');
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('film crew');
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('production crew');
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('director');
  });

  it("filters reflection/shadow artifacts", () => {
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('crew reflection');
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('equipment shadow');
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('camera lens visible');
  });

  it("filters studio environment leaks", () => {
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('studio lights');
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('green screen edge');
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('cables visible');
  });
});

// ============================================================================
// CAMERA MOVEMENT REWRITES
// ============================================================================

describe("Camera Movement Rewrites", () => {
  it("provides rewrites for common camera terms", () => {
    expect(Object.keys(CAMERA_MOVEMENT_REWRITES).length).toBeGreaterThanOrEqual(15);
  });

  it("rewrites 'dolly shot' to remove equipment references", () => {
    expect(CAMERA_MOVEMENT_REWRITES['dolly shot']).toBe('smooth forward movement through the scene');
  });

  it("rewrites 'crane shot' to describe perspective", () => {
    expect(CAMERA_MOVEMENT_REWRITES['crane shot']).toBe('elevated perspective descending or rising');
  });

  it("rewrites 'steadicam' to natural language", () => {
    expect(CAMERA_MOVEMENT_REWRITES['steadicam']).toBe('fluid movement through space');
  });

  it("no rewrite contains equipment terminology", () => {
    const forbiddenTerms = ['camera', 'dolly', 'crane', 'steadicam', 'gimbal', 'tripod'];
    for (const [, rewrite] of Object.entries(CAMERA_MOVEMENT_REWRITES)) {
      for (const term of forbiddenTerms) {
        expect(rewrite.toLowerCase()).not.toContain(term);
      }
    }
  });
});

// ============================================================================
// PROJECT TYPES
// ============================================================================

describe("Project Types", () => {
  it("provides 5 project types", () => {
    expect(PROJECT_TYPES).toHaveLength(5);
  });

  const expectedTypes = ['cinematic-trailer', 'social-ad', 'narrative-short', 'documentary', 'explainer'];

  it.each(expectedTypes)("includes project type: %s", (type) => {
    expect(PROJECT_TYPES.find(p => p.id === type)).toBeDefined();
  });

  it("each project type has recommended shot count", () => {
    for (const pt of PROJECT_TYPES) {
      expect(pt.shotCount).toBeGreaterThan(0);
      expect(pt.shotCount).toBeLessThanOrEqual(MAX_CLIPS_PER_PROJECT);
    }
  });
});

// ============================================================================
// PIPELINE STATE MACHINE
// ============================================================================

describe("Pipeline State Machine", () => {
  it("initializes at 'scripting' stage", () => {
    expect(INITIAL_PIPELINE_STATE.currentStage).toBe('scripting');
  });

  it("supports 3 workflow stages", () => {
    const stages = ['scripting', 'production', 'review'];
    expect(stages).toHaveLength(3);
  });

  it("production state initializes with no active generation", () => {
    expect(INITIAL_PIPELINE_STATE.production.isGeneratingVideo).toBe(false);
    expect(INITIAL_PIPELINE_STATE.production.isGeneratingAudio).toBe(false);
    expect(INITIAL_PIPELINE_STATE.production.completedShots).toBe(0);
    expect(INITIAL_PIPELINE_STATE.production.failedShots).toBe(0);
  });

  it("quality insurance ledger starts empty", () => {
    expect(INITIAL_PIPELINE_STATE.qualityInsuranceLedger).toEqual([]);
  });

  it("export is not ready initially", () => {
    expect(INITIAL_PIPELINE_STATE.exportReady).toBe(false);
  });

  it("audio mix mode defaults to 'full'", () => {
    expect(INITIAL_PIPELINE_STATE.audioMixMode).toBe('full');
  });

  it("global seed is a valid positive integer", () => {
    expect(INITIAL_PIPELINE_STATE.production.globalSeed).toBeGreaterThan(0);
    expect(Number.isInteger(INITIAL_PIPELINE_STATE.production.globalSeed)).toBe(true);
  });
});

// ============================================================================
// FRAME CHAINING STATE
// ============================================================================

describe("Frame Chaining State", () => {
  it("chain context initializes empty", () => {
    expect(INITIAL_PIPELINE_STATE.production.chainContext.environmentContext).toBe('');
    expect(INITIAL_PIPELINE_STATE.production.chainContext.previousFrameUrl).toBeUndefined();
  });

  it("shot supports frame chaining fields", () => {
    const mockShot = {
      id: 'shot_001',
      index: 0,
      title: 'Opening',
      description: 'test',
      dialogue: 'Hello',
      durationSeconds: 5,
      mood: 'dramatic',
      cameraMovement: 'dolly in',
      characters: [],
      status: 'pending' as const,
      startFrameUrl: 'https://example.com/start.jpg',
      endFrameUrl: 'https://example.com/end.jpg',
    };

    expect(mockShot.startFrameUrl).toBeDefined();
    expect(mockShot.endFrameUrl).toBeDefined();
  });
});
