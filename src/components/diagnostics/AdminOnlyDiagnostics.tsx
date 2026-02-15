/**
 * AdminOnlyDiagnostics - Wrapper that only renders diagnostics on /admin route
 * 
 * Debug console and crash forensics are admin-only tools that should not
 * clutter the UI on regular pages.
 */

import { memo } from 'react';
import { useLocation } from 'react-router-dom';
import { DebugOverlay } from './DebugOverlay';
import { CrashForensicsOverlay } from './CrashForensicsOverlay';
import { getSafeModeStatus } from '@/lib/safeMode';
import { useAdminAccess } from '@/hooks/useAdminAccess';

export const AdminOnlyDiagnostics = memo(function AdminOnlyDiagnostics() {
  const location = useLocation();
  const { isAdmin, loading: adminLoading } = useAdminAccess();
  
  // Only render on /admin route AND only for verified admins
  // Path check prevents unnecessary admin queries on every page
  // Admin check prevents non-admins from seeing diagnostics during redirect
  if (!location.pathname.startsWith('/admin')) {
    return null;
  }
  
  // Block rendering until admin status is confirmed server-side
  if (adminLoading || !isAdmin) {
    return null;
  }
  
  return (
    <>
      <DebugOverlay />
      <CrashForensicsOverlay alwaysShow={getSafeModeStatus()} />
    </>
  );
});

AdminOnlyDiagnostics.displayName = 'AdminOnlyDiagnostics';

export default AdminOnlyDiagnostics;
