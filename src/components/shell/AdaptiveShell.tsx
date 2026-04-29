import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from './AppShell';
import { PublicMarketingShell } from './PublicMarketingShell';

/**
 * AdaptiveShell — for marketing pages that exist in both authenticated and
 * unauthenticated contexts (pricing, blog, gallery, etc).
 *
 * SECURITY: when no user is authenticated, we MUST render the public marketing
 * shell. Rendering AppShell to anonymous users exposes navigation primitives
 * (sidebar, account, credits, admin links) that can leak app structure.
 *
 * While auth is still hydrating, render the public shell to fail-safe.
 */
export function AdaptiveShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <PublicMarketingShell>{children}</PublicMarketingShell>;
  }
  return <AppShell>{children}</AppShell>;
}

export default AdaptiveShell;