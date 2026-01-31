import { ReactNode, useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
 * 5. CRITICAL: Never redirects until BOTH loading=false AND isSessionVerified=true
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, loading, session, isSessionVerified, profileError, retryProfileFetch, getValidSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Track if we've already rendered children to prevent blink on navigation
  const hasRenderedChildren = useRef(false);
  // Track if this is the initial mount
  const [isInitialMount, setIsInitialMount] = useState(true);
  // Track the initial path to detect navigation
  const initialPathRef = useRef(location.pathname);
  // Track redirect state to prevent double-redirects
  const isRedirectingRef = useRef(false);

  // Memoize session check to prevent unnecessary recalculations
  // Use optional chaining for safety against null pointer crashes
  const hasSessionInState = useMemo(() => !!(session?.user?.id || user?.id), [session, user]);

  // Mark initial mount complete after first render with valid session
  useEffect(() => {
    if (isSessionVerified && hasSessionInState && profile?.id) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => setIsInitialMount(false), 50);
      return () => clearTimeout(timer);
    }
  }, [isSessionVerified, hasSessionInState, profile?.id]);

  // Detect navigation away from initial path - if we navigated, we've rendered
  useEffect(() => {
    if (location.pathname !== initialPathRef.current && hasSessionInState) {
      hasRenderedChildren.current = true;
    }
  }, [location.pathname, hasSessionInState]);

  // Redirect to auth only when we're CERTAIN there's no session
  // CRITICAL: Must have loading=false AND isSessionVerified=true before redirecting
  // Uses getValidSession() to avoid stale closure issues
  useEffect(() => {
    // Prevent double redirects
    if (isRedirectingRef.current) return;
    
    // STRICT GUARD: Only redirect when auth is fully resolved
    if (loading || !isSessionVerified) return;
    
    // Already have a session in state - no redirect needed
    if (session?.user?.id || user?.id) return;
    
    // Additional buffer for state synchronization after login
    // Use getValidSession to get FRESH session, avoiding stale closure
    const timeoutId = setTimeout(async () => {
      if (isRedirectingRef.current) return;
      
      // Get fresh session directly from Supabase to avoid stale React state
      const freshSession = await getValidSession();
      
      // If fresh session exists, don't redirect - state will catch up
      if (freshSession?.user?.id) {
        console.debug('[ProtectedRoute] Fresh session found, skipping redirect');
        return;
      }
      
      // No session confirmed - redirect to auth
      isRedirectingRef.current = true;
      navigate('/auth', { replace: true });
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [loading, isSessionVerified, session?.user?.id, user?.id, navigate, getValidSession]);

  // Handle onboarding redirect
  useEffect(() => {
    if (!loading && isSessionVerified && user?.id && profile && !profile.onboarding_completed) {
      if (location.pathname !== '/onboarding') {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [user?.id, profile, loading, isSessionVerified, navigate, location.pathname]);

  // Determine what message to show during loading
  const getLoadingMessage = () => {
    if (!hasSessionInState) return 'Authenticating...';
    if (!profile?.id) return 'Loading your workspace...';
    return 'Almost there...';
  };

  // Profile fetch error - show retry option
  if (user?.id && profileError && !loading) {
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
  if (!user?.id && !session?.user?.id && !loading && isSessionVerified) {
    return <AppLoader message="Redirecting to login..." />;
  }

  // Wait for profile on INITIAL mount only - never block navigation between routes
  if (user?.id && !profile?.id && isInitialMount && !hasRenderedChildren.current && !loading) {
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
