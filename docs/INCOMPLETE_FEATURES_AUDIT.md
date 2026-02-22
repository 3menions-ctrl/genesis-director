# INCOMPLETE FEATURES / BROKEN PROMISES AUDIT

**Date**: 2026-02-22  
**Auditor**: Senior Product Engineer + QA  
**Method**: End-to-end code trace of every route, edge function, and UI action

---

## 1) Feature Inventory

| # | Feature | Entry Points | Backing Endpoints | Data | Status |
|---|---------|-------------|-------------------|------|--------|
| F01 | Auth (signup/login/reset) | `/auth`, `/forgot-password`, `/reset-password`, `/auth/callback` | Supabase Auth, `track-signup` | `profiles`, `login_attempts` | ✅ Complete |
| F02 | Onboarding | `/onboarding` | `profiles` update | `profiles` | ✅ Complete |
| F03 | Projects CRUD | `/projects` | `movie_projects` CRUD, `delete-project`, `cancel-project` | `movie_projects` | ✅ Complete |
| F04 | Create Video (Text/Image/Avatar) | `/create` | `mode-router`, `generate-script`, `hollywood-pipeline`, `generate-avatar*` | `movie_projects`, `video_clips` | ✅ Complete |
| F05 | Production Monitor | `/production/:id` | `check-video-status`, `check-specialized-status`, `retry-failed-clip`, `simple-stitch` | `video_clips`, `movie_projects` | ✅ Complete |
| F06 | Script Review | `/script-review` | `generate-script`, `smart-script-generator` | `movie_projects.generated_script` | ✅ Complete |
| F07 | Avatars Library | `/avatars` | `generate-avatar*`, `avatar_templates` query | `avatar_templates` | ✅ Complete |
| F08 | Templates Gallery | `/templates` | None (local data only) | localStorage `selectedTemplate` | ⚠️ Partially implemented |
| F09 | Environments Gallery | `/environments` | None (local data only) | None (param never consumed) | ⚠️ Partially implemented |
| F10 | Video Editor (NLE) | `/editor` | `render-video`, `editor-tts`, `editor-transcribe`, `elevenlabs-sfx`, `elevenlabs-music` | `edit_sessions` | ⚠️ Partially implemented |
| F11 | Training Video | `/training-video` | `generate-avatar-direct`, same as avatar pipeline | `movie_projects` | ✅ Complete |
| F12 | Gallery / Showcase | `/gallery` | `gallery_showcase` query | `gallery_showcase` | ✅ Complete |
| F13 | World Chat | `/chat` | Realtime channels, `conversations`, `chat_messages` | `conversations`, `chat_messages`, `conversation_members` | ✅ Complete |
| F14 | Creators / Social Hub | `/creators`, `/user/:userId` | `profiles`, `user_follows`, `movie_projects` | `profiles`, `user_follows`, `project_likes` | ✅ Complete |
| F15 | Photo Editor | `/create` (Photo tab) | `edit-photo` | None persistent | ⚠️ Partially implemented |
| F16 | Motion Transfer Mode | `/create` (mode selector) | `motion-transfer` (returns 501) | None | 🔴 Broken / Stub |
| F17 | Video-to-Video (Style Transfer) | `/create` (mode selector) | `stylize-video` | `movie_projects` | ✅ Complete |
| F18 | Credits & Billing | `/pricing`, Settings | `create-credit-checkout`, `stripe-webhook`, `add_credits()` | `credit_transactions`, `credit_packages`, `profiles.credits_balance` | ✅ Complete |
| F19 | Admin Dashboard | `/admin` | `admin_*` RPC functions, `admin-delete-auth-user` | `admin_audit_log`, `user_roles` | ✅ Complete |
| F20 | Gamification / XP | Profile badge | `gamification-event`, `add_user_xp()` | `user_gamification`, `achievements` | ✅ Complete |
| F21 | Widget / Embeddable Landing | `/w/:slug`, `/widget/:publicKey` | `get-widget-config`, `log-widget-event`, `generate-widget-config` | `widget_configs`, `widget_events` | ✅ Complete |
| F22 | Render-Video (Server-side export) | Editor Export | `render-video` | `edit_sessions` | ⚠️ Partially implemented |
| F23 | Blog | `/blog` | None (hardcoded articles) | None | ⚠️ Partially implemented |
| F24 | Press Kit | `/press` | None (hardcoded data) | None | ✅ Complete (static) |
| F25 | Security Settings (2FA) | `/settings` Security tab | None | None | 🔴 Stub (UI only) |
| F26 | Scenes Hub | `/create` (Scenes tab) | `generate-scene-images` | `scene_images` | ✅ Complete |
| F27 | Agent / AI Chat | Floating button, Cmd+K | `agent-chat` | `agent_conversations`, `agent_messages` | ✅ Complete |
| F28 | Video Detail Page | `/video/:videoId` | `movie_projects` query | `movie_projects`, `project_comments` | ✅ Complete |
| F29 | Help Center | `/help` | None (static) | None | ✅ Complete (static) |
| F30 | How It Works | `/how-it-works` | None (static) | None | ✅ Complete (static) |

