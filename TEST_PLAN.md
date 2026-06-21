# Test plan — focused, high-leverage

**Goal:** dramatically reduce the kind of bugs we've actually been finding
(preview/bake divergence, ghost UI, orphan edge functions, silent data
drops, async race conditions) — NOT to maximize coverage percentages.

**Non-goals:** 100% coverage. Snapshot-testing every UI subtree. Mocking
everything. Test infrastructure that becomes its own maintenance project.

The smallest set of investments that catches the bugs we've been chasing.
Each phase is independently shippable — you should never have to wait
6 weeks before seeing benefit.

---

## What "tested" means here

For every editor feature, three layers of confidence:

1. **Unit:** the pure function compiles correctly for a given input.
2. **Contract:** the preview and the render compile equivalent output for
   the same property at sample times. (Preview/bake parity.)
3. **End-to-end:** a fixture project rendered through the actual
   stitcher produces a filter_complex that contains the right filters
   and matches expected invariants on the output bytes.

Layer 3 is the highest-leverage one and the one we don't have. Every
dead-wire from the verification audit would have been caught at layer 3.

---

## Week 1 — Foundation + diagnostic toolchain

**Deliverable:** the lint config catches whole categories of bug;
dead-code + duplication reports exist; we know the TS-strict blast
radius; the render-test harness is scaffolded with one fixture; the
first unit tests for store mutations exist.

- ESLint additions:
  - `@typescript-eslint/no-floating-promises: error` — catches every
    forgotten `await`. Surprisingly common in this codebase.
  - `react-hooks/exhaustive-deps: error` (currently warn) — catches
    stale closures.
  - `@typescript-eslint/no-unused-vars: warn` (currently off) — flags
    dead-code candidates without breaking the build.
  - import boundary rule (manual) — `lib/editor/*` cannot import from
    `pages/Editor/*`; `pages/Editor/*` cannot reach into other pages.
- `knip` for dead exports + unused files.
- `jscpd` for copy-paste duplication.
- TS strict audit: run with strict ON, count errors per flag
  (`strictNullChecks`, `noImplicitAny`, etc.), produce a per-flag
  ratchet plan. Don't flip strict on yet — that's a separate effort.
- Render-test harness skeleton:
  - `src/test/render-fixtures/` — JSON fixture projects.
  - `src/test/render/` — harness code that loads a fixture, calls
    `buildSeamlessCommand`, parses the filter_complex string, asserts
    invariants.
  - One fixture (`F01-title-clip.json`) proves the pattern.
- Store unit tests (8 mutators): `trimClip`, `splitAtPlayhead`,
  `moveClip`, `deleteClip`, `rollEdit`, `slipClip`, `slideClip`,
  `applyEffectToClips`. Each test asserts the resulting project
  state, the history stack, and that locked tracks are honored.

**Stop the bleeding:** by end of week 1, every new PR runs lint +
typecheck + the new tests in CI.

---

## Week 2 — Editor unit + integration core

**Deliverable:** every pure function in `src/lib/editor/` has unit
coverage. The most-trafficked hooks have integration tests. The
remaining store mutators are covered.

- Unit: `getClipPropertyAt` (keyframe interpolation, easing curves),
  `recompute` (timeline ripple), `applyEasing`, `compileClipColorFilter`
  (CSS preview compile), `gradeToFfmpeg` (FFmpeg compile),
  `compileClipAudioFilter`, `mixFingerprint`, `buildKeyframeExpression`,
  `xfadeKindFor`, `dimensionsForAspect`.
- Integration: `useClipPropertiesSync` (write debouncing + flush),
  `useAudioMixChain` (chain build under various ref states),
  `useProject` (hydration from DB rows).
- Remaining store: `setClipProperty`, `addKeyframeAtPlayhead`,
  `insertTitleAtPlayhead`, `applyProjectTemplate`, `replaceClip`,
  `overwriteAtPlayhead`, `setTrackProps` + lock enforcement,
  `cutSelected` / `duplicateSelected` / `selectAllClips`.

**Stop the bleeding:** every editor bug fix from this point on lands
with a regression test.

---

## Week 3 — Preview/bake parity contracts + render harness expansion

**Deliverable:** every animatable property has a single compile
function that both preview and render call. A test asserts the two
paths produce equivalent output at sample times. The render harness
has 6 fixtures.

- Parity contracts (one shared function per property):
  - Volume
  - Pan
  - Opacity
  - Scale
  - Position X / Y
  - Rotation
  - Fade in/out
  - Per-clip speed
  - EQ / Compressor / NoiseReduction / Reverb
- For each: a unit test that runs preview-compile and bake-compile
  on the same input and asserts equivalence.
