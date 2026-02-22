# Comprehensive Regression Test Plan

**App:** Genesis Director  
**Stack:** React 18 + Vite + TailwindCSS + TypeScript + Supabase (Lovable Cloud) + 90+ Edge Functions  
**Router:** react-router-dom v6 (BrowserRouter, lazy-loaded pages)  
**Auth:** Supabase Auth (email/password, Google OAuth) + `ProtectedRoute` component + `useAdminAccess` hook  
**State:** React Query (TanStack) + React Context (AuthContext, StudioContext)  
**Testing:** Vitest + @testing-library/react + jsdom  

---

## 1) Regression Scope

### P0 — Critical Workflows (must never break)
| # | Workflow | Entry Point |
|---|---------|-------------|
| 1 | Sign up → email verify → first login | `/auth` → `/onboarding` |
| 2 | Sign in → session hydration → protected route access | `/auth` → `/projects` |
| 3 | Credit purchase → Stripe checkout → webhook → balance update | `/pricing` → `stripe-webhook` → `add_credits` RPC |
| 4 | Project creation → script generation → production pipeline | `/create` → `generate-script` → `hollywood-pipeline` |
| 5 | Video generation → status polling → completion | `continue-production` → `check-video-status` → clip upsert |
| 6 | Video stitching → final assembly → playback | `simple-stitch` / `auto-stitch-trigger` → video_url |
| 7 | Credit deduction → per-clip billing → refund on failure | `useCreditBilling` → `production_credit_phases` |
| 8 | Admin role enforcement (server-side) | `user_roles` table + `is_admin()` + `enforce_admin_lock()` |
| 9 | Project deletion → cascade cleanup | `delete-project` edge function |
| 10 | Session security (force-logout, security_version) | `admin_force_logout_user` → client check |

### P1 — Important Workflows
| # | Workflow | Entry Point |
|---|---------|-------------|
| 11 | Avatar generation (single + batch) | `/avatars` → `generate-avatar-direct` |
| 12 | Script editing / review | `/script-review` |
| 13 | Social features (follow, like, comment) | `/creators`, `/video/:id` |
| 14 | Chat / messaging | `/chat` → `useWorldChat` |
| 15 | Profile editing + email change | `/settings` → `update-user-email` |
| 16 | Widget config + embed | `generate-widget-config` → `get-widget-config` |
| 17 | Pipeline watchdog + zombie cleanup | `pipeline-watchdog` → `zombie-cleanup` |
| 18 | Gamification (XP, streaks, achievements) | `gamification-event` |
| 19 | Template selection | `/templates` |
| 20 | Video editor (timeline) | `/editor` |

### P2 — Nice-to-have
| # | Workflow | Entry Point |
|---|---------|-------------|
| 21 | Gallery showcase | `/gallery` |
| 22 | Help center / FAQ | `/help` |
| 23 | Blog / Press pages | `/blog`, `/press` |
| 24 | Landing page CTA flows | `/` |
| 25 | Agent chat (APEX) | `AgentTrigger` → `agent-chat` |
| 26 | Music/SFX generation | `elevenlabs-music`, `elevenlabs-sfx` |
| 27 | Training video mode | `/training-video` |

### IN Scope
- All routes in `src/App.tsx` (42 routes)
- All edge functions in `supabase/functions/` (90 functions)
- All hooks in `src/hooks/` (42 hooks)
- Auth flows (signup, login, password reset, Google OAuth, session refresh)
- Credit system (purchase, deduction, refund, idempotency)
- Admin operations (user mgmt, role mgmt, audit logs)
- Data integrity (RLS policies, credit ledger, project ownership)

### OUT of Scope
- CSS/visual styling regressions (covered by visual snapshot tools)
- Third-party API internals (Stripe, Kling, ElevenLabs, Replicate — mock at boundary)
- Mobile native behavior (web-only app)
- Performance benchmarking (separate tool/process)

---

## 2) Test Inventory (Executable)

### P0 Tests (25)

