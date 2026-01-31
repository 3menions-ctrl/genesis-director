/**
 * Diagnostics Components - Centralized exports
 * 
 * NOTE: All diagnostic components require admin access in production.
 * Components use useAdminAccess hook to verify permissions server-side.
 */

export { DebugOverlay } from './DebugOverlay';
export { HealthCheckDashboard } from './HealthCheckDashboard';
export { DiagnosticsSettings } from './DiagnosticsSettings';
