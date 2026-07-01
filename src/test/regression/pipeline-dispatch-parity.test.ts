/**
 * Pipeline unification — handler-dispatch parity gate.
 *
 * The normalizer (_shared/production-request.ts) is now the SINGLE source of
 * truth for which handler mode-router runs (resolveHandlerKey). This test proves
 * it reproduces the legacy `switch (mode)` selection EXACTLY for every real UI
 * mode × engine × breakout combination — the safety gate for the cutover.
 * If this passes, driving dispatch through the normalizer is behavior-identical.
 */

import { describe, it, expect } from "vitest";
import {
  buildProductionRequest,
  resolveHandlerKey,
  HANDLER_COLLAPSE,
  type HandlerKey,
} from "../../../supabase/functions/_shared/production-request";

// Mirror of the legacy mode-router switch selection (raw mode + raw videoEngine).
function legacyChoice(mode: string, videoEngine: string | undefined): HandlerKey {
  if (mode === "avatar") {
    return videoEngine === "seedance" ? "handleAvatarCinematicMode" : "handleAvatarDirectMode";
  }
  if (mode === "video-to-video") return "handleStyleTransferMode";
  if (mode === "motion-transfer") return "handleMotionTransferMode";
  return "handleCinematicMode"; // text-to-video | image-to-video | b-roll | default
}

// The exact UI mode strings the create surfaces send (the switch's cases).
const UI_MODES = [
  "text-to-video",
  "image-to-video",
  "b-roll",
  "avatar",
  "video-to-video",
  "motion-transfer",
];
const ENGINES: Array<string | undefined> = [undefined, "kling", "seedance", "veo", "wan", "sora", "runway"];
const BREAKOUT = [false, true];

describe("mode-router dispatch parity — normalizer == legacy switch", () => {
  for (const mode of UI_MODES) {
    for (const videoEngine of ENGINES) {
      for (const isBreakout of BREAKOUT) {
        it(`mode=${mode} engine=${videoEngine ?? "none"} breakout=${isBreakout}`, () => {
          const pr = buildProductionRequest({
            mode,
            videoEngine,
            isBreakout,
            isAvatarMode: mode === "avatar",
          });
          expect(resolveHandlerKey(pr)).toBe(legacyChoice(mode, videoEngine));
        });
      }
    }
  }

  it("resolveHandlerKey only ever returns keys that exist in HANDLER_COLLAPSE", () => {
    const keys = new Set<HandlerKey>();
    for (const mode of [...UI_MODES, "stylize", "avatar-direct", "unknown-mode"]) {
      for (const videoEngine of ENGINES) {
        keys.add(resolveHandlerKey(buildProductionRequest({ mode, videoEngine, isAvatarMode: mode.includes("avatar") })));
      }
    }
    for (const k of keys) expect(HANDLER_COLLAPSE[k]).toBeTruthy();
  });

  it("covers all 5 collapsed handlers across the mode space", () => {
    const produced = new Set<HandlerKey>();
    for (const mode of UI_MODES) for (const e of ENGINES) {
      produced.add(resolveHandlerKey(buildProductionRequest({ mode, videoEngine: e, isAvatarMode: mode === "avatar" })));
    }
    expect(produced.has("handleCinematicMode")).toBe(true);
    expect(produced.has("handleAvatarCinematicMode")).toBe(true);
    expect(produced.has("handleAvatarDirectMode")).toBe(true);
    expect(produced.has("handleStyleTransferMode")).toBe(true);
    expect(produced.has("handleMotionTransferMode")).toBe(true);
  });
});