| ID | Layer | Feature | Preconditions | Steps | Assertions |
|----|-------|---------|---------------|-------|------------|
| REG-001 | Unit | `creditSystem.ts` — `calculateCreditsPerClip` | None | Call with (5, 'standard'), (10, 'standard'), (15, 'standard'), (10, 'avatar'), (15, 'avatar') | Returns 50, 50, 75, 60, 90 respectively |
| REG-002 | Unit | `creditSystem.ts` — `calculateCreditsRequired` | None | Call with clipCount=5, duration=10, mode='standard' | Returns 250 |
| REG-003 | Unit | `creditSystem.ts` — `getCreditBreakdown` | None | Call with clipCount=3, duration=15 | Returns { preProduction: 36, production: 153, qualityAssurance: 36, total: 225 } |
| REG-004 | Unit | `useOptimistic` — rollback on error | None | Call execute() with failing async → assert value returns to previous | Value === initialValue after error; error state set |
| REG-005 | Unit | `useOptimistic` — success with server reconciliation | None | Call execute() with async returning new value | Value === returned value; isPending false |
| REG-006 | Contract | `add_credits` RPC — idempotency | Seeded user | Call add_credits twice with same stripe_payment_id | Second call returns `{ success: false, reason: 'duplicate_payment' }` |
| REG-007 | Contract | `add_credits` RPC — input validation | Seeded user | Call with amount=0, amount=-1, amount=100001 | Each raises exception |
| REG-008 | Contract | `stripe-webhook` — signature validation | None | POST to stripe-webhook without valid Stripe signature | Returns 400/401 |
| REG-009 | Contract | `delete-project` — auth enforcement | No auth header | POST to delete-project | Returns 401 |
| REG-010 | Contract | `delete-project` — ownership check | Authenticated as user A, project owned by user B | POST to delete project B's project | Returns 403 |
| REG-011 | Contract | `admin-delete-auth-user` — non-admin rejection | Authenticated as regular user | POST to admin-delete-auth-user | Returns 403 |
| REG-012 | Contract | `admin-delete-auth-user` — missing target_user_id | Authenticated as admin | POST with empty body | Returns 400 |
| REG-013 | Integration | Auth flow — sign in sets session | Test user credentials | Call signIn → check session/user/profile populated | user.id exists, profile.credits_balance >= 0 |
| REG-014 | Integration | Auth flow — sign out clears state | Signed-in user | Call signOut → check session/user/profile | All null; localStorage cleared |
| REG-015 | Integration | ProtectedRoute — redirect when unauthenticated | No session | Navigate to /projects | Redirected to /auth |
| REG-016 | Integration | ProtectedRoute — render when authenticated | Valid session | Navigate to /projects | Projects page renders |
| REG-017 | Contract | `cancel-project` — prevents double-cancel | Project status='cancelled' | POST to cancel-project | Returns error or no-op |
| REG-018 | Unit | `enforce_admin_lock` trigger — blocks granting admin to non-locked user | DB trigger active | INSERT into user_roles (random_uuid, 'admin') | Exception raised |
| REG-019 | Unit | `enforce_admin_lock` trigger — blocks deleting locked admin | DB trigger active | DELETE from user_roles where user_id=locked_admin AND role='admin' | Exception raised |
| REG-020 | Contract | `generate-script` — auth required | No auth | POST to generate-script | Returns 401 |
| REG-021 | Contract | `hollywood-pipeline` — auth via shared auth-guard | Valid JWT | POST to hollywood-pipeline with project params | Returns 200 or starts pipeline |
| REG-022 | Integration | Credit deduction — balance decreases after clip generation | User with 500 credits | Start production of 1 clip (50 credits) | Balance = 450 |
| REG-023 | Contract | `check-video-status` — returns consistent shape | Valid project | GET check-video-status | Returns `{ status, clips: [...], progress }` shape |
| REG-024 | Unit | `is_admin()` DB function — returns false for non-admin | Regular user | SELECT is_admin(regular_user_id) | Returns false |
| REG-025 | Unit | `is_admin()` DB function — returns true for admin | Admin user | SELECT is_admin(admin_user_id) | Returns true |

### P1 Tests (40)

