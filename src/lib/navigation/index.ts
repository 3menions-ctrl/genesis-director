/**
 * Navigation System - World-Class Page Transitions
 * 
 * Exports:
 * - NavigationCoordinator: Central lifecycle management
 * - Hooks: useRouteCleanup, useSafeNavigation, useNavigationState
 * - Components: SafeLink, NavigationGuardProvider
 */

export { 
  navigationCoordinator,
  NavigationCoordinatorImpl,
  type NavigationState,
  type CleanupFunction,
  type NavigationPhase,
  type CoordinatorOptions,
} from './NavigationCoordinator';

export {
  useRouteCleanup,
  useSafeNavigation,
  useNavigationState,
  useNavigationAbort,
  useMediaCleanup,
} from './hooks';

export {
  NavigationGuardProvider,
  useNavigationGuardContext,
} from './NavigationGuardProvider';

export {
  SafeLink,
} from './SafeLink';
