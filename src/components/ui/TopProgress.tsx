/**
 * TopProgress — slim brand-blue progress bar at the top of the viewport
 * during route transitions. Renders only while React Router reports a
 * pending location.
 *
 * Mounted once globally in App.tsx; uses `useNavigation()`-style behavior
 * via a simple in-app event bus so we don't need React Router data routers.
 * The Suspense fallbacks on each Route also call into the bus, so this
 * shows whenever a lazy chunk is loading.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export function TopProgress() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  // Show on every pathname change; hide after the first idle frame.
  useEffect(() => {
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), 320);
    return () => window.clearTimeout(id);
  }, [location.pathname, location.search]);

  // Listen for explicit suspense start / end events so chunked routes
  // also surface the bar.
  useEffect(() => {
    const onStart = () => setVisible(true);
    const onEnd = () => setVisible(false);
    window.addEventListener('sb:nav-start', onStart);
    window.addEventListener('sb:nav-end', onEnd);
    return () => {
      window.removeEventListener('sb:nav-start', onStart);
      window.removeEventListener('sb:nav-end', onEnd);
    };
  }, []);

  if (!visible) return null;
  return <div className="top-progress" data-top-progress aria-hidden />;
}

export default TopProgress;