| ID | Layer | Feature | Key Assertion |
|----|-------|---------|---------------|
| REG-026 | Integration | Avatar generation — `generate-avatar-direct` creates record | Returns clip with status 'generating' |
| REG-027 | Contract | `generate-avatar-direct` — requires auth | 401 without token |
| REG-028 | Integration | Widget config — create + fetch roundtrip | get-widget-config returns created config |
| REG-029 | Contract | `log-widget-event` — public, no auth needed | Returns 200 without auth |
| REG-030 | Contract | `log-widget-event` — validates event_type | Returns 400 for invalid event type |
| REG-031 | Integration | Profile update — display_name change persists | Query returns new name |
| REG-032 | Integration | Email change — `update-user-email` sends verification | Returns success, no immediate email change |
| REG-033 | Contract | `export-user-data` — returns user's data only | Contains only requesting user's data |
| REG-034 | Contract | `delete-user-account` — cascades properly | User's projects, clips, transactions removed |
| REG-035 | Integration | Follow/unfollow — toggle works | Follow count increments/decrements |
| REG-036 | Integration | Like/unlike project — toggle works | likes_count increments/decrements |
| REG-037 | Integration | Comment on project — creates record | Comment appears in query |
| REG-038 | Contract | `agent-chat` — auth required | 401 without token |
| REG-039 | Contract | `agent-chat` — returns streaming/JSON response | Response has expected shape |
| REG-040 | Integration | Chat — send message → appears in conversation | Message in conversation_members scope |
| REG-041 | Contract | `gamification-event` — awards XP | user_gamification.xp_total increases |
| REG-042 | Integration | Streak tracking — consecutive days increment | current_streak > previous |
| REG-043 | Integration | Template selection → project creation | Project created with template data |
| REG-044 | Contract | `pipeline-watchdog` — recovers stalled projects | Stalled project status updated |
| REG-045 | Contract | `zombie-cleanup` — refunds abandoned projects | Credit refund transaction created |
| REG-046 | Contract | `resume-pipeline` — verifies credit charge before skip | Rejects resume if no prior charge |
| REG-047 | Integration | Video detail page — public access | /video/:id renders without auth |
| REG-048 | Integration | User profile page — public access | /user/:id renders without auth |
| REG-049 | Contract | `create-credit-checkout` — creates Stripe session | Returns sessionId or URL |
| REG-050 | Integration | Onboarding skip — redirects to /projects | User lands on /projects |
| REG-051 | Integration | Onboarding complete — sets flag | profile.onboarding_completed = true |
| REG-052 | Contract | `generate-music` — auth required | 401 without token |
| REG-053 | Contract | `edit-photo` — auth required | 401 without token |
| REG-054 | Integration | Admin panel — lists users | admin_list_users returns rows |
| REG-055 | Integration | Admin panel — lists projects | admin_list_projects returns rows |
| REG-056 | Contract | `production-audit` — auth required | 401 without token |
| REG-057 | Integration | Redirect routes work | /studio → /create, /social → /creators |
| REG-058 | Integration | 404 page — unknown route | /xyz renders NotFound |
| REG-059 | Contract | `simple-stitch` — auth required | 401 without token |
| REG-060 | Integration | Gallery page — loads showcase items | gallery_showcase query succeeds |
| REG-061 | Contract | `generate-thumbnail` — auth required | 401 without token |
| REG-062 | Integration | Pricing page — displays credit packages | credit_packages query returns items |
| REG-063 | Contract | `cleanup-stale-drafts` — service-role only | Rejects non-service-role calls |
| REG-064 | Integration | Video reactions — upvote/downvote toggles | vote_score changes |
| REG-065 | Contract | `track-signup` — public endpoint | Accepts POST without auth |

### P2 Tests (20)

| ID | Layer | Feature | Key Assertion |
|----|-------|---------|---------------|
| REG-066 | Integration | Blog page renders | No crash, content visible |
| REG-067 | Integration | Press page renders | No crash, content visible |
| REG-068 | Integration | Help center renders | FAQ items visible |
| REG-069 | Integration | Landing page CTA → /auth | Navigation works |
| REG-070 | Integration | Contact form submission | support_messages insert succeeds |
| REG-071 | Contract | `script-assistant` — auth required | 401 without token |
| REG-072 | Integration | Training video page renders | No crash |
| REG-073 | Integration | How-it-works page renders | Steps visible |
| REG-074 | Contract | `elevenlabs-music` — auth required | 401 without token |
| REG-075 | Contract | `elevenlabs-sfx` — auth required | 401 without token |
| REG-076 | Integration | Terms page renders | Legal content visible |
| REG-077 | Integration | Privacy page renders | Privacy content visible |
| REG-078 | Integration | Environments page renders | Environment cards visible |
| REG-079 | Contract | `scene-music-analyzer` — auth required | 401 without token |
| REG-080 | Integration | Command palette (Cmd+K) opens | Dialog appears on keystroke |
| REG-081 | Integration | Welcome video modal — shows once | Shows on first visit, not second |
| REG-082 | Integration | Welcome offer modal — shows once | Shows on first visit, not second |
| REG-083 | Contract | `motion-transfer` — auth required | 401 without token |
| REG-084 | Contract | `stylize-video` — auth required | 401 without token |
| REG-085 | Integration | Creators page — lists public profiles | profiles_public query returns data |

