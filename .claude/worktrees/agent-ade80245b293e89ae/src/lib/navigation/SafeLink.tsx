/**
 * SafeLink - Navigation-aware Link component
 * 
 * Prevents navigation while locked and integrates with the
 * navigation coordinator for smooth transitions.
 */

import React, { memo, useCallback, MouseEvent, forwardRef, ReactNode } from 'react';
import { Link, LinkProps, useLocation } from 'react-router-dom';
import { navigationCoordinator } from './NavigationCoordinator';
import { useSafeNavigation } from './unifiedHooks';

interface SafeLinkProps extends Omit<LinkProps, 'onClick'> {
  children: ReactNode;
  /** Custom onClick handler */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  /** Disable navigation locking for this link */
  bypassLock?: boolean;
  /** Show loading state during navigation */
  showLoading?: boolean;
}

export const SafeLink = memo(forwardRef<HTMLAnchorElement, SafeLinkProps>(
  function SafeLink({ 
    to, 
    children, 
    onClick, 
    bypassLock = false,
    showLoading = false,
    className,
    ...props 
  }, ref) {
    const location = useLocation();
    const { navigate, isLocked } = useSafeNavigation();

    const handleClick = useCallback(async (e: MouseEvent<HTMLAnchorElement>) => {
      // Call original onClick
      if (onClick) {
        onClick(e);
      }

      // If already prevented, skip
      if (e.defaultPrevented) {
        return;
      }

      // Get target path
      const targetPath = typeof to === 'string' ? to : to.pathname || '';

      // Same route - let Link handle it
      if (targetPath === location.pathname) {
        return;
      }

      // Check lock status (unless bypassing)
      if (!bypassLock && isLocked) {
        e.preventDefault();
        console.debug('[SafeLink] Navigation blocked (locked)');
        return;
      }

      // For heavy routes, use safe navigation
      e.preventDefault();
      
      await navigate(targetPath, { skipLock: bypassLock });
    }, [to, onClick, location.pathname, bypassLock, isLocked, navigate]);

    // Compute className with loading state
    const computedClassName = [
      className,
      isLocked && !bypassLock ? 'pointer-events-none opacity-60' : '',
    ].filter(Boolean).join(' ');

    return (
      <Link 
        ref={ref} 
        to={to} 
        onClick={handleClick}
        className={computedClassName}
        {...props}
      >
        {children}
      </Link>
    );
  }
));

SafeLink.displayName = 'SafeLink';

export default SafeLink;
