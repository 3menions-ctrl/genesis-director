# Editor audit, fixes & end-to-end test report

**Branch:** `editor-work` (not merged — for integration after the other agent finishes)
**Scope:** the editor only — `src/pages/Editor/**`, `src/components/editor/**`, `src/hooks/editor/**`, `src/lib/editor/**`. No other module touched.
**Date:** 2026-06-24

---

## 1. Summary

I audited every editor button, panel, tool, view and keyboard interaction end-to-end
(fan-out read of ~40 components + 10 hooks + ~30 lib files, cross-checked against the
store), fixed **10 real bugs / dead controls**, and added a headless Playwright suite
(`e2e/editor-controls.spec.ts`, **9 tests, all passing**) that drives every control
against the `/editor/demo` sandbox and asserts behaviour with a **zero console/page-error
budget**.

Validation (all green):

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | ✅ pass |
| `npm run build` (vite prod build) | ✅ pass |
| `vitest run` (full unit/integration suite) | ✅ **3550 passed**, 61 skipped, 0 failed |
| `e2e/editor-controls.spec.ts` (Playwright, headless) | ✅ **9/9 passed** |

Sandbox only — no live data, no live payment calls. The tests seed a **non-live** session
+ a mocked `get_my_profile` (localStorage + `page.route`), abort external demo media, and
intercept every Supabase HTTP call locally. A throwaway gitignored `.env.local` with dummy
Supabase values lets the app boot for the local dev server (the real key is never used).

---

## 2. Bugs fixed (each verified 3× line-by-line)

| # | Control / area | File | What was wrong | Fix |
|---|---|---|---|---|
| 1 | Multi-select **Delete**, **multicam Shift+1–9**, **Esc** modal-guard | `EditorShell.tsx` | The global `keydown` effect binds once (`[]` deps) and read **mount-time** snapshots of `selectedClipIds` (`[]`), `selectedClipId`/`project` (`null`) and the modal-open flags (`false`) — so multi-delete and multicam were permanently dead and Esc cleared the timeline selection even with a modal open. | Mirror the existing `switchViewRef` pattern: live refs (`selectedClipIdsRef`, `selectedClipIdRef`, `projectRef`, `modalsOpenRef`) written every render and read inside the handler. |
| 2 | Right-rail **"Regenerate clip · R"** tile | `EditorRightRail.tsx` | `onClick` called `setTab("inspector")`, but `setTab` lives on the parent `EditorRightRail` while the tile renders inside the module-level `ToolsPanel` → `ReferenceError: setTab is not defined`, crashing the handler before the synthetic `R` ever dispatched. | Threaded `onRequestInspector` into `ToolsPanel`; tile calls `onRequestInspector?.()`. |
| 3 | **Generate** button (Create panel) | `CreatePanel.tsx` | `disabled` included `isOnEmptyProject`, so on the empty NLE surface the primary CTA was dead — even though `submit()` has a dedicated branch that mints a draft project, and the Cmd/Ctrl+Enter path already worked. | Dropped `isOnEmptyProject` from `disabled`. |
| 4 | **Cast editor** rows | `CastEditor.tsx` | A `<button>` (Remove) was nested inside a `<button>` (the card) → `validateDOMNesting` error + unreliable clicks. | Outer card is now `div role="button"` with Enter/Space `onKeyDown`; inner Remove stays a real button. |
| 5 | **Cast add/remove** (and ALL document-store reactivity) | `document-store.ts` | Mutators edit `state`/`state.doc` **in place** and `getDocumentState()` returned the same object reference, so `useSyncExternalStore`'s `Object.is` bail-out skipped every re-render — add/remove a character did nothing on screen. | `notify()` now refreshes a shallow-copy `snapshot`; `getDocumentState()` returns it (stable between mutations, new ref per mutation). |
| 6 | **Redo** selection | `store.ts` | `redo()` restored the project but never pruned the selection (unlike `undo()`), leaving `selectedClipId`/`selectedClipIds` dangling at clips no longer present → Inspector off a non-existent clip. | Apply the same `stillExists` filter `undo()` uses. |
| 7 | **Comments** auto-scroll | `CommentsPanel.tsx` | Auto-scroll called `scrollTo` on a non-scrolling `listRef` div (the scroll container is the `SurfaceBody` parent) — a no-op, so new comments never scrolled into view. | Added a bottom anchor + `scrollIntoView` (walks to the real scroll parent). |
| 8 | Timeline **transition handles** | `Timeline.tsx` | `TransitionLayer` was positioned with a hardcoded `V_OVERLAY_HEIGHT + TRACK_GAP` (42px) that predated the V3 text track — handles floated 36px above the V1 clip boundaries (over V2). | `top={offsetOf("sys:V1")}` (computed, matches the V1 row). |
| 9 | Timeline **text-overlay click** | `Timeline.tsx` | `onSelect` did `selectClip(null); void id;` — clicking a text overlay threw the id away and cleared clip selection (a dead control). | Dispatch `editor:open-text-tab` (new listener in `EditorRightRail`) so the click focuses the Text tab, per the documented intent. |
| 10 | **Theater mode (Shift+T)** + program **scrub** a11y | `PlayerCanvas.tsx` | **Both** `EditorShell` and `PlayerCanvas` bound `Shift+T → toggleTheaterMode`, so in Stage view they double-toggled to a no-op — Shift+T appeared dead. Also the program scrub bar was a bare `<div>` click-target (no role, no keyboard). | Removed the duplicate `Shift+T` handler from `PlayerCanvas` (EditorShell owns the global shortcut, works in all views). Added `role="slider"` + `aria-valuenow` + ArrowLeft/Right keyboard scrubbing to the program scrub. |

