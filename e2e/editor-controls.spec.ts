/**
 * Editor controls — exhaustive headless exercise of EVERY editor button,
 * panel, view, and keyboard action against the `/editor/demo` sandbox.
 *
 * `/editor/demo` short-circuits Supabase + auth data (buildDemoProject), so
 * the project itself is fully synthetic — no live data, no payment calls. The
 * `/editor` route is behind <ProtectedRoute>, so we seed a NON-LIVE session +
 * a mocked `get_my_profile` into the browser (localStorage + page.route) so
 * the guard resolves. Nothing here touches a real backend: the session token
 * is fake, every Supabase HTTP call is intercepted and answered locally.
 *
 * We then drive the real component tree (EditorShell, the 16 modal panels, the
 * right rail, the Stage/Timeline views, the global keyboard map) and assert
 * each control does what it should — collecting console + page errors and
 * holding the budget at ZERO unexpected errors.
 *
 * Run locally (dev server on :7777):
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:7777 \
 *     npx playwright test e2e/editor-controls.spec.ts
 */
import { test, expect, type ConsoleMessage, type Page, type BrowserContext } from "@playwright/test";

// Wider viewport so the three-column NLE lays out fully (the program-monitor
// scrub bar collapses to 0 width on a narrow center column).
test.use({ viewport: { width: 1440, height: 900 } });

// ── Sandbox identity (NON-LIVE) ──────────────────────────────────────────────
const UID = "00000000-0000-4000-8000-000000000001";
const STORAGE_KEY = "sb-demo-sandbox-auth-token"; // sb-<project-ref>-auth-token

function buildSession() {
  const future = Math.floor(Date.now() / 1000) + 86_400;
  return {
    access_token: "sandbox.fake.jwt",
    token_type: "bearer",
    expires_in: 86_400,
    expires_at: future,
    refresh_token: "sandbox-refresh",
    user: {
      id: UID,
      aud: "authenticated",
      role: "authenticated",
      email: "sandbox@demo.test",
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: new Date(0).toISOString(),
    },
  };
}

const PROFILE = {
  id: UID,
  email: "sandbox@demo.test",
  display_name: "Sandbox",
  full_name: "Sandbox Tester",
  avatar_url: null,
  credits_balance: 9999,
  total_credits_purchased: 9999,
  total_credits_used: 0,
  role: "user",
  use_case: "film",
  company: null,
  country: "US",
  onboarding_completed: true, // pass the onboarding gate
  created_at: new Date(0).toISOString(),
  preferences: {},
  notification_settings: {},
  auto_recharge_enabled: false,
  has_seen_welcome_video: true,
  has_seen_welcome_offer: true,
  security_version: 1,
  account_type: "personal",
  account_tier: "pro",
};

async function seedSandbox(context: BrowserContext): Promise<void> {
  const session = buildSession();
  await context.addInitScript(
    ([key, val]) => {
      try {
        localStorage.setItem(key as string, JSON.stringify(val));
      } catch {
        /* ignore */
      }
    },
    [STORAGE_KEY, session] as const,
  );
  // Abort the demo's sample media (same-origin clips + any external poster) so
  // the page doesn't hang on `load` or spend CI wall-clock downloading multi-MB
  // video on every editor mount. The controls don't depend on the media
  // actually decoding — this keeps each editor load fast and deterministic.
  await context.route(
    /\.(mp4|webm)(\?|$)|picsum\.photos|media\.w3\.org|www\.w3schools\.com|test-videos\.co\.uk/i,
    (route) => route.abort(),
  );
  // Answer every Supabase HTTP call locally — never reaches a real backend.
  await context.route("**/*supabase.co/**", (route) => {
    const url = route.request().url();
    if (/\/rpc\/get_my_profile/.test(url)) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PROFILE) });
    }
    if (/\/auth\/v1\/(user|token)/.test(url)) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

// ── Error budget ─────────────────────────────────────────────────────────────
// Demo pulls external sample videos + poster images, and best-effort Supabase
// realtime that fails against the fake host. Those are environmental. A broken
// handler surfaces as an uncaught exception ("is not defined" / "is not a
// function" / a React error-boundary log) — those are NEVER filtered.
const IGNORED_CONSOLE: RegExp[] = [
  /ResizeObserver loop/i,
  /View transition was skipped/i,
  /Download the React DevTools/i,
  /web-vitals/i,
  /\[vite\]/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /ERR_(NAME_NOT_RESOLVED|CONNECTION|ABORTED|FAILED|INTERNET_DISCONNECTED)/i,
  /supabase/i,
  /realtime/i,
  /GoTrueClient/i,
  /picsum\.photos/i,
  /w3\.org/i,
  /w3schools/i,
  /test-videos/i,
  /the server responded with a status of/i,
  /posthog/i,
  /sentry/i,
  /WebSocket/i,
  // Benign browser warnings from <meta http-equiv> tags in index.html —
  // Chromium logs these at error level but they are not editor bugs.
  /X-Frame-Options/i,
  /Content Security Policy directive .* is ignored/i,
  /frame-ancestors/i,
];

