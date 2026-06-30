/**
 * Editor demo critical path.
 *
 * `/editor/demo` hits the buildDemoProject() short-circuit in useProject
 * — no Supabase, no auth, no real video files. That makes it the one
 * editor route every CI run can hit deterministically, and it
 * exercises the same component tree (EditorShell, PlayerCanvas, Left/Right
 * rails, store hydration, route preloading) that gated user editor
 * sessions hit.
 *
 * The test:
 *   1. Loads /editor/demo.
 *   2. Waits for the demo project to hydrate (the store transitions
 *      from project=null → project!=null; we see this via at least
 *      one clip rendering in the UI).
 *   3. Collects console errors during a 5-second settle and asserts
 *      no UNEXPECTED ones surface (filtering known noisy patterns
 *      like the View-Transitions visibility warning).
 *   4. Captures a trace on failure so a regression includes the
 *      sequence the user would have seen.
 *
 * Sign-in-gated routes (profile, lobby, render queue) wait on a
 * test-user fixture that we add in Week 6 alongside the engine
 * contract tests.
 */

import { test, expect, type ConsoleMessage } from "@playwright/test";

// Patterns that show up in the console for reasons unrelated to the
// editor itself — third-party scripts, browser-internal warnings, the
// View Transitions visibility quirk we already addressed in code.
const IGNORED_PATTERNS: RegExp[] = [
  /ResizeObserver loop/i,
  /View transition was skipped/i,
  /Failed to load resource.*posthog/i,
  /Failed to load resource.*sentry/i,
  /web-vitals/i,
  /Download the React DevTools/i,
  // Environmental backend noise. In CI the app is built with a STUB Supabase
  // URL (stub.supabase.co) that doesn't resolve, so the realtime WebSocket and
  // best-effort fetches fail with ERR_NAME_NOT_RESOLVED. These are not editor
  // bugs — the demo route is fully synthetic and never needs the backend. (The
  // sibling editor-controls spec filters the same family. A real uncaught
  // handler error still surfaces as "is not defined"/TypeError and is unfiltered.)
  /WebSocket/i,
  /realtime/i,
  /supabase/i,
  /net::ERR_/i,
];

function isIgnorable(msg: ConsoleMessage): boolean {
  const text = msg.text();
  return IGNORED_PATTERNS.some((re) => re.test(text));
}

test.describe("Editor — demo project critical path", () => {
  test("loads, hydrates, and settles without unexpected console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      if (isIgnorable(msg)) return;
      errors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      // Uncaught exceptions count as errors regardless of type.
      errors.push(`pageerror: ${err.message}`);
    });

    await page.goto("/editor/demo");

    // The EditorShell renders the project title once useProject hydrates.
    // We wait on a stable selector that's part of the editor chrome —
    // not specific copy that might shift across redesigns.
    // Two fallbacks: the leftrail / right rail label, or any chip with
    // the word "Scene".
    await expect
      .poll(
        async () => {
          // Demo project ships scene "Scene 1" — exercise the broad
          // search rather than pinning to a specific node.
          const sceneCount = await page.locator("text=/Scene/i").count();
          return sceneCount;
        },
        { timeout: 15_000, message: "demo project never hydrated into the editor" },
      )
      .toBeGreaterThan(0);

    // Let the rest of the editor's idle-time work settle (effect
    // composition, audio chain init, web-vitals). 5s is generous.
    await page.waitForTimeout(5_000);

    // The console-error budget is zero (after filtering). If something
    // new fires here it deserves a triage.
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
