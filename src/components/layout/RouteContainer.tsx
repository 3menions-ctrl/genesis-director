import { ReactNode, Suspense } from 'react';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { AppLoader } from '@/components/ui/app-loader';

interface RouteContainerProps {
  children: ReactNode;
  fallbackMessage?: string;
}

/**
 * RouteContainer provides isolated error boundaries and suspense for each route.
 * This prevents crashes in one route from affecting the entire app.
 */
export function RouteContainer({ children, fallbackMessage = 'Loading...' }: RouteContainerProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<AppLoader message={fallbackMessage} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
