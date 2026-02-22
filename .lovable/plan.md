# Complete Development Plan — Foundation Up

## Priority Legend
- 🔴 P0 — Critical (blocks core UX or revenue)
- 🟡 P1 — Important (degrades experience)
- 🟢 P2 — Polish (nice-to-have)

---

## PHASE 1: Backend Cleanup & Foundation 🔴

### 1.1 Edge Function Consolidation
**Problem**: 91 edge functions, many redundant or orphaned.
**Actions**:
- [ ] Merge `generate-avatar`, `generate-avatar-image`, `generate-single-avatar` → single `generate-avatar-direct`
- [ ] Merge `generate-avatars-batch`, `generate-avatar-batch`, `batch-avatar-generator` → single `generate-avatar-batch`
- [ ] Merge `extract-video-frame`, `extract-first-frame`, `extract-last-frame` → single `extract-video-frame` with `position` param
- [ ] Merge `generate-thumbnail`, `generate-project-thumbnail`, `generate-video-thumbnails`, `generate-missing-thumbnails` → single `generate-thumbnail`
- [ ] Delete `motion-transfer/` (returns 501, no frontend)
- [ ] Delete `stylize-video/` (no frontend trigger)
- [ ] Delete `generate-trailer/` (no frontend trigger)
- [ ] Delete `generate-hls-playlist/` (no frontend consumer)
- [ ] Update all frontend callers to use consolidated function names
- **Target**: 91 → ~45 edge functions

### 1.2 Stripe Checkout Hardening
**Problem**: Recurring CORS and auth failures in `create-credit-checkout`.
**Actions**:
- [ ] Rewrite `create-credit-checkout` with expanded CORS headers and inline auth
- [ ] Add integration test that exercises the full checkout→webhook→credit flow
- [ ] Verify `stripe-webhook` idempotency with duplicate event IDs

---

## PHASE 2: Video Export — The #1 Broken Feature 🔴

### 2.1 Multi-Clip Export Fix ✅ DONE
**Problem**: Editor export only downloads first clip. `mp4box.js` concat fails silently.
**Solution**: Rewrote `render-video` edge function to use Replicate `bfirsh/concatenate-videos` 
(FFmpeg-based server-side concat). Falls back to ZIP download if merge fails.
- [x] Replace client-side concat with server-side `render-video` edge function using Replicate FFmpeg
- [x] Implement fallback: if server render fails, download clips as ZIP
- [x] Add progress UI showing merge → download stages
- [x] Poll-based status checking with 5-minute timeout

### 2.2 Editor Effects in Export
**Problem**: Color grading, filters, text, speed, crop, audio fade — all CSS/preview-only, not in export.
**Actions**:
- [ ] Design an export manifest format: `{ clips: [...], effects: { colorGrading, filters, text, speed, crop, audioFade } }`
- [ ] Pass manifest to `render-video` edge function
- [ ] For MVP: apply effects server-side via FFmpeg filter chains
- [ ] For fallback (no server): clearly label export as "preview quality — effects not included"

---

## PHASE 3: Stub Features — Remove or Complete 🟡

### 3.1 Remove Dead Stubs
Features with no backend AND no realistic path to completion:
- [ ] **Motion Transfer Mode**: Remove from `VIDEO_MODE_CONFIG`, remove edge function
- [ ] **Beat Sync**: Remove panel from editor (simple division ≠ beat detection)
- [ ] **Chroma Key**: Remove panel from editor (CSS mix-blend-mode ≠ chroma key)
- [ ] **Keyframe Editor**: Remove panel (no interpolation engine)
- [ ] **Picture-in-Picture**: Remove panel (metadata stored but never rendered)
- [ ] **Stickers**: Remove panel (never rendered on canvas)
- [ ] **Trending Effects**: Remove panel (names only, no effect application)

### 3.2 Fix Actionable Stubs
Features that are close to working:
- [ ] **Press Kit Download**: Create actual press kit PDF/ZIP in storage, wire download button
- [ ] **Press Media Inquiries**: Wire to `mailto:press@[domain]` or contact form
- [ ] **Leaderboard**: Create `/leaderboard` page using existing `user_gamification` data, wire profile button
- [ ] **Blog**: Move articles to database table `blog_posts`, build simple CMS in admin panel

---

## PHASE 4: Frontend Polish & Design Excellence 🟡

### 4.1 Design System Audit
- [ ] Audit all components for hardcoded colors → replace with semantic tokens
- [ ] Ensure dark/light mode consistency across all 34 pages
- [ ] Typography audit: enforce Sora headings / Instrument Sans body everywhere
- [ ] Spacing audit: consistent padding/margins using design scale

### 4.2 Landing Page Performance (from existing plan)
- [ ] Remove ScreenCrashOverlay (Three.js → -500KB)
- [ ] Replace CinematicTransition with minimal CinemaLoader fade
- [ ] Fix video preloading (`preload="auto"` → `preload="none"`)
- [ ] Remove duplicate SocialProofTicker
- [ ] Add gatekeeper loading integration

### 4.3 Critical UX Fixes
- [ ] Production page: add clear "what's happening" status messages for each pipeline stage
- [ ] Error states: ensure every API call has proper error UI (not just console.warn)
- [ ] Loading states: audit all data-fetching pages for skeleton/spinner coverage
- [ ] Empty states: ensure all list views have proper empty state illustrations

---

## PHASE 5: Security & Stability 🟡

### 5.1 RLS Audit
- [ ] Run database linter
- [ ] Review all 40+ table policies for correctness
- [ ] Verify no tables allow unrestricted public writes

### 5.2 Edge Function Auth
- [ ] Verify all 91 edge functions use `auth-guard.ts`
- [ ] Ensure no function accepts raw SQL or user-provided queries
- [ ] Rate limiting on all public-facing endpoints

---

## PHASE 6: Testing Infrastructure 🟢

- [ ] Add E2E tests for: signup → create project → production → export
- [ ] Add integration tests for Stripe checkout flow
- [ ] Add integration tests for avatar generation pipeline
- [ ] Monitor: set up alerting for pipeline-watchdog failures

---

## Execution Order

```
Week 1: Phase 1 (Backend cleanup) + Phase 2 (Export fix)
Week 2: Phase 3 (Stubs) + Phase 4.2 (Landing perf)
Week 3: Phase 4.1 + 4.3 (Design + UX)
Week 4: Phase 5 (Security) + Phase 6 (Testing)
```

---

## Success Metrics
- 0 broken features in inventory
- 0 stub features in inventory  
- Export produces correct multi-clip video 100% of the time
- Landing page LCP < 2.5s
- Edge functions reduced from 91 to ~45
- All tables pass RLS linter
