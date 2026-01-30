/**
 * NavigationLink - Navigation guard-aware link component
 * 
 * Intercepts clicks to heavy routes and triggers the global loading overlay
 * before actual navigation occurs.
 */

import { memo, useCallback, MouseEvent, ReactNode, forwardRef } from 'react';
import { Link, LinkProps, useNavigate } from 'react-router-dom';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';

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

    const handleClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
      // Call original onClick if provided
      if (onClick) {
        onClick(e);
      }

      // If already prevented or skipLoading, let normal navigation happen
      if (e.defaultPrevented || skipLoading) {
        return;
      }

      const targetPath = typeof to === 'string' ? to : to.pathname || '';

      // Check if this is a heavy route
      if (isHeavyRoute(targetPath)) {
        e.preventDefault();
        
        // Start loading overlay
        startNavigation(targetPath);
        
        // Navigate after a brief delay to ensure overlay is visible
        requestAnimationFrame(() => {
          navigate(to);
        });
      }
      // For non-heavy routes, let the Link handle navigation normally
    }, [to, onClick, skipLoading, isHeavyRoute, startNavigation, navigate]);

    return (
      <Link ref={ref} to={to} onClick={handleClick} {...props}>
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
    if (isHeavyRoute(to)) {
      startNavigation(to);
      requestAnimationFrame(() => {
        navigate(to, options);
      });
    } else {
      navigate(to, options);
    }
  }, [navigate, startNavigation, isHeavyRoute]);

  return { navigateTo };
}

export default NavigationLink;
