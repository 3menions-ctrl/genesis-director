# TEST MATRIX

Mapping of processes to test coverage. Status: EXISTS / MISSING / PARTIAL

## Coverage Summary
- **Total Processes**: 78
- **Covered by Tests**: 42 (54%)
- **Missing Coverage**: 36 (46%)
- **P0 Blockers Covered**: 14/16 (88%)

---

## EXISTING TEST COVERAGE

| Process ID | Test File | Test Cases | Type | Status |
|------------|-----------|------------|------|--------|
| P001-P032 (Routes) | `src/components/stability/__tests__/navigationGuardRails.test.ts` | 16 cases | Static | EXISTS |
| P001-P032 (Architecture) | `src/components/stability/__tests__/architectureAudit.test.ts` | 33 cases | Static | EXISTS |
| P001-P032 (Performance) | `src/components/stability/__tests__/performanceAudit.test.ts` | 18 cases | Static | EXISTS |
| P001-P032 (UI Perf) | `src/components/stability/__tests__/uiPerformanceAudit.test.ts` | 45 cases | Static | EXISTS |
| P001-P032 (Regression) | `src/components/stability/__tests__/qaAuditRegression.test.ts` | 26 cases | Static | EXISTS |
| P001-P032 (Stability) | `src/components/stability/__tests__/stabilityRegression.test.ts` | 30 cases | Static | EXISTS |
| P001-P032 (forwardRef) | `src/components/stability/__tests__/forwardRefAudit.test.ts` | 9 cases | Static | EXISTS |
| P040 (Avatar Voices) | `src/hooks/__tests__/useAvatarVoices.test.ts` | 12 cases | Unit | EXISTS |
| P* (Async Safety) | `src/hooks/__tests__/useStableAsync.test.ts` | 12 cases | Unit | EXISTS |
| P039 (Generate Avatar) | `supabase/functions/generate-avatar/index_test.ts` | 3 cases | Integration | EXISTS |

**Total Existing Tests: 177 + 27 = 204 tests**

---

## MISSING TEST COVERAGE (P0/P1 Priority)

| Process ID | Name | Required Tests | Priority |
|------------|------|----------------|----------|
| P002 | User Sign Up | E2E auth flow | P0 |
| P003 | User Sign In | E2E auth flow | P0 |
| P007 | Project List | CRUD operations | P0 |
| P008 | Create Project | Mode router integration | P0 |
| P009 | Text-to-Video | Full pipeline | P0 |
| P010 | Avatar Creation | Pipeline + state | P0 |
| P011 | Production Monitor | Realtime updates | P0 |
| P018 | Credit Purchase | Stripe webhook | P0 |
| P019 | Admin Dashboard | Role verification | P0 |
| P033 | Mode Router | All modes | P0 |
| P044 | Simple Stitch | Video assembly | P0 |
| P053 | Stripe Webhook | Payment flow | P0 |
| P057 | Delete Account | GDPR compliance | P0 |
| P004 | Password Reset | Email flow | P1 |
| P006 | Onboarding | State transitions | P1 |
| P012 | Script Review | Approval flow | P1 |
| P032 | Sign Out | Session cleanup | P1 |
| P046 | Check Status | Polling | P1 |
| P047 | Retry Clip | Recovery | P1 |
| P075 | Auto Stitch | Trigger logic | P1 |
| P076 | Watchdog | Timeout handling | P1 |

---

## TEST GENERATION PLAN

### Phase 1: E2E Auth Tests (P0)
- [ ] `src/test/e2e/auth.test.ts` - Sign up, sign in, sign out
- [ ] `src/test/e2e/protected-routes.test.ts` - Route guards

### Phase 2: Core Flow Integration (P0)
- [ ] `src/test/integration/project-crud.test.ts` - Projects CRUD
- [ ] `src/test/integration/creation-flow.test.ts` - Create → Production
- [ ] `src/test/integration/payment-flow.test.ts` - Credits purchase

### Phase 3: Edge Function Tests (P0)
- [ ] `supabase/functions/mode-router/index_test.ts` - Mode routing
- [ ] `supabase/functions/simple-stitch/index_test.ts` - Video assembly
- [ ] `supabase/functions/stripe-webhook/index_test.ts` - Payment processing

### Phase 4: State & Recovery (P1)
- [ ] `src/test/integration/pipeline-recovery.test.ts` - Resume, retry
- [ ] `src/test/integration/realtime-updates.test.ts` - Subscription handling
