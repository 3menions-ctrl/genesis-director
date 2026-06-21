# Admin Console Audit — Data Correctness & Broken Functions

**Date:** 2026-02-22
**Status:** Issues identified and fixed

---

## E) Mismatch & Risk Report — Issues Found & Fixed

### 1. CRITICAL: AdminCreditPackagesManager CRUD Blocked by RLS ✅ FIXED
- **Severity:** Critical
- **Evidence:** `AdminCreditPackagesManager.tsx` lines 186-189 — Create/Update/Delete all showed `toast.error('Package creation requires database admin access')` 
- **Impact:** Admin could not manage credit packages at all
- **Fix:** Created `admin_manage_credit_package` Security Definer RPC with admin check + audit logging. Updated component to call RPC.

### 2. HIGH: AdminContentModeration "Approve" Was a No-Op ✅ FIXED
- **Severity:** High  
- **Evidence:** `AdminContentModeration.tsx` line 152 — `toast.success('Video approved')` with no DB write
- **Impact:** Approving content had no effect — moderation status was never persisted
- **Fix:** Created `admin_moderate_content` Security Definer RPC. Added `moderation_status` column to `movie_projects`. All moderation actions (approve/hide/delete) now use the RPC with audit logging.

### 3. HIGH: AdminSystemConfig Not Persisted ✅ FIXED
- **Severity:** High
- **Evidence:** `AdminSystemConfig.tsx` line 95 — `toast.info('Configuration changes are session-only')`
- **Impact:** Feature flags, maintenance mode, and announcement banners were lost on page refresh
- **Fix:** Created `system_config` table with RLS (admin-only). Component now loads config on mount and persists via upsert on save.

### 4. HIGH: Cost Metrics Under-Reported Due to 1000-Row Limit ✅ FIXED
- **Severity:** High
- **Evidence:** `Admin.tsx` `fetchCostSummary()` and `fetchCalculatedApiCost()` — used `.select()` without pagination
- **Impact:** Once >1000 api_cost_logs exist, admin dashboard shows truncated cost figures (under-reporting expenses)
- **Fix:** Added pagination loops that fetch all rows in 1000-row batches.

### 5. HIGH: AdminProjectsBrowser Delete — No Audit Trail ✅ FIXED
- **Severity:** High
- **Evidence:** `AdminProjectsBrowser.tsx` line 154-171 — direct `supabase.from('movie_projects').delete()` with no audit log
- **Impact:** Project deletions by admin were untracked
- **Fix:** Replaced with `admin_moderate_content` RPC call which includes audit logging.

### 6. LOW: Admin test expected `getUser` but function uses `validateAuth` ✅ FIXED
- **Evidence:** `adminPanel.test.ts` line 447
- **Fix:** Updated regex to also match `validateAuth`.

---

## A) Admin Surface Map

| Tab | Component | Data Source | Admin Actions |
|-----|-----------|-------------|---------------|
| Overview | `Admin.tsx` inline | `get_admin_stats` RPC, `fetchCostSummary()` | Refresh, Force Logout All |
| Messages | `AdminMessageCenter` | `support_messages` table + realtime | Update status, Save notes, Delete, Reply via mailto |
| Users | `Admin.tsx` inline | `admin_list_users` RPC | Adjust credits, Grant/Revoke roles, Force logout |
| Gallery | `AdminGalleryManager` | `gallery_showcase` + hooks | Add, Edit, Delete, Reorder, Toggle active |
| Financials | `Admin.tsx` inline | `get_admin_profit_dashboard` RPC, `credit_transactions` | Refresh |
| Costs | `CostAnalysisDashboard` | `api_cost_logs`, `video_clips` | - |
| Projects | `AdminProjectsBrowser` | `admin_list_projects` RPC | View details, Watch video, Retry failed clips, Delete |
| Pipeline | `AdminPipelineMonitor` | `video_clips`, `api_cost_logs` | Auto-refresh toggle |
| Failed | `AdminFailedClipsQueue` | `video_clips` (status=failed) | Retry single/batch, Delete batch, Select all |
| Audit | `Admin.tsx` inline | `admin_audit_log` table | Refresh |
| Packages | `AdminCreditPackagesManager` | `credit_packages` + `admin_manage_credit_package` RPC | Create, Edit, Delete |
| Moderation | `AdminContentModeration` | `movie_projects` + `admin_moderate_content` RPC | Approve, Hide, Delete |
| Avatars | `AdminAvatarSeeder` | Avatar templates | Seed avatars |
| Avatar Gen | `AdminAvatarBatchV2` | Batch avatar generation | Generate batches |
| Config | `AdminSystemConfig` | `system_config` table | Save feature flags, maintenance mode, banners |

---

## B) Authorization Summary

All admin endpoints use `public.is_admin(auth.uid())` check via Security Definer functions:
- `get_admin_stats`, `admin_list_users`, `admin_list_projects`, `admin_adjust_credits`
- `admin_manage_role`, `admin_force_logout_user`, `admin_force_logout_all`
- `admin_get_audit_logs`, `admin_view_user_profile`, `get_admin_profit_dashboard`
- `admin_manage_credit_package` (NEW), `admin_moderate_content` (NEW)

The admin role is permanently locked to a single account via `enforce_admin_lock` trigger.

---

## Remaining Low-Priority Items (Not Fixed)

- **AdminPipelineMonitor service health**: Status badges are hardcoded to "operational" — no real health check endpoint exists. This is cosmetic.
- **AdminSystemConfig system status**: Same — hardcoded status indicators.
- **Revenue CREDIT_PRICE_CENTS**: Hardcoded to `10.0` cents/credit in `fetchActualRevenue`. Should ideally be derived from actual package prices.
