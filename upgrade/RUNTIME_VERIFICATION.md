# RUNTIME VERIFICATION — "it doesn't run", checked empirically

You were right to push back. Phase A's first pass was **static** — agents read code and traced paths, then marked stages "DONE." Reading ≠ running. This pass I actually **installed, compiled, ran the tests, booted the app in a headless browser, validated the Replicate model, and queried prod read-only**. Findings below, with where the evidence contradicts the static audit — and one place the live data **corrected me**.

Date: 2026-06-27. Branch `upgrade`. Prod ref `ywcwaumozoejierlfkgj`. All prod access was **read-only** (Management-API SELECTs + a Replicate GET); no creations triggered, no writes.

---

## 1. The "everything's fine" surface is real — that's the trap
- `bun install` → 1103 pkgs OK. `tsc --noEmit` → **clean**. `vite build` → **clean** (23s). `vitest run` → **3705 passed / 61 skipped / 0 failed** (130 files).
- This is exactly why every agent said "fine." The static + test layer is genuinely green. It tells you nothing about whether a user can actually make a video.

## 2. Local runtime — concrete breakages (verified)
- **Fresh checkout can't run at all:** no `node_modules`, no `.env.local`. Expected, but worth stating.
- **🔴 Boot crash on missing env (verified by execution):** `src/integrations/supabase/client.ts:11` calls `createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)` at **module load**. With env unset, `@supabase/supabase-js` throws `supabaseUrl is required.` (I ran it — it throws) **before React mounts**. No error boundary catches a module-load throw → **blank white screen, no message**. (Prod has env, so this bites *local/dev/misconfigured* runs, not prod.)
- **🟠 Gate-by-default hides the whole app when logged out (verified in a real browser):** newest commit "gate the app by default." `src/lib/publicRoutes.ts` allowlists only marketing/auth. Headless probe logged-out: `/studio`, `/editor/demo`, `/editor` all render the **landing page** (redirected). The **editor demo sandbox `/editor/demo` is no longer publicly reachable** — which silently breaks the premise of `e2e/editor-controls.spec.ts` ("/editor/demo short-circuits Supabase + auth") and any quick manual QA of the editor without a full logged-in session.
- **🟠 Workspace loader has no failure-exit (code-verified):** `src/components/auth/ProtectedRoute.tsx:258-285` shows the "Loading your workspace… 70%" / "Setting up your account… 90%" CinemaLoaders purely from state, with **no timeout fallback** (unlike `useGatekeeperLoading`'s 5s). The retry UI only appears on an explicit `profileError` (`:199`). So if the profile fetch resolves **empty** or **hangs** without throwing, the app sits at the loader **forever** with no escape. (I hit this loader in the seeded-session probe; I could not fully reproduce the prod path because a fake JWT never passes Supabase session verification — see §5 honesty note.)

## 3. Live pipeline — what's actually true in prod (read-only)
- **The pipeline broadly WORKS.** `movie_projects` last 14 days: **49 completed**, 12 draft, 3 generating, 1 error. Today 16:04–16:40 it completed across **every engine** (wan, veo, sora, seedance, kling). **You (`3menions@gmail.com`) completed 9 projects today at ~16:xx** across all 5 engines. So "the backend pipeline is globally dead" is **false**.
- **✅ Ruled out — the ffmpeg stitch model is valid.** The hardcoded `FFMPEG_MODEL_VERSION` (`seamless-stitcher/index.ts:108`, `efd0b79b…`) returns **HTTP 200** on Replicate and **is the model's latest version**. So the QA "ffmpeg cog stitch" blocker is **not** a dead/wrong version — it's something in command construction or cog I/O if it recurs. My agent's "stitch = DONE" was lucky, not verified.
- **🔴 CONFIRMED in prod — stuck jobs never auto-recover (the dark watchdog).** Three `generating` projects are frozen **6–7 hours**, idle 6h+, with **0 clips** produced and no error. This is exactly the unscheduled-watchdog finding from DIAGNOSIS.md, now observed live. (All 3 victims are `@smallbridges.test` automated accounts today — but the recovery gap is real and would hold a paying user's credits indefinitely.) All 3 are **kling**.
- **🟠 Your most recent attempt is stuck.** Your `21:24` project (`7df64300`) sits at `status=draft`, `video_engine=null`, 2 clips, yet `video_url IS NOT NULL` — an odd half-state (draft with a URL, no engine). This is the single real-owner anomaly and the most likely candidate for *your* "it doesn't run." It is **not** the Studio→mode-router generate path (that sets `video_engine` and moves off draft), so it came from a different surface (editor/save/remix) — needs a focused trace.
- **🟠 Schema/code drift is real.** `movie_projects` has **no `generation_mode` column** (Postgres hint: did you mean `generation_lock`). Code/types referencing dropped/renamed columns is the classic "compiles & reads fine, fails at runtime" class — matches the memory notes about ~2,800-line `types.ts` drift and "prod 32 migrations behind."

## 4. SELF-CORRECTION (modeling the skepticism you asked for)
I initially read "**8 users with stuck drafts in a 9-minute window**" as a live multi-user dispatch outage and nearly reported it as such. Checking the accounts: **7 of 8 are `dnd-verify-…@smallbridges.test`** — an automated signup/creation **test/monitor harness** that creates one draft and stops *by design*. The 8th is **you**. So it was **not** an outage; the baseline of ~1 draft/day plus a synthetic-monitor burst explains it. The live data corrected a premature conclusion — exactly the failure mode you called out in the first pass.

## 5. Honesty about limits
- I **could not** drive the real authenticated app (Studio/editor with a real project) headlessly: a fake JWT never passes Supabase session verification, so the seeded-session probe stalls at the auth loader. Confirming the *logged-in* runtime needs either a real session token or running against staging.
- I did **not** trigger a real creation against prod (would cost credits / write data; and your Phase-B rule is dev/staging only). The pipeline-completion evidence is from existing rows.
- "Prod 32 migrations behind" / specific drifting RPCs: asserted in memory, only spot-checked here (`generation_mode` absent confirmed). A full schema-vs-`types.ts`-vs-edge-function reconciliation is a separate dig.

---

## What this means for "it doesn't run"
The backend pipeline is **not** globally down. The most probable culprits for what *you* experienced, in order:
1. **Local/dev boot** — missing env → silent white screen (§2), and logged-out gating making the app look dead (§2).
2. **Your own stuck `21:24` draft** (§3) — a real half-state on a non-Studio creation surface.
3. **Stuck-job non-recovery** (§3) — real, currently hitting test accounts, will hit real users.

To aim the next (deeper) dig precisely, I need to know **where** you hit "it doesn't run":
- Local `npm run dev` / a deployed URL / staging?
- Logged out, or logged in?
- Which exact action dies — page won't load, creation never starts, render never finishes, editor won't open?

Tell me the surface and I'll reproduce and root-cause *that* path end-to-end rather than auditing in the abstract.
