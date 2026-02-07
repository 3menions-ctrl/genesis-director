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

export const AdminOnlyDiagnostics = memo(function AdminOnlyDiagnostics() {
  const location = useLocation();
  
  // Only render on /admin route
  if (!location.pathname.startsWith('/admin')) {
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
