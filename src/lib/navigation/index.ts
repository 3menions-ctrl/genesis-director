/**
 * Navigation System - Unified World-Class Page Transitions
 * 
 * SINGLE SOURCE OF TRUTH for all navigation and stability utilities.
 * Import everything from here: import { useStabilityGuard, useSafeNavigation } from '@/lib/navigation';
 * 
 * Architecture:
 * - NavigationCoordinator: Core lifecycle manager (locking, cleanup registry, abort pool)
 * - UnifiedHooks: All stability/navigation hooks consolidated
 * - NavigationBridge: Syncs with NavigationLoadingContext for UI feedback
 * - SafeLink: Navigation-aware Link component
 */

// ============= Core Coordinator =============
export { 
  navigationCoordinator,
  NavigationCoordinatorImpl,
  type NavigationState,
  type CleanupFunction,
  type NavigationPhase,
  type CoordinatorOptions,
  type CleanupSummary,
} from './NavigationCoordinator';

// ============= Unified Hooks (consolidated from multiple files) =============
export {
  // Core stability
  useMountSafe,
  useStabilityGuard,
  useSafeState,
  useDebouncedValue,
  
  // Navigation-aware
  useRouteCleanup,
  useSafeNavigation,
  useNavigationAbort,
  useNavigationSafeAsync,
  useMediaCleanup,
  
  // Memory management
  useComponentCleanup,
  useNavigationMetrics,
  
  // Utilities
  isAbortError,
  
  // Legacy aliases for migration
  useNavigationGuard,
  useMountGuard,
} from './unifiedHooks';

// ============= Provider Components =============
export {
  NavigationGuardProvider,
  useNavigationGuardContext,
} from './NavigationGuardProvider';

export { 
  NavigationBridge, 
  useCoordinatedNavigation, 
  useCoordinatedReady,
} from './NavigationBridge';

// ============= UI Components =============
export { SafeLink } from './SafeLink';

// ============= Navigation State Hook =============
// Re-export useNavigationState from unifiedHooks
export { useNavigationState } from './unifiedHooks';