---

## 3) Route Regression Matrix

| Route | Auth | Load State | Empty State | Error State | Retry | Deep Link | 401/403 | 404 |
|-------|:----:|:----------:|:-----------:|:-----------:|:-----:|:---------:|:-------:|:---:|
| `/` | Public | ✅ Suspense+RouteContainer | N/A (static) | ✅ StabilityBoundary | N/A | ✅ | N/A | N/A |
| `/auth` | Public | ✅ | N/A | ✅ | N/A | ✅ | N/A | N/A |
| `/auth/callback` | Public | ✅ | N/A | ✅ | N/A | ✅ | N/A | N/A |
| `/forgot-password` | Public | ✅ | N/A | ✅ | N/A | ✅ | N/A | N/A |
| `/reset-password` | Public | ✅ | N/A | ✅ | N/A | ✅ | N/A | N/A |
| `/pricing` | Public | ✅ | ✅ (no packages) | ✅ | ✅ RQ | ✅ | N/A | N/A |
| `/how-it-works` | Public | ✅ | N/A | ✅ | N/A | ✅ | N/A | N/A |
| `/gallery` | Public | ✅ | ✅ | ✅ | ✅ RQ | ✅ | N/A | N/A |
| `/creators` | Public | ✅ | ✅ | ✅ | ✅ RQ | ✅ | N/A | N/A |
| `/user/:userId` | Public | ✅ | ✅ 404 | ✅ | ✅ RQ | ✅ | N/A | ✅ |
| `/video/:videoId` | Public | ✅ | ✅ 404 | ✅ | ✅ RQ | ✅ | N/A | ✅ |
| `/w/:slug` | Public | ✅ | ✅ 404 | ✅ | N/A | ✅ | N/A | ✅ |
| `/widget/:publicKey` | Public | ✅ | ✅ | ✅ | N/A | ✅ | N/A | N/A |
| `/blog` | Public | ✅ | N/A | ✅ | N/A | ✅ | N/A | N/A |
| `/press` | Public | ✅ | N/A | ✅ | N/A | ✅ | N/A | N/A |
| `/terms` | Public | ✅ | N/A | ✅ | N/A | ✅ | N/A | N/A |
| `/privacy` | Public | ✅ | N/A | ✅ | N/A | ✅ | N/A | N/A |
| `/contact` | Public | ✅ | N/A | ✅ | N/A | ✅ | N/A | N/A |
| `/help` | Public | ✅ | N/A | ✅ | N/A | ✅ | N/A | N/A |
| `/onboarding` | Protected | ✅ CinemaLoader | N/A | ✅ | N/A | ✅ | ✅ → /auth | N/A |
| `/projects` | Protected | ✅ | ✅ | ✅ | ✅ RQ | ✅ | ✅ → /auth | N/A |
| `/profile` | Protected | ✅ | N/A | ✅ | ✅ | ✅ | ✅ → /auth | N/A |
| `/settings` | Protected | ✅ | N/A | ✅ | ✅ | ✅ | ✅ → /auth | N/A |
| `/create` | Protected | ✅ | N/A | ✅ | N/A | ✅ | ✅ → /auth | N/A |
| `/avatars` | Protected | ✅ | ✅ | ✅ | ✅ RQ | ✅ | ✅ → /auth | N/A |
| `/script-review` | Protected | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ → /auth | N/A |
| `/production` | Protected | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ → /auth | N/A |
| `/production/:id` | Protected | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ → /auth | N/A |
| `/templates` | Protected | ✅ | ✅ | ✅ | ✅ RQ | ✅ | ✅ → /auth | N/A |
| `/training-video` | Protected | ✅ | N/A | ✅ | N/A | ✅ | ✅ → /auth | N/A |
| `/environments` | Protected | ✅ | N/A | ✅ | N/A | ✅ | ✅ → /auth | N/A |
| `/chat` | Protected | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ → /auth | N/A |
| `/editor` | Protected | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ → /auth | N/A |
| `/admin` | Protected+Admin | ✅ | N/A | ✅ | ✅ | ✅ | ✅ → /auth | N/A |
| `/extract-thumbnails` | Protected | ✅ | N/A | ✅ | N/A | ✅ | ✅ → /auth | N/A |
| `*` (catch-all) | Public | ✅ | ✅ NotFound | N/A | N/A | ✅ | N/A | ✅ |
| Redirects: `/studio`, `/social`, `/clips`, `/universes`, `/long-video`, `/pipeline/*`, `/scenes`, `/design-picker` | — | Instant redirect | — | — | — | ✅ | — | — |

