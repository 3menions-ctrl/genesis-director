import { ReactNode, Suspense } from 'react';
import { AppLoader } from '@/components/ui/app-loader';
import { StabilityBoundary } from '@/components/stability/StabilityBoundary';

interface RouteContainerProps {
  children: ReactNode;
  fallbackMessage?: string;
  /** Route name for error reporting */
  routeName?: string;
}

/**
 * RouteContainer provides isolated error boundaries and suspense for each route.
 * This prevents crashes in one route from affecting the entire app.
 * Each route is fully isolated - a crash here won't break navigation.
 * 
 * Uses StabilityBoundary for:
 * - Error classification and targeted recovery
 * - Automatic retry for transient errors
 * - Structured error logging
 */
export function RouteContainer({ 
  children, 
  fallbackMessage = 'Loading...', 
  routeName 
}: RouteContainerProps) {
  return (
    <StabilityBoundary 
      name={routeName || 'Page'} 
      autoRetry={true}
      maxRetries={1}
    >
      <Suspense fallback={<AppLoader message={fallbackMessage} />}>
        {children}
      </Suspense>
    </StabilityBoundary>
  );
}