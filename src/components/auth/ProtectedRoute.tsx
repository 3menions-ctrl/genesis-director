import { ReactNode, useEffect, useRef, useState, useMemo, useCallback, forwardRef, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CinemaLoader } from '@/components/ui/CinemaLoader';

interface ProtectedRouteProps {
  children: ReactNode;
}

// Loading states for the auth guard - prevents premature redirects
type AuthLoadingState = 'initializing' | 'verifying' | 'ready' | 'redirecting';

/**
 * ProtectedRoute with comprehensive stability optimizations:
 * 1. THREE-PHASE loading: initializing → verifying → ready
 * 2. NEVER redirects until auth is FULLY resolved (loading=false AND isSessionVerified=true)
 * 3. Uses getValidSession() to avoid stale React state race conditions
 * 4. Shows AppLoader during ALL intermediate states to prevent flickering
 * 5. Tracks hasRenderedChildren to prevent loader flash on navigation between protected routes
 * 6. 300ms buffer before redirect to handle async state propagation
 */
export const ProtectedRoute = memo(forwardRef<HTMLDivElement, ProtectedRouteProps>(
  function ProtectedRoute({ children }, ref) {
  const { user, profile, loading, session, isSessionVerified, profileError, retryProfileFetch, getValidSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { state: navLoadingState } = useNavigationLoading();
  
  // Track loading phase explicitly for debugging and stability
  const [authPhase, setAuthPhase] = useState<AuthLoadingState>('initializing');
  
  // Track if we've already rendered children to prevent blink on navigation
  const hasRenderedChildren = useRef(false);
  // Track if this is the initial mount
  const [isInitialMount, setIsInitialMount] = useState(true);
  // Track the initial path to detect navigation
  const initialPathRef = useRef(location.pathname);
  // Track redirect state to prevent double-redirects
  const isRedirectingRef = useRef(false);
  // Track cleanup for all async operations
  const cleanupRef = useRef<Array<() => void>>([]);
  // Track abort controller for session checks
  const sessionCheckAbortRef = useRef<AbortController | null>(null);

  // Memoize session check to prevent unnecessary recalculations
  // Use optional chaining for safety against null pointer crashes
  const hasSessionInState = useMemo(() => !!(session?.user?.id || user?.id), [session, user]);

  // Update auth phase based on state - SINGLE SOURCE OF TRUTH
  useEffect(() => {
    if (loading) {
      setAuthPhase('initializing');
    } else if (!isSessionVerified) {
      setAuthPhase('verifying');
    } else if (isRedirectingRef.current) {
      setAuthPhase('redirecting');
    } else {
      setAuthPhase('ready');
    }
  }, [loading, isSessionVerified]);

  // Mark initial mount complete after first render with valid session
  useEffect(() => {
    if (isSessionVerified && hasSessionInState && profile?.id) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => setIsInitialMount(false), 50);
      cleanupRef.current.push(() => clearTimeout(timer));
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
  // FIX: Added AbortController for proper cleanup on unmount
  useEffect(() => {
    // Prevent double redirects
    if (isRedirectingRef.current) return;
    
    // STRICT GUARD: Only redirect when auth is fully resolved
    if (loading || !isSessionVerified) return;
    
    // Already have a session in state - no redirect needed
    if (session?.user?.id || user?.id) return;
    
    // Abort any previous session check
    if (sessionCheckAbortRef.current) {
      sessionCheckAbortRef.current.abort();
    }
    
    // Create new abort controller for this check
    sessionCheckAbortRef.current = new AbortController();
    const signal = sessionCheckAbortRef.current.signal;
    
    // ENHANCED: Longer buffer for state synchronization after login
    // 500ms gives heavy pages time to complete their initialization
    const timeoutId = setTimeout(async () => {
      if (isRedirectingRef.current || signal.aborted) return;
      
      try {
        // Get fresh session directly from Supabase to avoid stale React state
        const freshSession = await getValidSession();
        
        // Check abort status after async operation
        if (signal.aborted) return;
        
        // If fresh session exists, don't redirect - state will catch up
        if (freshSession?.user?.id) {
          console.debug('[ProtectedRoute] Fresh session found, skipping redirect');
          return;
        }
        
        // No session confirmed - redirect to auth
        isRedirectingRef.current = true;
        setAuthPhase('redirecting');
        navigate('/auth', { replace: true });
      } catch (err) {
        // Check if error is due to abort
        if (err instanceof Error && err.name === 'AbortError') return;
        // If session check fails (network error), don't redirect - wait for retry
        console.warn('[ProtectedRoute] Session check failed, will retry:', err);
      }
    }, 500); // Increased to 500ms for heavy pages
    
    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      if (sessionCheckAbortRef.current) {
        sessionCheckAbortRef.current.abort();
      }
    };
  }, [loading, isSessionVerified, session?.user?.id, user?.id, navigate, getValidSession]);

  // Cleanup all async operations on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current.forEach(cleanup => cleanup());
      cleanupRef.current = [];
      // Also abort any pending session checks
      if (sessionCheckAbortRef.current) {
        sessionCheckAbortRef.current.abort();
        sessionCheckAbortRef.current = null;
      }
    };
  }, []);

  // Handle onboarding redirect
  useEffect(() => {
    if (!loading && isSessionVerified && user?.id && profile && !profile.onboarding_completed) {
      if (location.pathname !== '/onboarding') {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [user?.id, profile, loading, isSessionVerified, navigate, location.pathname]);

  // Memoize loading message to prevent unnecessary re-renders
  const loadingMessage = useMemo(() => {
    if (authPhase === 'initializing') return 'Authenticating...';
    if (authPhase === 'verifying') return 'Verifying session...';
    if (authPhase === 'redirecting') return 'Redirecting...';
    if (!hasSessionInState) return 'Checking credentials...';
    if (!profile?.id) return 'Loading your workspace...';
    return 'Almost there...';
  }, [authPhase, hasSessionInState, profile?.id]);

  // Profile fetch error - show retry option with DARK THEME
  if (user?.id && profileError && !loading) {
    return (
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ backgroundColor: '#030303' }}
      >
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Failed to load profile</h2>
            <p className="text-zinc-400 text-sm">{profileError}</p>
          </div>
          <Button 
            onClick={retryProfileFetch}
            className="gap-2 bg-white text-black hover:bg-white/90"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // CRITICAL STABILITY FIX:
  // DEFER to GlobalLoadingOverlay if it's already showing (prevents duplicate loaders)
  // This prevents 2-4 concurrent CinemaLoader instances which crash Safari
  if ((authPhase === 'initializing' || authPhase === 'verifying') && !hasRenderedChildren.current) {
    // If global overlay is showing, render a minimal placeholder instead of another CinemaLoader
    if (navLoadingState.isLoading) {
      return <div className="fixed inset-0 bg-[#030303]" />;
    }
    return (
      <CinemaLoader 
        message={loadingMessage} 
        showProgress={true}
        progress={authPhase === 'verifying' ? 50 : 20}
        variant="fullscreen"
      />
    );
  }

  // Redirecting state - show loader instead of null to prevent flash
  if (authPhase === 'redirecting') {
    if (navLoadingState.isLoading) {
      return <div className="fixed inset-0 bg-[#030303]" />;
    }
    return (
      <CinemaLoader 
        message="Redirecting to login..." 
        showProgress={false}
        variant="fullscreen"
      />
    );
  }

  // Wait for profile on INITIAL mount only - never block navigation between routes
  if (user?.id && !profile?.id && isInitialMount && !hasRenderedChildren.current && authPhase === 'ready') {
    if (navLoadingState.isLoading) {
      return <div className="fixed inset-0 bg-[#030303]" />;
    }
    return (
      <CinemaLoader 
        message={loadingMessage} 
        showProgress={true}
        progress={70}
        variant="fullscreen"
      />
    );
  }

  // If onboarding not completed, show loader while redirecting (instead of null)
  if (profile && !profile.onboarding_completed && location.pathname !== '/onboarding') {
    if (navLoadingState.isLoading) {
      return <div className="fixed inset-0 bg-[#030303]" />;
    }
    return (
      <CinemaLoader 
        message="Setting up your account..." 
        showProgress={true}
        progress={90}
        variant="fullscreen"
      />
    );
  }

  // Mark that we've successfully rendered children
  hasRenderedChildren.current = true;

  return <div ref={ref} className="contents">{children}</div>;
}));
ProtectedRoute.displayName = 'ProtectedRoute';