---

## 4) API/Edge Contract Regression

### Auth Enforcement Summary (90 functions)

| Auth Pattern | Count | Functions |
|---|---|---|
| `validateAuth` (shared auth-guard) | 74 | Most production functions |
| Inline auth (getUser/getClaims) | 6 | stripe-webhook (signature), track-signup (public), log-widget-event (public), get-widget-config (public), cleanup-stale-drafts (service-role), admin-delete-auth-user (now migrated) |
| Public (no auth needed) | 4 | track-signup, log-widget-event, get-widget-config, stripe-webhook |
| Service-role only | 2 | cleanup-stale-drafts, pipeline-watchdog (cron) |

### Key Contract Tests

See REG-006 through REG-012 and REG-020 through REG-023 in Section 2.

### Error Contract (all edge functions)
```json
// Success shape
{ "success": true, ...data }

// Error shape  
{ "error": "User-safe message" }
// HTTP status: 400 (validation), 401 (auth), 403 (forbidden), 500 (internal)
```

### Idempotency Matrix

| Endpoint | Idempotent? | Mechanism |
|----------|:-----------:|-----------|
| `add_credits` RPC | ✅ | `stripe_payment_id` unique constraint |
| `stripe-webhook` | ✅ | Stripe event dedup via payment_intent |
| `upsert_video_clip` | ✅ | `ON CONFLICT (project_id, shot_index)` |
| `create-credit-checkout` | ⚠️ | No client-side dedup key — relies on Stripe session uniqueness |
| `delete-project` | ✅ | Deletes are naturally idempotent |
| `cancel-project` | ✅ | Status check prevents re-cancel |

---

## 5) State, Caching, Concurrency Regression

| Test | Type | Assertion |
|------|------|-----------|
| Double-click "Create Project" | Race | Only 1 project created (mutation.isPending guard) |
| Double-click "Buy Credits" | Race | Only 1 Stripe session created |
| Refresh during production | Persistence | Pipeline resumes from checkpoint (generation_checkpoint) |
| Stale project list after creation | Cache | `queryClient.invalidateQueries(['projects'])` fires |
| Multi-tab sign out | Session | All tabs redirect to /auth (onAuthStateChange listener) |
| Optimistic delete rollback | State | `useOptimistic` restores item on API failure |
| Race: profile fetch vs auth state change | Async | `mountedRef` prevents state update on unmounted component |
| Concurrent clip status polls | Network | `refetchInterval` in useQuery doesn't stack |

---

## 6) Security & Auth Regression

### Role-Based Access Matrix

| Resource | Anonymous | User | Admin |
|----------|:---------:|:----:|:-----:|
| `/projects` | ❌ → /auth | ✅ own only | ✅ all (via RPC) |
| `/admin` | ❌ → /auth | ❌ (useAdminAccess blocks) | ✅ |
| `delete-project` | ❌ 401 | ✅ own only | ✅ any |
| `admin-delete-auth-user` | ❌ 401 | ❌ 403 | ✅ |
| `admin_manage_role` | ❌ exception | ❌ exception (locked admin only) | ✅ (locked admin only) |
| `user_roles` table | ❌ RLS | ✅ read own | ✅ read all |
| `credit_transactions` | ❌ RLS | ✅ read own | ✅ read all |
| `profiles` | ❌ RLS | ✅ read/update own | ✅ read all |

### Server-Side Enforcement Tests
- REG-009: delete-project without auth → 401
- REG-010: delete-project wrong owner → 403
- REG-011: admin-delete-auth-user as non-admin → 403
- REG-018: DB trigger blocks admin role grant
- REG-019: DB trigger blocks admin role revocation
- REG-024/025: is_admin() function correctness

### Token/Session Tests
- Expired JWT → 401 from edge functions
- `security_version` mismatch → client-side forced logout
- `validate_session_stamp` returns false for stale version

### Data Leakage Tests
- `sanitize_stitch_error` trigger removes file paths, IPs, env vars
- `profiles_public` view excludes email, credits, settings
- Edge function error responses never include stack traces

---

## 7) Performance & Reliability Regression (Baseline)

