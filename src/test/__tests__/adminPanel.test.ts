/**
 * Admin Panel — Comprehensive Test Suite
 * 
 * Enterprise-grade tests modeled after OpenAI / Stripe internal dashboard QA.
 * Covers: security, access control, data integrity, UI consistency,
 * sidebar navigation, financial calculations, audit logging, and edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../..', relativePath), 'utf-8');
}

// ─── 1. SECURITY & ACCESS CONTROL ────────────────────────────────────────────
describe('Admin Panel — Security & Access Control', () => {
  // The admin gate moved out of the (deleted) monolithic src/pages/Admin.tsx
  // into the refine AdminLayout, which wraps every /admin route.
  const adminPage = readFile('src/refine/AdminLayout.tsx');
  const authContext = readFile('src/contexts/AuthContext.tsx');
  const adminAccessHook = readFile('src/hooks/useAdminAccess.ts');

  describe('Authentication Gate', () => {
    it('should verify admin status via server-side RPC, not client storage', () => {
      // Must use supabase.rpc('is_admin') — never localStorage for the role.
      expect(adminPage).toMatch(/supabase\.rpc\(['"]is_admin['"]/);
      expect(adminPage).not.toMatch(/localStorage\.getItem.*admin.*role/i);
      expect(adminPage).not.toMatch(/sessionStorage\.getItem.*admin/i);
    });

    it('should redirect non-admin users to home', () => {
      expect(adminPage).toMatch(/<Navigate\s+to=["']\/["']\s+replace/);
    });

    it('should block access when user is null or not admin', () => {
      expect(adminPage).toMatch(/!user\s*\|\|\s*!isAdmin/);
    });

    it('should show loading spinner while verifying admin status', () => {
      expect(adminPage).toMatch(/Verifying privileged access/);
      expect(adminPage).toContain('Loader2');
    });

    it('should set isAdmin to false on RPC error', () => {
      expect(adminPage).toMatch(/setIsAdmin\(false\)/);
      expect(adminPage).toMatch(/setIsAdmin\(error\s*\?\s*false/);
    });
  });

  describe('useAdminAccess Hook Security', () => {
    it('should validate fresh session before checking role', () => {
      expect(adminAccessHook).toMatch(/supabase\.auth\.getSession/);
    });

    it('should detect session user ID mismatch', () => {
      expect(adminAccessHook).toMatch(/session\.user\.id\s*!==\s*user\.id/);
      expect(adminAccessHook).toMatch(/Session user mismatch/);
    });

    it('should query user_roles table with RLS protection', () => {
      expect(adminAccessHook).toMatch(/from\(['"]user_roles['"]\)/);
      expect(adminAccessHook).toMatch(/\.eq\(['"]role['"],\s*['"]admin['"]\)/);
    });

    it('should implement request timeout for admin check', () => {
      expect(adminAccessHook).toMatch(/setTimeout.*5000/);
      expect(adminAccessHook).toMatch(/Promise\.race/);
    });

    it('should periodically re-verify admin status', () => {
      expect(adminAccessHook).toMatch(/REVERIFICATION_INTERVAL_MS/);
      expect(adminAccessHook).toMatch(/setInterval/);
    });

    it('should prevent concurrent verification requests', () => {
      expect(adminAccessHook).toMatch(/verificationInProgress\.current/);
    });

    it('should handle component unmount gracefully', () => {
      expect(adminAccessHook).toMatch(/mountedRef\.current\s*=\s*false/);
    });

    it('should never store admin status in localStorage', () => {
      expect(adminAccessHook).not.toMatch(/localStorage/);
      expect(adminAccessHook).not.toMatch(/sessionStorage/);
    });
  });

  describe('AuthContext Admin Integration', () => {
    it('should expose isAdmin from context', () => {
      expect(authContext).toMatch(/isAdmin:\s*boolean/);
    });

    it('should reset isAdmin on sign out', () => {
      // After sign out, isAdmin must be set to false
      expect(authContext).toMatch(/setIsAdmin\(false\)/);
    });

    it('should verify admin role via dedicated function, not profile column', () => {
      // Must use checkAdminRole function, not profile.role === 'admin'
      expect(authContext).toMatch(/checkAdminRole/);
    });
  });
});

// ─── 2. SIDEBAR NAVIGATION & ROUTING ─────────────────────────────────────────
describe('Admin Panel — Sidebar Navigation', () => {
  const sidebar = readFile('src/components/admin/AdminSidebar.tsx');
  // Tab content is no longer switched inside one page — each admin surface is a
  // route rendered by the self-contained admin module (src/admin/AdminApp.tsx).
  const adminPage = readFile('src/admin/AdminApp.tsx');

  const expectedTabs = [
    'overview', 'messages', 'users', 'gallery',
    'financials', 'costs', 'projects', 'pipeline',
    'failed', 'audit', 'packages', 'moderation',
    'avatars', 'config',
  ];

  it('should define all required navigation tabs', () => {
    for (const tab of expectedTabs) {
      expect(sidebar).toContain(`id: '${tab}'`);
    }
  });

  it('should organize tabs into logical groups', () => {
    const groups = ['main', 'finance', 'production', 'system'];
    for (const group of groups) {
      expect(sidebar).toContain(`id: '${group}'`);
    }
  });

  it('should show message badge when count > 0', () => {
    expect(sidebar).toMatch(/item\.badge\s*&&\s*messageCount\s*>\s*0/);
  });

  it('should cap badge display at 99+', () => {
    expect(sidebar).toMatch(/messageCount\s*>\s*99\s*\?\s*['"]99\+['"]/);
  });

  it('should highlight active tab with primary styling', () => {
    expect(sidebar).toMatch(/isActive[\s\S]*sidebar-primary/);
  });

  it('should show tooltips in collapsed mode', () => {
    expect(sidebar).toContain('TooltipContent');
    expect(sidebar).toMatch(/side=["']right["']/);
  });

  it('should render every admin surface via React Router routes', () => {
    expect(adminPage).toMatch(/<Routes>/);
    expect((adminPage.match(/<Route\b/g) ?? []).length).toBeGreaterThan(10);
  });

  it('should support sidebar expand/collapse toggle', () => {
    expect(sidebar).toMatch(/setExpanded/);
    expect(sidebar).toContain('ChevronLeft');
    expect(sidebar).toContain('ChevronRight');
  });
});

// ─── 3. DATA FETCHING & INTEGRITY ────────────────────────────────────────────
describe('Admin Panel — Data Fetching & Integrity', () => {
  // Data fetching was split out of the monolith into per-surface refine pages.
  const dashboardPage = readFile('src/refine/pages/AdminDashboardPage.tsx');
  const usersPage = readFile('src/refine/pages/AdminUsersPage.tsx');
  const financePage = readFile('src/refine/pages/AdminFinancialsPage.tsx');
  const auditPage = readFile('src/refine/pages/ops/AdminAuditLogPage.tsx');
  const messagesPage = readFile('src/refine/pages/AdminMessagesPage.tsx');

  it('should fetch dashboard stats via a dedicated admin RPC', () => {
    expect(dashboardPage).toMatch(/supabase\.rpc\(['"]admin_dashboard_pulse['"]/);
  });

  it('should fetch users via admin_list_users RPC with pagination', () => {
    expect(usersPage).toMatch(/supabase\.rpc\(['"]admin_list_users['"]/);
    expect(usersPage).toMatch(/p_limit/);
    expect(usersPage).toMatch(/p_offset/);
    expect(usersPage).toMatch(/p_search/);
  });

  it('should fetch financial data via admin RPC', () => {
    expect(financePage).toMatch(/supabase\.rpc\(['"]get_admin_profit_dashboard['"]\)/);
  });

  it('should fetch audit logs via a dedicated audit RPC', () => {
    expect(auditPage).toMatch(/admin_get_audit_logs/);
  });

  it('should fetch support messages from the support_messages table', () => {
    expect(messagesPage).toMatch(/from\(['"]support_messages['"]\)/);
  });

  it('should keep admin inbox counts live via realtime subscription', () => {
    expect(messagesPage).toMatch(/postgres_changes/);
    expect(messagesPage).toMatch(/\.subscribe\(\)/);
  });

  it('should show toast errors on data fetch failures', () => {
    expect(usersPage).toMatch(/toast\.error\(['"]Failed to load users['"]\)/);
  });
});

// ─── 4. FINANCIAL CALCULATIONS ───────────────────────────────────────────────
describe('Admin Panel — Financial Calculations', () => {
  // Cost/profit math lives in the cost-analysis dashboard component and the
  // refine financials page (the monolithic page that owned it was removed).
  const costDashboard = readFile('src/components/admin/CostAnalysisDashboard.tsx');
  const financePage = readFile('src/refine/pages/AdminFinancialsPage.tsx');

  it('should compute API costs from real usage data', () => {
    expect(costDashboard.length).toBeGreaterThan(0);
    expect(costDashboard).toMatch(/calculated_cost_cents/);
  });

  // Revenue & profit calculation assertions are suspended while Small Bridges is in
  // beta — there is no Stripe revenue today (free during beta). These ran
  // against AdminAnalyticsPage's `actualStripeRevenue` symbol which is
  // re-introduced when paid plans return.
  it.skip('should calculate profit as revenue minus API cost', () => {
    expect(financePage).toMatch(/actualStripeRevenue\s*-\s*calculatedApiCost/);
  });

  it.skip('should calculate profit margin percentage', () => {
    expect(financePage).toMatch(/totalProfit\s*\/\s*actualStripeRevenue.*\*\s*100/);
  });

  it.skip('should handle zero revenue without division by zero', () => {
    expect(financePage).toMatch(/actualStripeRevenue\s*>\s*0/);
  });

  it('should account for retries in total cost', () => {
    expect(costDashboard).toMatch(/retry|retries/i);
  });

  it('should calculate waste percentage from failed operations', () => {
    expect(costDashboard).toMatch(/wastePercentage/);
    expect(costDashboard).toMatch(/failedApiCost/);
  });

  it('should track wasted spend from failed/retried operations', () => {
    expect(costDashboard).toMatch(/totalWastedCostCents|wastedCosts/);
  });

  it('should format currency correctly using Intl.NumberFormat', () => {
    expect(costDashboard).toMatch(/Intl\.NumberFormat\(['"]en-US['"]/);
    expect(costDashboard).toMatch(/style:\s*['"]currency['"]/);
  });
});

// ─── 5. USER MANAGEMENT ──────────────────────────────────────────────────────
describe('Admin Panel — User Management', () => {
  const adminPage = readFile('src/refine/pages/AdminUsersPage.tsx');

  it('should support credit adjustment via RPC', () => {
    expect(adminPage).toMatch(/supabase\.rpc\(['"]admin_adjust_credits['"]/);
    expect(adminPage).toMatch(/p_target_user_id/);
    expect(adminPage).toMatch(/p_amount/);
    expect(adminPage).toMatch(/p_reason/);
  });

  it('should validate credit adjustment input', () => {
    expect(adminPage).toMatch(/isNaN\(amount\)\s*\|\|\s*amount\s*===\s*0/);
    expect(adminPage).toMatch(/Please fill in all fields/);
    expect(adminPage).toMatch(/Enter a valid amount/);
  });

  it('should support admin role grant and revoke', () => {
    expect(adminPage).toMatch(/supabase\.rpc\(['"]admin_manage_role['"]/);
    expect(adminPage).toMatch(/p_action:\s*action/);
  });

  it('should prevent self-revocation of admin role', () => {
    expect(adminPage).toMatch(/targetUser\.id\s*===\s*user\?\.id/);
    expect(adminPage).toMatch(/cannot remove your own admin role/);
  });

  it('should support user search filtering', () => {
    expect(adminPage).toMatch(/userSearch/);
    expect(adminPage).toMatch(/p_search:\s*userSearch/);
  });

  it('should refresh user list after credit adjustment', () => {
    // After successful credit adjustment, fetchUsers should be called
    expect(adminPage).toMatch(/toast\.success.*Credits.*\n.*fetchUsers/s);
  });
});

// ─── 6. SUPPORT MESSAGE MANAGEMENT ───────────────────────────────────────────
describe('Admin Panel — Support Messages', () => {
  // Message management lives in the AdminMessageCenter component (rendered by
  // the refine AdminMessagesPage).
  const adminPage = readFile('src/components/admin/AdminMessageCenter.tsx');

  it('should support updating message status', () => {
    expect(adminPage).toMatch(/updateMessageStatus/);
    expect(adminPage).toMatch(/\.update\(\{\s*status,/);
  });

  it('should support deleting messages', () => {
    expect(adminPage).toMatch(/deleteMessage/);
    expect(adminPage).toMatch(/\.delete\(\)/);
  });

  it('should count new/unread messages', () => {
    expect(adminPage).toMatch(/messages\.filter\(\(m\)\s*=>\s*m\.status\s*===\s*['"]new['"]\)\.length/);
  });

  it('should show success toast after status update', () => {
    expect(adminPage).toMatch(/Message marked as/);
  });

  it('should refresh the message list via realtime subscription after mutations', () => {
    // Mutations write to support_messages and the open realtime channel
    // re-syncs the list (replacing the old manual fetchMessages() re-fetch).
    expect(adminPage).toMatch(/postgres_changes/);
    expect(adminPage).toMatch(/\.subscribe\(\)/);
  });
});

// ─── 7. COMPONENT ARCHITECTURE ───────────────────────────────────────────────
describe('Admin Panel — Component Architecture', () => {
  // The admin console is now a self-contained module wrapped by RefineAdminLayout.
  const adminApp = readFile('src/admin/AdminApp.tsx');
  const dashboardPage = readFile('src/refine/pages/AdminDashboardPage.tsx');
  const adminDir = fs.readdirSync(path.resolve(__dirname, '../../../src/components/admin'));

  const expectedComponents = [
    'AdminSidebar',
    'CostAnalysisDashboard',
    'AdminProjectsBrowser',
    'AdminPipelineMonitor',
    'AdminFailedClipsQueue',
    'AdminCreditPackagesManager',
    'AdminPricingConfigEditor',
    'AdminTierLimitsEditor',
    'AdminContentModeration',
    'AdminSystemConfig',
    'AdminMessageCenter',
    'AdminAvatarSeeder',
    'AdminAvatarBatchV2',
    'AdminGalleryManager',
  ];

  it('should define each admin sub-component in its own file', () => {
    for (const comp of expectedComponents) {
      const src = readFile(`src/components/admin/${comp}.tsx`);
      expect(src, `${comp}.tsx should reference ${comp}`).toContain(comp);
    }
  });

  it('should have all admin component files present on disk', () => {
    for (const comp of expectedComponents) {
      const fileName = `${comp}.tsx`;
      expect(adminDir).toContain(fileName);
    }
  });

  it('should use default export for the admin dashboard page', () => {
    expect(dashboardPage).toMatch(/export\s+default\s+function\s+AdminDashboardPage/);
  });

  it('should wrap every admin surface in the RefineAdminLayout chrome', () => {
    expect(adminApp).toContain('RefineAdminLayout');
  });
});

// ─── 8. DIAGNOSTICS & DEBUG OVERLAY ──────────────────────────────────────────
describe('Admin Panel — Diagnostics Access Control', () => {
  const diagnosticsSettings = readFile('src/components/diagnostics/DiagnosticsSettings.tsx');
  const debugOverlay = readFile('src/components/diagnostics/DebugOverlay.tsx');
  const adminDiag = readFile('src/components/diagnostics/AdminOnlyDiagnostics.tsx');

  it('should restrict DiagnosticsSettings to admin users', () => {
    expect(diagnosticsSettings).toMatch(/useAdminAccess/);
    expect(diagnosticsSettings).toMatch(/!isAdmin/);
    expect(diagnosticsSettings).toContain('Admin Access Required');
  });

  it('should restrict DebugOverlay to admin users', () => {
    expect(debugOverlay).toMatch(/useAdminAccess/);
    expect(debugOverlay).toMatch(/ADMIN ONLY/);
  });

  it('should only render diagnostics on /admin route', () => {
    expect(adminDiag).toMatch(/location\.pathname\.startsWith\(['"]\/admin['"]\)/);
  });

  it('should show loading state while checking admin status in diagnostics', () => {
    expect(diagnosticsSettings).toMatch(/adminLoading/);
    expect(diagnosticsSettings).toContain('Loader2');
  });

  it('should support export of all diagnostic data', () => {
    expect(diagnosticsSettings).toMatch(/handleExportAll/);
    expect(diagnosticsSettings).toMatch(/application\/json/);
    expect(diagnosticsSettings).toMatch(/system-diagnostics/);
  });

  it('should support clearing diagnostic history', () => {
    expect(diagnosticsSettings).toMatch(/handleClearAll/);
    expect(diagnosticsSettings).toMatch(/clearDiagnostics/);
    expect(diagnosticsSettings).toMatch(/clearStateHistory/);
  });
});

// ─── 9. ADMIN HEADER VISIBILITY ──────────────────────────────────────────────
describe('Admin Panel — Access Entry Point', () => {
  // The standalone admin console replaced the in-app "Admin Panel" link. The
  // app shell now routes admins straight into /admin instead of rendering a link.
  const shell = readFile('src/components/shell/AppShell.tsx');

  it('should detect admin status from auth context', () => {
    expect(shell).toMatch(/isAdmin/);
  });

  it('should route admins into the admin console', () => {
    expect(shell).toMatch(/<Navigate\s+to=["']\/admin["']\s+replace/);
  });

  it('should gate the admin surface behind ADMIN_ENABLED', () => {
    expect(shell).toMatch(/ADMIN_ENABLED/);
  });

  it('should not redirect when already on an /admin path', () => {
    expect(shell).toMatch(/location\.pathname\.startsWith\(['"]\/admin['"]\)/);
  });
});

// ─── 10. DATA EXPORT (GDPR) ─────────────────────────────────────────────────
describe('Admin Panel — Data Export Compliance', () => {
  const exportFn = readFile('supabase/functions/export-user-data/index.ts');

  it('should require authorization header', () => {
    expect(exportFn).toMatch(/Missing authorization header/);
    expect(exportFn).toMatch(/status:\s*401/);
  });

  it('should authenticate the requesting user', () => {
    expect(exportFn).toMatch(/validateAuth|supabase\.auth\.getUser|supabase\.auth\.getClaims/);
  });

  it('should export all user-owned data tables', () => {
    const requiredTables = [
      'profiles', 'movie_projects', 'video_clips',
      'credit_transactions', 'characters', 'universes', 'project_templates',
    ];
    for (const table of requiredTables) {
      expect(exportFn).toContain(`'${table}'`);
    }
  });

  it('should include summary statistics in export', () => {
    expect(exportFn).toMatch(/totalProjects/);
    expect(exportFn).toMatch(/totalVideoClips/);
    expect(exportFn).toMatch(/creditsBalance/);
  });

  it('should set Content-Disposition for file download', () => {
    expect(exportFn).toMatch(/Content-Disposition.*attachment.*filename/);
  });

  it('should use parallel data fetching for performance', () => {
    expect(exportFn).toMatch(/Promise\.all/);
  });

  it('should handle CORS preflight requests', () => {
    expect(exportFn).toMatch(/req\.method\s*===\s*['"]OPTIONS['"]/);
  });
});

// ─── 11. TIER LIMITS & PRICING ───────────────────────────────────────────────
describe('Admin Panel — Tier Limits Integration', () => {
  const tierLimits = readFile('src/hooks/useTierLimits.ts');

  it('should fetch tier limits via dedicated RPC', () => {
    expect(tierLimits).toMatch(/supabase\.rpc\(['"]get_user_tier_limits['"]/);
  });

  it('should implement timeout for tier limit fetch', () => {
    expect(tierLimits).toMatch(/setTimeout.*8000/);
    expect(tierLimits).toMatch(/Promise\.race/);
  });

  it('should fallback to profile tier on RPC failure', () => {
    expect(tierLimits).toMatch(/from\(['"]profiles['"]\)/);
    expect(tierLimits).toMatch(/account_tier/);
  });

  it('should provide safe defaults for all tier properties', () => {
    expect(tierLimits).toMatch(/DEFAULT_TIER_LIMITS\.free/);
    expect(tierLimits).toMatch(/maxClips.*\?\?\s*6/);
    expect(tierLimits).toMatch(/maxRetries.*\?\?\s*1/);
  });

  it('should cache tier limits for 5 minutes', () => {
    expect(tierLimits).toMatch(/staleTime:\s*5\s*\*\s*60\s*\*\s*1000/);
  });

  it('should limit retries to prevent hanging', () => {
    expect(tierLimits).toMatch(/retry:\s*1/);
  });
});

// ─── 12. ERROR HANDLING PATTERNS ─────────────────────────────────────────────
describe('Admin Panel — Error Handling', () => {
  const errorHandling = readFile('src/types/error-handling.ts');

  it('should provide type-safe error extraction', () => {
    expect(errorHandling).toMatch(/function getErrorMessage/);
    expect(errorHandling).toMatch(/error instanceof Error/);
  });

  it('should provide isErrorLike type guard', () => {
    expect(errorHandling).toMatch(/function isErrorLike/);
    expect(errorHandling).toMatch(/typeof value === ['"]object['"]/);
  });

  it('should support API error parsing', () => {
    expect(errorHandling).toMatch(/function parseApiError/);
  });

  it('should provide assertNever for exhaustive switches', () => {
    expect(errorHandling).toMatch(/function assertNever/);
  });

  it('should define AppError interface with standard fields', () => {
    expect(errorHandling).toMatch(/interface AppError/);
    expect(errorHandling).toMatch(/message:\s*string/);
    expect(errorHandling).toMatch(/code\?:\s*string/);
    expect(errorHandling).toMatch(/status\?:\s*number/);
  });
});

// ─── 13. CROSS-CUTTING SECURITY PATTERNS ─────────────────────────────────────
describe('Admin Panel — Cross-Cutting Security', () => {
  const layout = readFile('src/refine/AdminLayout.tsx');
  const usersPage = readFile('src/refine/pages/AdminUsersPage.tsx');

  it('should never expose raw user IDs in UI text', () => {
    // The users surface renders email/display name, not raw `{user.id}` UUIDs.
    expect(usersPage).not.toMatch(/\{user\.id\}(?!.*key)/);
  });

  it('should not hardcode any API keys or secrets', () => {
    expect(usersPage).not.toMatch(/sk_live_/);
    expect(usersPage).not.toMatch(/sk_test_/);
    expect(usersPage).not.toMatch(/Bearer\s+[A-Za-z0-9]{20,}/);
  });

  it('should use Navigate component for redirects (not window.location)', () => {
    expect(layout).toContain('<Navigate');
    expect(layout).not.toMatch(/window\.location\s*=/);
  });

  it('should guard every admin surface behind the layout admin check', () => {
    // The shared layout gates all /admin routes — non-admins never render a page.
    expect(layout).toMatch(/if\s*\(!user\s*\|\|\s*!isAdmin\)\s*return/);
  });

  it('should validate credit adjustment amount is a number', () => {
    expect(usersPage).toMatch(/parseInt\(creditDialog\.amount,\s*10\)/);
    expect(usersPage).toMatch(/isNaN\(amount\)/);
  });
});
