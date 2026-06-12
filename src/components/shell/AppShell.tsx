/**
 * AppShell — DEPRECATED as a left-rail layout. Now a thin
 * Foundation pass-through.
 *
 * Originally the AppShell was a 700-line left rail + topbar + workspace
 * switcher. As the app converged on the Foundation design language
 * (editorial top bar, Cmd+K command center, no left rail), the rail
 * became redundant — Cmd+K is the front door.
 *
 * This file is kept under the legacy import path (`@/components/shell`)
 * so the ~25 routes that still wrap their pages in <AppShell> don't all
 * need a coordinated rewrite. Each one now silently renders inside
 * FoundationShell instead.
 *
 * Preserved behaviors:
 *   - Admin auto-redirect: admins land on /admin and stay there; they
 *     don't browse the personal-creator surfaces by default. (The
 *     legacy rail enforced this at line 140; same logic lives here.)
 *   - Pending video recovery: surfaced as a toast on every authenticated
 *     surface so a render that died mid-session can be re-armed.
 *
 * Visual identity is now entirely Foundation. No rail. No topbar
 * different from Foundation's. One room.
 */
import { ReactNode } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { FoundationShell } from '@/components/foundation/FoundationShell';
import { usePendingVideoRecovery } from '@/hooks/usePendingVideoRecovery';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isAdmin } = useAuth();
  const location = useLocation();
  usePendingVideoRecovery();

  // Admin auto-redirect — admins live in /admin. If they end up on a
  // personal surface (typically via a deep link or legacy bookmark),
  // bounce them home so the admin console stays the single point of
  // truth for the admin role.
  if (isAdmin && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin" replace />;
  }

  return <FoundationShell>{children}</FoundationShell>;
}

export default AppShell;
