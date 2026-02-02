import { ReactNode, Suspense, forwardRef, memo } from 'react';
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
 * 
 * forwardRef is implemented for AnimatePresence compatibility
 */
export const RouteContainer = memo(forwardRef<HTMLDivElement, RouteContainerProps>(
  function RouteContainer({ children, fallbackMessage = 'Loading...', routeName }, ref) {
    return (
      <div ref={ref}>
        <StabilityBoundary 
          name={routeName || 'Page'} 
          autoRetry={false}  // DISABLED: Prevents retry loops during hydration issues
          maxRetries={0}     // No automatic retries - user must click "Try Again"
        >
          <Suspense fallback={<AppLoader message={fallbackMessage} />}>
            {children}
          </Suspense>
        </StabilityBoundary>
      </div>
    );
  }
));

RouteContainer.displayName = 'RouteContainer';

export default RouteContainer;