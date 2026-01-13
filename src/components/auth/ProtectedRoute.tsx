import { ReactNode, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLoader } from '@/components/ui/app-loader';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, loading, session, isSessionVerified, profileError, retryProfileFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Track if we've shown the loader to prevent re-renders
  const hasShownLoader = useRef(false);

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

  // CRITICAL: If we already have a session, render children immediately
  // This prevents any loading flash when navigating between protected routes
  const hasSessionInState = !!session || !!user;
  
  // Determine what message to show during loading
  const getLoadingMessage = () => {
    if (!hasSessionInState) return 'Authenticating...';
    if (!profile) return 'Loading your workspace...';
    return 'Almost there...';
  };

  // Only show loader during INITIAL auth check (no session data yet)
  if ((loading || !isSessionVerified) && !hasSessionInState) {
    hasShownLoader.current = true;
    return <AppLoader message={getLoadingMessage()} />;
  }

  // No user after loading = will redirect
  if (!user && !session) {
    return null;
  }

  // Profile fetch error - show retry option
  if (user && profileError) {
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

  // Wait for profile but use unified loader
  if (user && !profile) {
    // If we already showed a loader, just return null briefly to prevent double-flash
    if (hasShownLoader.current) {
      return <AppLoader message="Loading your workspace..." />;
    }
    return <AppLoader message="Loading your workspace..." />;
  }

  // If onboarding not completed, don't render (will redirect)
  if (profile && !profile.onboarding_completed && location.pathname !== '/onboarding') {
    return null;
  }

  return <>{children}</>;
}
