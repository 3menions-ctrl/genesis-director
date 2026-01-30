import { ReactNode, Suspense, Component, ErrorInfo } from 'react';
import { AppLoader } from '@/components/ui/app-loader';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RouteContainerProps {
  children: ReactNode;
  fallbackMessage?: string;
}

interface RouteErrorState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Inline Error Boundary specifically for route isolation.
 * Keeps each route crash-resistant without shared state.
 */
class RouteErrorBoundary extends Component<{ children: ReactNode }, RouteErrorState> {
  state: RouteErrorState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): RouteErrorState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RouteErrorBoundary] Caught error:', error.message);
    console.error('[RouteErrorBoundary] Stack:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">This page encountered an error</h1>
              <p className="text-muted-foreground text-sm">
                Don't worry, the rest of the app is still working.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleRetry} variant="default" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
              <Button onClick={this.handleHome} variant="outline" className="gap-2">
                <Home className="w-4 h-4" />
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * RouteContainer provides isolated error boundaries and suspense for each route.
 * This prevents crashes in one route from affecting the entire app.
 * Each route is fully isolated - a crash here won't break navigation.
 */
export function RouteContainer({ children, fallbackMessage = 'Loading...' }: RouteContainerProps) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<AppLoader message={fallbackMessage} />}>
        {children}
      </Suspense>
    </RouteErrorBoundary>
  );
}
