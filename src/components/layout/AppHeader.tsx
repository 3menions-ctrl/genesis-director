import { memo, forwardRef } from 'react';

/**
 * Legacy <AppHeader /> shim.
 *
 * The app now uses a global <AppShell /> (sidebar + glass topbar) that wraps
 * every authenticated route. Pages that still import & render <AppHeader />
 * intentionally render nothing here so we don't double-stack headers on top
 * of the new shell. Keep the props shape so existing call sites compile.
 */
interface AppHeaderProps {
  showCreate?: boolean;
  showCredits?: boolean;
  onCreateClick?: () => void;
  className?: string;
}

export const AppHeader = memo(forwardRef<HTMLElement, AppHeaderProps>(function AppHeader(
  _props,
  _ref,
) {
  return null;
}));

export default AppHeader;