### Investigated — NOT a live bug
- **`views/Stage.tsx` scrub bar** was flagged in the audit as a dead control, but `views/Stage.tsx`
  is **dead code — never imported/rendered**. The real program monitor is `PlayerCanvas`, whose scrub
  works (routes through `setPlayhead` + a pending-seek/Effect-B path). I reverted a speculative fix to
  the dead file and instead hardened the **live** scrub (#10).

---

## 3. Per-control test coverage (pass/fail)

All assertions run headless against `/editor/demo` with a **zero unexpected-error budget**.

### Modal panels — open via keyboard **and** close (16/16 ✅)
Command palette `⌘P`, Export `E`, Render queue `Q`, Markers `⇧M`, Effects `F`, Audio mixer `X`,
Comments `C`, Director `⌘/`, Studio library `⇧L`, Media library `⇧Y`, Create `N`, Budget `⌘B`,
Crossover VFX `⇧V`, Cast `⌘J`, Help `?` — **all open + close, PASS**.
Versions is verified via its TopStatusBar button instead (see note in §4).

### TopStatusBar buttons (7/7 ✅)
Add clip, Studio library, Media library, Director, **Versions**, Comments, Export — each click opens its dialog. **PASS**.

### View switching & theater (✅)
Keyboard `1/2/3/4` → `?tab=stage|timeline|script|storyboard`; ViewSwitcher chip clicks; **Shift+T theater** enter/exit. **PASS**.

### Right rail (✅)
Tabs Inspect / Tools / Text / Project / Library activate; **Title-at-playhead** tool inserts a title (toast); **Regenerate tile** (the ex-`ReferenceError`) switches to Inspector cleanly. **PASS**.

### Program monitor transport (✅)
Play/Pause toggles; **scrub click** advances the playhead (`aria-valuenow`); **ArrowRight** keyboard scrub. **PASS**.

### Editing keyboard map (✅)
`⌘A` select-all, `⌘C` copy, `⌘V` paste, `⌘D` duplicate, `⌘Z` undo, `⌘⇧Z` redo — each fires (toast). **Multi-select Delete** (the ex-dead stale-closure path) removes clips. **PASS**.

---

## 4. Notes for the integrating agent (cross-module — NOT changed)

These are outside the editor module and were left untouched:

1. **Global "Make Studio" command menu binds `/`.** Pressing `⌘/` in the editor correctly opens
   Director chat **and** that global menu opens too (two dialogs). The editor's own behaviour is
   correct; the collision is between the editor's `⌘/` and a global keybinding. Worth de-conflicting
   at the app level. (Tests use `?` for Help to avoid the `/` family.)
2. **`Ctrl/⌘+Shift+V` is browser-reserved** (paste-plain) and headless Chromium swallows it before
   the page — so the **Versions** keyboard shortcut can't be exercised headlessly. The Versions panel
   itself is fine and is covered via its TopStatusBar button. On a real browser the shortcut works.

## 5. How to run the tests

```bash
# 1. dummy sandbox env so the app boots (gitignored; values are NOT live)
cat > .env.local <<'EOF'
VITE_SUPABASE_PROJECT_ID="demo-sandbox"
VITE_SUPABASE_URL="https://demo-sandbox.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_demo_sandbox_key_not_real_0000000000"
EOF

# 2. start the dev server
npx vite --port 7777 --host 127.0.0.1 &

# 3. run the editor control suite headless
PLAYWRIGHT_BASE_URL=http://127.0.0.1:7777 npx playwright test e2e/editor-controls.spec.ts

# unit/integration + typecheck + build
npm run test && npm run typecheck && npm run build
```

The Playwright spec is self-contained: it seeds a non-live session, mocks `get_my_profile`,
aborts external demo media, and intercepts all Supabase HTTP — no real backend, no payments.