- Render fixtures (cumulative):
  - F01: single video clip — output dimensions correct, no extras.
  - F02: two clips with default transition — xfade present, offset
    math correct.
  - F03: title clip — drawtext present, enable='between(t,...)'
    spans the right window.
  - F04: keyframes on scale + opacity — `setpts`/`colorchannelmixer`
    expressions present and parseable.
  - F05: muted A1 + soloed A2 — voice clip's audio chain forces
    `volume=0`; A2 retains its mix.
  - F06: clip on V2 — overlay filter present at correct time window.

**Stop the bleeding:** any new property added to the editor must ship
with a parity contract and a fixture.

---

## Week 4 — Render harness completion + invariant assertions

**Deliverable:** 12+ render fixtures covering every documented editor
feature. The harness asserts both string-level invariants AND output
byte invariants (when the harness can actually invoke ffmpeg locally
or via a sandbox Replicate API).

- Remaining fixtures:
  - F07: aux audio (A2 music) — `adelay` + `amix` present.
  - F08: per-clip speed — `setpts=PTS/N` + `atempo` chain.
  - F09: project text overlay — `drawtext` at the overlay's window.
  - F10: color grade — `eq` + `colorbalance` + `colortemperature`.
  - F11: VFX recipe stack — effect chain spliced, labels namespaced.
  - F12: auto-ducking ON with A1+A2 — `sidechaincompress` present.
- Invariants every fixture asserts:
  - Filter label uniqueness (no duplicate `[vN]`, `[aN]`, `[fxXX]`).
  - All declared inputs are referenced in the graph.
  - All declared outputs (`[vout]`, `[aMaster]`) are mapped.
  - Output dimensions match the requested resolution × aspect.
  - The filter chain string is valid FFmpeg syntax (parsed by a
    minimal validator, not just regex).
- Optional: real ffmpeg invocation against a 1-second test clip
  with assertions on frame count + audio levels.

**Stop the bleeding:** every dead-wire from the prior verification
audit is now caught by a fixture.

---

## Week 5 — Production observability + profile/lobby coverage

**Deliverable:** when something breaks in production you know what
without an agent audit. The non-editor surfaces have E2E coverage on
critical paths.

- `render_failures` migration — every stitcher failure logs its
  classification, the project_id, the stitcher version hash, and
  the input shape.
- Sentry + PostHog client wiring — already partly installed; finish
  the integration. Tag errors by surface (`editor.save`,
  `editor.render`, `lobby.feed`, etc.).
- A `/admin/observability` route with charts: render success rate
  by aspect/format, failure mode histogram, last 50 errors.
- Playwright critical paths (the only E2E we maintain):
  - Profile: sign in → load own profile → toggle to settings mode
    → edit bio → save → reload → bio persists.
  - Lobby: sign in → load → see at least one trending tile → open
    theater → close theater → URL unchanged.
  - Editor: sign in → load project with 2 clips → split clip at
    playhead → save → render → check render queue shows it.

**Stop the bleeding:** every prod failure leaves a trail you can
query instead of guess.

---

## Week 6 — Video generation + contract tests

**Deliverable:** the AI engines have contract tests against recorded
Replicate fixtures. Each engine's cost math is unit-tested. Bug
classes specific to generation (orphan engines, wrong cost math,
unwired surcharges) cannot land.

- For each engine spec in `_shared/engines.ts`:
  - Unit test of `creditsFor(spec, duration, opts)` covering
    base + fps60 + upscale4k combinations.
  - Contract test: recorded Replicate response → expected DB row
    shape in `video_clips`.
- For `editor-generate-clip`: idempotency test (same idempotencyKey
  → same row, not double-billed).
- For `hollywood-pipeline` / `seedance-pipeline`: integration test
  that asserts the full plan produces the expected `video_clips`
  fan-out shape.
- Orphan detection: a script that lists every `supabase.functions.invoke`
  call site and every edge function on disk, flags mismatches.
- A test that lists every entry in `EngineSpec.qualityProfiles` and
  asserts the corresponding cost surcharge is wired into the
  invoke body (no more "5 credits declared, never billed").

**Stop the bleeding:** the engine layer is no longer a black box.

---

## What we explicitly skip

- **100% coverage targets.** Vanity metric. Some files don't need
  tests (UI styling, demo data). Some files need many (store, render).
- **UI snapshot tests for the marketing pages.** They'd just rot.
- **Mock-heavy unit tests.** They erode trust faster than no tests.
- **Hand-rolled security rules.** Use `npm audit`, `semgrep`,
  `socket.dev`. Bought, not built.
- **E2E for every interaction.** Only critical paths. Maintenance
  cost of 200 Playwright tests would exceed their value.
- **Architecture fitness functions.** ESLint import boundaries handle
  the 90% case; the rest isn't worth the framework.

## CI cost ceiling

Whole CI run (lint + typecheck + unit + parity + render fixtures +
Playwright) must complete in **under 5 minutes on the GitHub runner**.
If a phase pushes past that budget, parallelize or strip something.
Slow CI is worse than no CI.

## Owner

You. Don't outsource this. The discipline of writing the test is the
test.
