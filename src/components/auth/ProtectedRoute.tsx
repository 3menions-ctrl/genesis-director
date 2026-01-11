import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, loading, isSessionVerified, getValidSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionChecked, setSessionChecked] = useState(false);

  // Double-check session on mount to catch stale state
  useEffect(() => {
    let mounted = true;
    
    const verifySession = async () => {
      // Wait for initial auth state to settle
      if (loading) return;
      
      // Get fresh session from Supabase to avoid stale React state
      const session = await getValidSession();
      
      if (!mounted) return;
      
      if (!session) {
        console.log('[ProtectedRoute] No valid session, redirecting to auth');
        navigate('/auth', { replace: true });
      }
      setSessionChecked(true);
    };

    verifySession();
    
    return () => { mounted = false; };
  }, [loading, getValidSession, navigate]);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!loading && sessionChecked && user && profile && !profile.onboarding_completed) {
      if (location.pathname !== '/onboarding') {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [user, profile, loading, sessionChecked, navigate, location.pathname]);

  // Show loading until session is verified
  if (loading || !isSessionVerified || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
              <Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // If onboarding not completed, don't render children (will redirect)
  if (profile && !profile.onboarding_completed && location.pathname !== '/onboarding') {
    return null;
  }

  return <>{children}</>;
}