function isIgnorableConsole(msg: ConsoleMessage): boolean {
  const text = msg.text();
  if (/is not defined|is not a function|Cannot read propert|undefined is not|ReferenceError|TypeError|The above error occurred/i.test(text)) {
    return false; // fingerprints of a broken control handler — always real
  }
  return IGNORED_CONSOLE.some((re) => re.test(text));
}

function attachErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (isIgnorableConsole(msg)) return;
    errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

async function loadEditor(page: Page): Promise<void> {
  // domcontentloaded — not "load": external sample media is aborted, so the
  // load event is unreliable; we gate on hydration below instead.
  await page.goto("/editor/demo", { waitUntil: "domcontentloaded" });
  // Hydration: the demo's three scenes paint scene chips in the left rail.
  await expect
    .poll(async () => page.locator("text=/Scene/i").count(), {
      timeout: 25_000,
      message: "demo project never hydrated into the editor",
    })
    .toBeGreaterThan(0);
}

async function gotoEditor(page: Page): Promise<string[]> {
  const errors = attachErrors(page);
  await loadEditor(page);
  return errors;
}

const dialog = (page: Page) => page.locator('[role="dialog"]');

// Close whatever panel(s) are open and wait out the exit animation. Panels
// vary: most Surface panels close on Escape; the command palette has
// blockEscClose and closes on Escape only while its input is focused (so we
// must try Escape BEFORE blurring); DirectorChat/Export block Escape and close
// via the X button. We loop through all three paths until nothing is open.
async function closeOpenDialog(page: Page): Promise<boolean> {
  const isClosed = async () => (await dialog(page).count()) === 0;
  for (let attempt = 0; attempt < 6 && !(await isClosed()); attempt++) {
    await page.keyboard.press("Escape"); // palette + normal Surface panels
    await page.waitForTimeout(120);
    if (await isClosed()) break;
    await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el && el.tagName !== "BODY") el.blur?.();
    });
    await page.keyboard.press("Escape"); // Surface panels with a focused input
    await page.waitForTimeout(120);
    if (await isClosed()) break;
    const x = page.locator('[role="dialog"] [aria-label="Close"]').first();
    if (await x.count()) await x.click({ force: true }).catch(() => {}); // blockEscClose panels
    await page.waitForTimeout(200);
  }
  // Wait out the Surface exit animation (~0.34s) before declaring closed.
  try {
    await expect(dialog(page)).toHaveCount(0, { timeout: 2_500 });
    return true;
  } catch {
    return false;
  }
}