---

## 2) Incomplete Feature Findings (Ranked)

### CRITICAL

#### INC-01: Motion Transfer Mode — Returns 501, Users Can Select It
- **Severity**: Critical
- **Evidence**: `supabase/functions/motion-transfer/index.ts` line 62 returns `{ status: 501 }` with `notImplemented: true`. Mode is selectable via `src/types/video-modes.ts` line 60 and visible in `CreationHub`.
- **What exists**: Mode definition, edge function skeleton, Production page handles it (`src/pages/Production.tsx` line 1323)
- **What's missing**: Actual video generation logic. Users select this mode, spend time configuring, then get an error.
- **User impact**: User selects "Motion Transfer", writes a prompt, hits Create → gets an error toast and no video. Credits may still be deducted (the `mode-router` FIX #1 comment at line 336 attempts to skip credit deduction but the mode-router routing logic still invokes the function).
- **Minimal fix**: **Hide the mode from the UI** — remove it from `VIDEO_MODES` in `src/types/video-modes.ts` and `src/types/video-generation-modes.ts`. Keep the edge function as a placeholder for future use.
- **Tests**: Unit test that `motion-transfer` is not in the selectable modes list; contract test that the endpoint returns 501.

---

### HIGH

#### ~~INC-02: Environments Page — `?environment=` Param Never Consumed~~ ✅ FALSE POSITIVE
- **Status**: Already implemented
- **Evidence**: `src/hooks/useTemplateEnvironment.ts` line 883 reads `searchParams.get('environment')`, line 1004-1027 `loadEnvironment()` maps environment ID to mood/genre/environmentPrompt, line 1042-1044 auto-loads on mount.
- **Resolution**: No fix needed. The `useTemplateEnvironment` hook correctly consumes the param and applies settings to CreationHub.

#### INC-03: Video Editor Export — No Render Server Configured
- **Severity**: Medium (downgraded — browser export now works via ZIP/MP4 download)
- **Evidence**: `supabase/functions/render-video/index.ts` lines 56-65 and 87-112. When `RENDER_SERVER_URL` is not set, the function saves timeline as draft.
- **What exists**: Full NLE editor UI, timeline, tracks, clips, transitions, audio. Export dialog exists. Browser-side export downloads single MP4 or multi-clip ZIP.
- **What's missing**: `RENDER_SERVER_URL` secret is not configured for server-side rendering. Browser export works but doesn't merge clips into a single video.
- **User impact**: User edits a video, clicks Export → gets working ZIP/MP4 download. Server-rendered single-file export is not available.
- **Minimal fix**: Configure a render server + set `RENDER_SERVER_URL` for true single-file rendering.
- **Tests**: Contract test for `render-video` with/without `RENDER_SERVER_URL`.

#### INC-04: Photo Editor Manual Mode — "Coming Soon" Placeholder
- **Severity**: High
- **Evidence**: `src/components/photo-editor/PhotoEditorHub.tsx` lines 493-508. Manual mode tab exists but shows "coming soon" text and a button to switch to AI chat.
- **What exists**: AI chat mode works (calls `edit-photo` edge function), bulk mode exists
- **What's missing**: Brightness, contrast, saturation, crop, rotate sliders — the entire manual adjustment panel
- **User impact**: User selects "Manual" tab → sees "coming soon" message. Misleading tab.
- **Minimal fix**: Either (a) implement basic sliders using CSS filters, or (b) remove the Manual tab entirely and consolidate into AI-only.
- **Tests**: If implemented: unit test for slider → CSS filter mapping.

#### INC-05: Production Page — "Retry feature coming soon" Toast
- **Severity**: High
- **Evidence**: `src/pages/Production.tsx` line 1339: `toast.info('Retry feature coming soon')` in the `onRetry` handler of `SpecializedModeProgress`.
- **What exists**: `retry-failed-clip` edge function exists and works for standard mode. `SpecializedModeProgress` component has an onRetry prop.
- **What's missing**: The retry handler for avatar/motion-transfer/v2v modes just shows a toast instead of calling the retry function.
- **User impact**: Avatar video fails → user clicks Retry → gets "coming soon" toast. No way to recover.
- **Minimal fix**: Wire `onRetry` to call `retry-failed-clip` or `resume-avatar-pipeline` edge function.
- **Tests**: Integration test: trigger retry on failed avatar clip.

---

### MEDIUM

#### INC-06: Security Settings — 2FA "Coming Soon" Badge
- **Severity**: Medium
- **Evidence**: `src/components/settings/SecuritySettings.tsx` line 303-305. "Coming Soon" badge next to Two-Factor Authentication.
- **What exists**: UI layout for 2FA section
- **What's missing**: Entire 2FA implementation (TOTP setup, QR code, verification)
- **User impact**: Section visible but non-functional. Cosmetic only, not a broken promise since it's labeled.
- **Minimal fix**: Remove the 2FA section entirely until implemented, or keep the label.

#### INC-07: Blog — Hardcoded Articles, No CMS
- **Severity**: Medium
- **Evidence**: `src/pages/Blog.tsx` — all articles are hardcoded as a `BLOG_ARTICLES` array (no Supabase query).
- **What exists**: Full blog layout, article detail view, search, categories
- **What's missing**: Database-backed articles, admin article creation
- **User impact**: Blog works but content is static. Not broken, just incomplete as a feature.
- **Minimal fix**: Add a `blog_articles` table and admin CRUD, or keep as-is if content changes are rare.

#### INC-08: Templates Gallery — No Persistence of Template Selection
- **Severity**: Medium
- **Evidence**: `src/pages/Templates.tsx` — template selection navigates to `/create` with `localStorage.setItem('selectedTemplate', ...)` but the Create page must read this.
- **What exists**: 26 templates with thumbnails, categories, "Use Template" button
- **What's missing**: Need to verify `CreationHub` reads `selectedTemplate` from localStorage.
- **User impact**: If not consumed, selecting a template navigates to Create but nothing is pre-filled.

---

### LOW

#### INC-09: Gamification Achievements — Seeded but No UI for Unlocking
- **Severity**: Low
- **Evidence**: `achievements` table exists, `user_achievements` table exists, `add_user_xp()` function grants XP, but no "Achievements Gallery" or "Achievement Unlocked" notification UI was found in pages.
- **What exists**: Database schema, XP/level system, streak tracking
- **What's missing**: A dedicated achievements page or modal showing progress toward each achievement
- **User impact**: Users earn XP but can't see what achievements exist or their progress.

#### INC-10: Agent Memory/Learning — `agent_preferences.learned_context` Never Written
- **Severity**: Low
- **Evidence**: `agent_preferences` table has `learned_context` JSONB column but `src/hooks/useAgentChat.ts` doesn't write to it.
- **What exists**: Table schema, preference fields
- **What's missing**: Logic to extract and persist context from conversations
- **User impact**: Agent doesn't improve over time.

---

## 3) Stub/Placeholder Detector Report

### Edge Functions Returning 501/Stub Responses

| File | Type | Impact |
|------|------|--------|
| `supabase/functions/motion-transfer/index.ts` | Returns 501 "Not Implemented" | ~~Users can select this mode~~ Hidden from UI ✅ |

### ~~"Coming Soon" UI Elements~~ ✅ ALL FIXED

All "coming soon" placeholders have been resolved:
- ~~Photo Editor Manual tab~~ → Removed from UI ✅
- ~~Security Settings 2FA badge~~ → Removed from UI ✅
- ~~Production retry toast~~ → Wired to `resume-avatar-pipeline` ✅

### render-video Mock/Fallback

| File | Line | Description |
|------|------|-------------|
| `supabase/functions/render-video/index.ts` | 57-65 | Returns mock "pending" status when `RENDER_SERVER_URL` not set |
| `supabase/functions/render-video/index.ts` | 89-112 | Saves timeline as draft, returns fallback message (server lacks `RENDER_SERVER_URL`) |

### TODO/FIXME Count by Area

Intentional `FIXME`/`FIX` comments (previously resolved issues, kept as documentation): ~15 across the codebase. No actionable unresolved TODOs found in production code.

---

## 4) UI ↔ Backend Mismatch Report

| # | UI Action | Expected Backend | Actual Behavior | Severity |
|---|-----------|-----------------|-----------------|----------|
| M1 | Environments "Apply" button | Pre-fills Create page with environment settings | Navigates to `/create?environment=X` — param is ignored | High |
| M2 | Motion Transfer mode selection | Generates motion-transferred video | Edge function returns 501 error | Critical |
| M3 | Photo Editor "Manual" tab | Shows adjustment sliders | Shows "coming soon" text | High |
| M4 | Specialized mode "Retry" button | Retries failed clip | Shows "coming soon" toast | High |
| M5 | Video Editor "Export" | Renders and downloads video | Saves draft, no actual render without server | High |

### Endpoints Never Called from Frontend

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `replicate-audit` | Audit Replicate usage | Admin/maintenance only, acceptable |
| `kling-v3-audit-test` | Test Kling V3 | Development tool, acceptable |
| `seed-avatar-batch-v2` | Seed avatar data | One-time setup, acceptable |
| `seed-avatar-library` | Seed avatar data | One-time setup, acceptable |
| ~~`regenerate-stock-avatars`~~ | ~~Refresh stock avatars~~ | **Deleted** — consolidated into `seed-avatar-library` |
| ~~`regenerate-animated-avatars`~~ | ~~Refresh animated avatars~~ | **Deleted** — consolidated into `seed-avatar-library` |
| `revoke-demo-sessions` | Clean demo sessions | Maintenance, acceptable |
| `zombie-cleanup` | Clean stale processes | Called by watchdog, acceptable |

---

## 5) Dead/Unreachable Code Report

### Routes Not Linked from Navigation

The main nav (`AppHeader.tsx` lines 28-35) only links: Create, Library, Pipeline, Editor, Creators, Chat.

These routes exist but have **no navigation links** in the header/sidebar:

| Route | Page | Linked From |
|-------|------|-------------|
| `/templates` | Templates.tsx | Landing page CTA? |
| `/environments` | Environments.tsx | None found in nav |
| `/training-video` | TrainingVideo.tsx | None found in nav |
| `/gallery` | Gallery.tsx | Landing page? |
| `/blog` | Blog.tsx | Footer only |
| `/press` | Press.tsx | Footer only |
| `/help` | HelpCenter.tsx | Footer/Settings |
| `/how-it-works` | HowItWorks.tsx | Landing page |
| `/pricing` | Pricing.tsx | Landing page/Settings |

### Legacy Redirects (Acceptable Dead Code)

`/studio` → `/create`, `/scenes` → `/create`, `/design-picker` → `/create`, `/clips` → `/editor`, `/universes` → `/projects`, `/social` → `/creators`, `/discover` → `/creators`, `/long-video` → `/create`, `/pipeline/*` → `/create`, `/extract-thumbnails` → `/projects`

---

## 6) Data Shape / Contract Gaps

| # | Location | Gap | Impact |
|---|----------|-----|--------|
| D1 | `Environments.tsx` → `CreationHub` | Environment ID passed as query param but never read | Silent data loss |
| D2 | `render-video` response | Returns fallback info but frontend now handles export via browser-side ZIP/MP4 | Low impact — browser export works |
| D3 | `motion-transfer` response | Returns `notImplemented: true` but `mode-router` doesn't fully handle 501 status from function invocations (Supabase client wraps non-2xx as errors) | Inconsistent error handling |

---

## 7) Completion Roadmap

### 🚨 Stop-the-Bleed (Top 3 Critical/High — do NOW)

| # | Issue | Fix | Effort | Definition of Done |
|---|-------|-----|--------|-------------------|
| 1 | **INC-01**: Motion Transfer selectable but 501 | Remove `motion-transfer` from `VIDEO_MODES` arrays in `src/types/video-modes.ts` and `src/types/video-generation-modes.ts` | **S** | Mode no longer appears in Create UI; edge function unchanged for future use |
| 2 | **INC-02**: Environments param ignored | Read `?environment=` in `CreationHub`, map to style/mood preset | **S** | Navigating from Environments pre-fills Create form |
| 3 | **INC-05**: Retry toast instead of action | Wire `onRetry` in Production.tsx to call `resume-avatar-pipeline` | **S** | Retry button triggers actual retry for avatar/specialized modes |

### Priority Backlog

| # | Issue | Fix | Effort | Dependencies |
|---|-------|-----|--------|-------------|
| 4 | INC-04: Photo Manual tab | Implement CSS filter sliders OR remove tab | **M** | None |
| 5 | INC-03: Video Editor Export | Configure render server for single-file output (browser ZIP export already works) | **L** | Render server infrastructure |
| 6 | INC-06: 2FA section | Remove placeholder section until ready | **S** | None |
| 7 | INC-08: Templates selection persistence | Verify `CreationHub` reads `selectedTemplate` from localStorage | **S** | None |
| 8 | INC-07: Blog CMS | Create `blog_articles` table + admin CRUD | **L** | Admin panel extension |
| 9 | INC-09: Achievements UI | Create achievements gallery component | **M** | Gamification schema exists |
| 10 | INC-10: Agent learning | Persist conversation context to `agent_preferences` | **M** | Agent chat hook |

### Effort Key
- **S** = Small (< 1 hour, < 50 lines changed)
- **M** = Medium (2-4 hours, 50-200 lines)
- **L** = Large (1+ days, 200+ lines or new infrastructure)
