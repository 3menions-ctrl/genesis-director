import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, loading, session, isSessionVerified, profileError, retryProfileFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect to auth only when we're certain there's no session
  // This runs after loading is complete AND session verification is done
  useEffect(() => {
    // Wait for auth to fully initialize
    if (loading || !isSessionVerified) return;

    // Only redirect if definitively no session after full verification
    if (!session && !user) {
      console.log('[ProtectedRoute] No session after verification, redirecting to auth');
      navigate('/auth', { replace: true });
    }
  }, [loading, isSessionVerified, session, user, navigate]);

  // Handle onboarding redirect separately
  useEffect(() => {
    if (!loading && isSessionVerified && user && profile && !profile.onboarding_completed) {
      if (location.pathname !== '/onboarding') {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [user, profile, loading, isSessionVerified, navigate, location.pathname]);

  // CRITICAL FIX: If we already have a session in state, don't show loading
  // This prevents the blink when navigating between protected routes
  const hasSessionInState = !!session || !!user;
  
  // Only show loading during INITIAL auth check (no session data yet)
  // Once we have session data, trust it and render children immediately
  if ((loading || !isSessionVerified) && !hasSessionInState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
              <Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // No user after loading = will redirect (don't render children)
  if (!user && !session) {
    return null;
  }

  // Profile fetch error - show retry option
  if (user && profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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

  // Wait for profile to load before checking onboarding status
  // This prevents white screen while profile is being fetched
  if (user && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
              <Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  // If onboarding not completed, don't render (will redirect)
  if (profile && !profile.onboarding_completed && location.pathname !== '/onboarding') {
    return null;
  }

  return <>{children}</>;
}