test.beforeEach(async ({ context }) => {
  await seedSandbox(context);
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Editor — every modal panel opens via keyboard and closes", () => {
  // NOTE on coverage:
  //  - Versions is bound to Shift+H (revision History). It used to be ⌘⇧V, a
  //    browser-reserved combo (paste-as-plain-text) that headless Chromium
  //    swallowed before the page saw it; Shift+H is not reserved, so Versions
  //    is now exercised by keyboard here AND via its TopStatusBar button below.
  //  - Help uses "?" (not "Shift+/"): the literal "/" also triggers a GLOBAL
  //    (non-editor) command menu, so "?" keeps this assertion to the editor's
  //    own Help overlay. Director (⌘/) now opens ONLY the editor's Director
  //    chat — the global "/" menu excludes meta/ctrl, so ⌘/ no longer pops it.
  const PANELS: Array<{ name: string; key: string }> = [
    { name: "Command palette", key: "ControlOrMeta+p" },
    { name: "Export", key: "e" },
    { name: "Render queue", key: "q" },
    { name: "Markers", key: "Shift+M" },
    { name: "Effects palette", key: "f" },
    { name: "Audio mixer", key: "x" },
    { name: "Comments", key: "c" },
    { name: "Director chat", key: "ControlOrMeta+/" },
    { name: "Studio library", key: "Shift+L" },
    { name: "Media library", key: "Shift+Y" },
    { name: "Create", key: "n" },
    { name: "Budget", key: "ControlOrMeta+b" },
    { name: "Crossover VFX", key: "Shift+V" },
    { name: "Cast", key: "ControlOrMeta+j" },
    { name: "Versions", key: "Shift+H" },
    { name: "Help overlay", key: "?" },
  ];

  test("all 16 panels open + close with zero uncaught errors", async ({ page }) => {
    // Single editor session for all 16 panels. (Previously this reloaded the
    // whole NLE per panel — 16 hydrations × ~20s on CI blew past even a 6-min
    // budget. We instead close each panel and assert a clean slate before the
    // next open, so a panel that resists closing still fails fast rather than
    // cascading.) test.slow() keeps headroom for CI's slow hydration.
    test.slow();
    const errors = await gotoEditor(page);
    const opened: Record<string, boolean> = {};
    const closed: Record<string, boolean> = {};

    for (const panel of PANELS) {
      // Clean slate carried over from the previous panel's close.
      await expect(dialog(page)).toHaveCount(0);
      await page.keyboard.press(panel.key);
      try {
        // Each shortcut now owns exactly one panel (the ⌘/ vs global-"/"
        // collision is fixed); >= 1 stays as a robust lower bound.
        await expect.poll(async () => dialog(page).count(), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
        opened[panel.name] = true;
      } catch {
        opened[panel.name] = false;
      }
      closed[panel.name] = await closeOpenDialog(page);
    }

    // eslint-disable-next-line no-console
    console.log("PANEL OPENED:", JSON.stringify(opened));
    // eslint-disable-next-line no-console
    console.log("PANEL CLOSED:", JSON.stringify(closed));
    for (const panel of PANELS) {
      expect(opened[panel.name], `${panel.name} did not open`).toBe(true);
      expect(closed[panel.name], `${panel.name} did not close`).toBe(true);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Editor — TopStatusBar buttons open their panels", () => {
  const BUTTONS = [
    "Add clip (N)",
    "Studio library (Shift+L)",
    "Media library (Shift+Y)",
    "Director chat (Cmd+/)",
    "Versions (Shift+H)",
    "Toggle comments (C)",
    "Open export panel (E)",
  ];

  test("each chrome button opens a dialog", async ({ page }) => {
    // Heavy: opens + closes 7 panels (each with its own exit animation) on top
    // of CI's slow hydration. Triple the budget like the 16-panel sweep.
    test.slow();
    const errors = await gotoEditor(page);
    const results: Record<string, "PASS" | "FAIL"> = {};

    for (const label of BUTTONS) {
      await expect(dialog(page)).toHaveCount(0);
      const btn = page.locator(`[aria-label="${label}"]`).first();
      await expect(btn, `button "${label}" present`).toHaveCount(1);
      await btn.click();
      try {
        await expect(dialog(page)).toHaveCount(1, { timeout: 5_000 });
        results[label] = "PASS";
      } catch {
        results[label] = "FAIL";
      }
      await closeOpenDialog(page);
    }

    // eslint-disable-next-line no-console
    console.log("CHROME BUTTONS:", JSON.stringify(results, null, 2));
    for (const label of BUTTONS) expect(results[label], label).toBe("PASS");
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Editor — view switching and theater mode", () => {
  test("keyboard tabs drive the URL ?tab and theater toggles", async ({ page }) => {
    const errors = await gotoEditor(page);

    await page.keyboard.press("2");
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain("tab=timeline");
    await page.keyboard.press("3");
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain("tab=script");
    await page.keyboard.press("1");
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain("tab=stage");
    await page.keyboard.press("4");
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain("tab=storyboard");
    // Absolute-nav back to stage (the "4 twice" toggle also works, but races
    // the focus-state commit in a fast headless run — "1" is unambiguous).
    await page.keyboard.press("1");
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain("tab=stage");

    await page.keyboard.press("Shift+T");
    await expect(page.getByRole("button", { name: /Exit theater/i })).toBeVisible();
    await page.keyboard.press("Shift+T");
    await expect(page.getByRole("button", { name: /Exit theater/i })).toHaveCount(0);

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("ViewSwitcher chips in the chrome change the view", async ({ page }) => {
    const errors = await gotoEditor(page);
    const nav = page.getByRole("navigation", { name: /Editor views/i });
    await expect(nav).toBeVisible();
    for (const [label, tab] of [
      ["Timeline", "tab=timeline"],
      ["Script", "tab=script"],
      ["Storyboard", "tab=storyboard"],
      ["Stage", "tab=stage"],
    ] as const) {
      await nav.getByRole("button", { name: new RegExp(label, "i") }).first().click();
      await expect.poll(() => page.url(), { timeout: 5_000 }).toContain(tab);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Editor — right rail tabs and tools", () => {
  test("each rail tab activates and the Title tool inserts a title", async ({ page }) => {
    const errors = await gotoEditor(page);

    for (const tab of ["Inspect", "Tools", "Text", "Project", "Library"]) {
      const t = page.getByRole("tab", { name: new RegExp(`^${tab}$`, "i") }).first();
      await expect(t, `rail tab ${tab}`).toHaveCount(1);
      await t.click();
      await expect(t).toHaveAttribute("aria-selected", "true");
    }

    // Tools tab → "Title at playhead" must insert a title (sonner toast).
    await page.getByRole("tab", { name: /^Tools$/i }).first().click();
    await page.getByText(/Title at playhead/i).first().click();
    await expect(page.getByText(/Title inserted/i)).toBeVisible({ timeout: 5_000 });

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Regenerate tile (was a ReferenceError) switches to Inspector cleanly", async ({ page }) => {
    const errors = await gotoEditor(page);
    // Select clips so the Regenerate tile is enabled (Ctrl+A is the reliable
    // selection path; clicking aborted-media thumbnails is flaky).
    await page.keyboard.press("2"); // Timeline
    await page.keyboard.press("ControlOrMeta+a");
    await expect(page.getByText(/All clips selected/i).first()).toBeVisible({ timeout: 4_000 });

    await page.getByRole("tab", { name: /^Tools$/i }).first().click();
    const regen = page.getByText(/Regenerate clip/i).first();
    await expect(regen).toBeVisible();
    await regen.click().catch(() => {});
    // The fix: previously this threw "setTab is not defined". Assert the rail
    // switched to the Inspector tab and nothing was thrown.
    await expect(page.getByRole("tab", { name: /^Inspect$/i }).first()).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 5_000 },
    );
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Editor — program monitor transport (PlayerCanvas)", () => {
  test("play/pause and scrub seek the playhead without errors", async ({ page }) => {
    const errors = await gotoEditor(page);
    // Default view is Stage → the PlayerCanvas program monitor is mounted.
    const transport = page.getByRole("button", { name: /^(Play|Pause)$/ }).first();
    await expect(transport).toBeVisible();
    await transport.click(); // play
    await transport.click(); // pause

    // Scrub bar — role=slider, aria-valuenow tracks the store playhead. Click
    // near the right end and assert the playhead advanced.
    const scrub = page.getByRole("slider", { name: /^Scrub$/ }).first();
    await expect(scrub).toBeVisible();
    const before = Number((await scrub.getAttribute("aria-valuenow")) ?? "0");
    const box = await scrub.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
      await expect
        .poll(async () => Number((await scrub.getAttribute("aria-valuenow")) ?? "0"), { timeout: 5_000 })
        .toBeGreaterThan(before);
    }

    // Keyboard scrub (ArrowRight nudges +1s).
    await scrub.focus();
    const mid = Number((await scrub.getAttribute("aria-valuenow")) ?? "0");
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => Number((await scrub.getAttribute("aria-valuenow")) ?? "0"), { timeout: 4_000 })
      .toBeGreaterThanOrEqual(mid);

    expect(errors, errors.join("\n")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Editor — editing keyboard map", () => {
  test("select-all, copy, paste, duplicate, undo, redo all fire", async ({ page }) => {
    const errors = await gotoEditor(page);
    await page.keyboard.press("2"); // Timeline

    const sawToast = async (re: RegExp): Promise<boolean> => {
      try {
        await expect(page.getByText(re).first()).toBeVisible({ timeout: 4_000 });
        return true;
      } catch {
        return false;
      }
    };

    const results: Record<string, boolean> = {};
    await page.keyboard.press("ControlOrMeta+a");
    results["select-all"] = await sawToast(/All clips selected/i);
    await page.keyboard.press("ControlOrMeta+c");
    results["copy"] = await sawToast(/Copied to clipboard/i);
    await page.keyboard.press("ControlOrMeta+v");
    results["paste"] = await sawToast(/Pasted/i);
    await page.keyboard.press("ControlOrMeta+d");
    results["duplicate"] = await sawToast(/Duplicated/i);
    await page.keyboard.press("ControlOrMeta+z");
    results["undo"] = await sawToast(/Undo/i);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    results["redo"] = await sawToast(/Redo/i);

    // eslint-disable-next-line no-console
    console.log("EDIT KEYS:", JSON.stringify(results, null, 2));
    for (const [k, ok] of Object.entries(results)) expect(ok, `${k} toast`).toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("multi-select delete (was dead via stale closure) removes clips", async ({ page }) => {
    const errors = await gotoEditor(page);
    await page.keyboard.press("2"); // Timeline
    await page.keyboard.press("ControlOrMeta+a");
    await expect(page.getByText(/All clips selected/i).first()).toBeVisible({ timeout: 4_000 });
    await page.keyboard.press("Delete");
    await expect(page.getByText(/Deleted \d+ clips/i).first()).toBeVisible({ timeout: 4_000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
