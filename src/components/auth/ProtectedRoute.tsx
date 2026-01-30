import { ReactNode, useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLoader } from '@/components/ui/app-loader';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * ProtectedRoute with stability optimizations to prevent blinking:
 * 1. Tracks if children have ever rendered to prevent loader flashing on navigation
 * 2. Uses refs to avoid unnecessary re-renders
 * 3. Separates initial load from ongoing auth changes
 * 4. Shows loader during redirects instead of null to prevent flash
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, loading, session, isSessionVerified, profileError, retryProfileFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Track if we've already rendered children to prevent blink on navigation
  const hasRenderedChildren = useRef(false);
  // Track if this is the initial mount
  const [isInitialMount, setIsInitialMount] = useState(true);
  // Track the initial path to detect navigation
  const initialPathRef = useRef(location.pathname);

  // Memoize session check to prevent unnecessary recalculations
  const hasSessionInState = useMemo(() => !!session || !!user, [session, user]);

  // Mark initial mount complete after first render with valid session
  useEffect(() => {
    if (isSessionVerified && hasSessionInState && profile) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => setIsInitialMount(false), 50);
      return () => clearTimeout(timer);
    }
  }, [isSessionVerified, hasSessionInState, profile]);

  // Detect navigation away from initial path - if we navigated, we've rendered
  useEffect(() => {
    if (location.pathname !== initialPathRef.current && hasSessionInState) {
      hasRenderedChildren.current = true;
    }
  }, [location.pathname, hasSessionInState]);

  // Redirect to auth only when we're certain there's no session
  useEffect(() => {
    if (loading || !isSessionVerified) return;
    if (!session && !user) {
      navigate('/auth', { replace: true });
    }
  }, [loading, isSessionVerified, session, user, navigate]);

  // Handle onboarding redirect
  useEffect(() => {
    if (!loading && isSessionVerified && user && profile && !profile.onboarding_completed) {
      if (location.pathname !== '/onboarding') {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [user, profile, loading, isSessionVerified, navigate, location.pathname]);

  // Determine what message to show during loading
  const getLoadingMessage = () => {
    if (!hasSessionInState) return 'Authenticating...';
    if (!profile) return 'Loading your workspace...';
    return 'Almost there...';
  };

  // Profile fetch error - show retry option
  if (user && profileError && !loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Failed to load profile</h2>
            <p className="text-muted-foreground text-sm">{profileError}</p>
          </div>
          <Button 
            onClick={retryProfileFetch}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // CRITICAL STABILITY FIX:
  // Show loader during loading state OR when waiting for session verification
  // But skip if we've already rendered children (prevents navigation blink)
  if ((loading || !isSessionVerified) && !hasRenderedChildren.current) {
    return <AppLoader message={getLoadingMessage()} />;
  }

  // No user after loading = show loader while redirecting (instead of null)
  if (!user && !session && !loading && isSessionVerified) {
    return <AppLoader message="Redirecting to login..." />;
  }

  // Wait for profile on INITIAL mount only - never block navigation between routes
  if (user && !profile && isInitialMount && !hasRenderedChildren.current && !loading) {
    return <AppLoader message="Loading your workspace..." />;
  }

  // If onboarding not completed, show loader while redirecting (instead of null)
  if (profile && !profile.onboarding_completed && location.pathname !== '/onboarding') {
    return <AppLoader message="Setting up your account..." />;
  }

  // Mark that we've successfully rendered children
  hasRenderedChildren.current = true;

  return <>{children}</>;
}
