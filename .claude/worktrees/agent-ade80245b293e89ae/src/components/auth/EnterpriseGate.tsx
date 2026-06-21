import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CinemaLoader } from '@/components/ui/CinemaLoader';

/**
 * Intercepts enterprise-tier users and redirects them to the
 * Enterprise coming-soon page. Admin and business users pass through
 * untouched. Used as an inner gate INSIDE RequireAccountType so the
 * outer auth + account-type checks still run first.
 */
export function EnterpriseGate({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading || !profile?.id) {
    return <CinemaLoader message="Verifying access..." showProgress variant="fullscreen" />;
  }

  if (profile.account_type === 'enterprise') {
    return <Navigate to="/enterprise/coming-soon" replace />;
  }

  return <>{children}</>;
}