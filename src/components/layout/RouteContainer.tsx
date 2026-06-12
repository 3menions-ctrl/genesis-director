import { ReactNode, Suspense, forwardRef, memo } from 'react';
import { AppLoader } from '@/components/ui/app-loader';
import { StabilityBoundary } from '@/components/stability/StabilityBoundary';

interface RouteContainerProps {
  children: ReactNode;
  fallbackMessage?: string;
  /**
   * Optional layout-correct skeleton to render while the route chunk loads.
   * When supplied, this replaces the generic AppLoader for the Suspense
   * fallback — the resulting cross-dissolve feels like "the page filling in"
   * instead of "blank flash then content".
   */
  skeleton?: ReactNode;
  /** Route name for error reporting */
  routeName?: string;
}

/**
 * RouteContainer provides isolated error boundaries and suspense for each route.
 * This prevents crashes in one route from affecting the entire app.
 * Each route is fully isolated - a crash here won't break navigation.
 *
 * ANTI-BLINK: Uses CSS animate-fade-in so content appears smoothly
 * without the flash caused by individual motion.div opacity:0 → 1 transitions.
 */
export const RouteContainer = memo(forwardRef<HTMLDivElement, RouteContainerProps>(
  function RouteContainer({ children, fallbackMessage = 'Loading…', skeleton, routeName }, ref) {
    const fallback = skeleton ?? <AppLoader message={fallbackMessage} />;
    return (
      <div ref={ref} className="animate-route-enter">
        <StabilityBoundary
          name={routeName || 'Page'}
          autoRetry={false}
          maxRetries={0}
        >
          <Suspense fallback={fallback}>
            {children}
          </Suspense>
        </StabilityBoundary>
      </div>
    );
  }
));

RouteContainer.displayName = 'RouteContainer';

export default RouteContainer;
