/**
 * NavigationLink - Navigation guard-aware link component
 * 
 * Intercepts clicks to heavy routes and triggers the global loading overlay
 * before actual navigation occurs.
 */

import { memo, useCallback, MouseEvent, ReactNode, forwardRef, FocusEvent } from 'react';
import { Link, LinkProps, useNavigate } from 'react-router-dom';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import { prefetchRoute } from '@/lib/routePrefetch';

interface NavigationLinkProps extends Omit<LinkProps, 'onClick'> {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  /** Skip the loading overlay for this link */
  skipLoading?: boolean;
}

export const NavigationLink = memo(forwardRef<HTMLAnchorElement, NavigationLinkProps>(
  function NavigationLink({ to, children, onClick, skipLoading, ...props }, ref) {
    const navigate = useNavigate();
    const { startNavigation, isHeavyRoute } = useNavigationLoading();

    const targetPath = typeof to === 'string' ? to : (to.pathname || '');

    const warm = useCallback(() => {
      // Fire-and-forget; safe to call repeatedly (idempotent).
      prefetchRoute(targetPath);
    }, [targetPath]);

    const handleClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
      // Call original onClick if provided
      if (onClick) {
        onClick(e);
      }

      // If already prevented or skipLoading, let normal navigation happen
      if (e.defaultPrevented || skipLoading) {
        return;
      }

      // Check if this is a heavy route
      if (isHeavyRoute(targetPath)) {
        e.preventDefault();
        
        // Start loading overlay
        startNavigation(targetPath);
        
        // Navigate synchronously — the overlay renders on next paint regardless
        // Using rAF here caused dropped navigations and required double-refresh
        navigate(to);
      }
      // For non-heavy routes, let the Link handle navigation normally
    }, [to, targetPath, onClick, skipLoading, isHeavyRoute, startNavigation, navigate]);

    return (
      <Link
        ref={ref}
        to={to}
        onClick={handleClick}
        onMouseEnter={warm}
        onFocus={warm as unknown as (e: FocusEvent<HTMLAnchorElement>) => void}
        onTouchStart={warm}
        {...props}
      >
        {children}
      </Link>
    );
  }
));

/**
 * Hook for programmatic navigation with loading overlay
 */
export function useNavigationWithLoading() {
  const navigate = useNavigate();
  const { startNavigation, isHeavyRoute } = useNavigationLoading();

  const navigateTo = useCallback((to: string, options?: { replace?: boolean }) => {
    // Warm the chunk just in case the caller didn't hover-prefetch.
    prefetchRoute(to);
    if (isHeavyRoute(to)) {
      startNavigation(to);
    }
    // Always navigate synchronously — no rAF delay
    navigate(to, options);
  }, [navigate, startNavigation, isHeavyRoute]);

  return { navigateTo, prefetch: prefetchRoute };
}

export default NavigationLink;