| Metric | Target | Route/Endpoint |
|--------|--------|----------------|
| TTFB (HTML) | < 200ms | All routes |
| LCP (largest paint) | < 2.5s | `/`, `/projects`, `/create` |
| Route lazy load | < 1s per chunk | All lazy-loaded pages |
| Edge function response | < 3s | `generate-script`, `check-video-status` |
| Edge function response (generation) | < 30s | `hollywood-pipeline`, `continue-production` |
| Duplicate request detection | 0 duplicates | Check React Query dedup in network tab |
| Memory on route change | No growth after 10 navigations | `/projects` ↔ `/create` cycle |

### Retry/Backoff
- React Query default: 3 retries with exponential backoff
- Edge functions: no built-in retry (client-side only)
- Pipeline watchdog: 15-minute stall detection → auto-recovery

---

## 8) Automation Setup

### Frameworks
- **Unit/Integration:** Vitest + @testing-library/react (already configured)
- **Contract (edge functions):** Vitest + fetch against deployed functions
- **E2E:** Browser tool (Lovable built-in) for critical paths
- **DB assertions:** Supabase SQL queries via test helpers

### Folder Structure
```
src/
  test/
    setup.ts                    # Already exists
    helpers/
      supabase-test-client.ts   # Admin client for seeding
      auth-helpers.ts           # Sign in/out test utilities
    unit/
      creditSystem.test.ts      # REG-001 to REG-003
      useOptimistic.test.ts     # REG-004 to REG-005
    integration/
      auth-flow.test.ts         # REG-013 to REG-016
      credit-billing.test.ts    # REG-022
      route-smoke.test.ts       # REG-057, REG-058
    contract/
      edge-auth.test.ts         # REG-009 to REG-012, REG-020
      credit-idempotency.test.ts # REG-006, REG-007
supabase/
  functions/
    */index_test.ts             # Deno tests per function
```

### CI Pipeline Steps
1. `lint` — ESLint + TypeScript check
2. `unit` — Vitest unit tests (< 30s)
3. `integration` — Vitest integration tests (< 2min)
4. `contract` — Edge function contract tests (< 3min)
5. `e2e` — Critical path browser tests (< 10min)

### Test Data Strategy
- **Seed:** Use service-role client to create test users, projects, credits
- **Reset:** Delete test data by email pattern `test-*@genesis-test.com`
- **Isolation:** Each test suite uses unique user to avoid cross-contamination
- **Determinism:** Mock `Date.now()` for time-dependent tests, stub `Math.random()` for slug generation

---

## 9) Gating Rules

### Merge Requirements
| Suite | Required to Merge | Required for Release |
|-------|:-----------------:|:-------------------:|
| P0 (25 tests) | ✅ All pass | ✅ All pass |
| P1 (40 tests) | ⚠️ 95% pass | ✅ All pass |
| P2 (20 tests) | ❌ | ⚠️ 90% pass |
| Lint | ✅ | ✅ |
| Type check | ✅ | ✅ |

### Flake Policy
- Any test that fails > 2x in 10 runs is quarantined
- Quarantined tests must be fixed within 1 sprint
- Max 3 quarantined tests at any time

### Required Coverage Areas
- `src/lib/creditSystem.ts` — 100% function coverage
- `src/hooks/useOptimistic.ts` — 100% branch coverage
- `src/contexts/AuthContext.tsx` — signIn, signOut, refreshProfile covered
- All edge functions with `validateAuth` — at least 1 auth rejection test
- `user_roles` + `enforce_admin_lock` — full trigger coverage

---

## 10) Minimum Smoke Suite (10 tests, < 10 minutes)

| # | Test | Layer | Time |
|---|------|-------|------|
| 1 | Credit calculation correctness | Unit | 1s |
| 2 | Optimistic rollback on error | Unit | 1s |
| 3 | add_credits idempotency | Contract | 3s |
| 4 | delete-project requires auth | Contract | 2s |
| 5 | admin-delete-auth-user rejects non-admin | Contract | 2s |
| 6 | is_admin returns correct values | DB | 2s |
| 7 | Route redirects work (/studio → /create) | Integration | 2s |
| 8 | 404 page renders for unknown routes | Integration | 2s |
| 9 | Landing page renders without crash | Integration | 3s |
| 10 | Auth context provides expected interface | Unit | 1s |

**Total estimated: ~19 seconds (unit) + network latency for contract tests**
