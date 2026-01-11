import { ReactNode, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, loading, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasCheckedAuth = useRef(false);

  // Only redirect on initial load when we confirm there's no session
  useEffect(() => {
    // Wait for initial auth check to complete
    if (loading) return;
    
    // Only check once per mount to prevent redirect loops
    if (hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;

    // If no session after loading completes, redirect to auth
    if (!session && !user) {
      console.log('[ProtectedRoute] No session, redirecting to auth');
      navigate('/auth', { replace: true });
    }
  }, [loading, session, user, navigate]);

  // Handle onboarding redirect separately
  useEffect(() => {
    if (!loading && user && profile && !profile.onboarding_completed) {
      if (location.pathname !== '/onboarding') {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [user, profile, loading, navigate, location.pathname]);

  // Only show loading on initial cold start (first app load)
  // After that, trust the session and render immediately
  if (loading) {
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
  if (!user) {
    return null;
  }

  // If onboarding not completed, don't render (will redirect)
  if (profile && !profile.onboarding_completed && location.pathname !== '/onboarding') {
    return null;
  }

  return <>{children}</>;
}
