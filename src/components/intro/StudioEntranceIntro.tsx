/**
 * StudioEntranceIntro — plays the "THE CROSSING" logo animation ONCE the first
 * time a user enters the studio (e.g. right after signup), then never again.
 *
 * Replaces the old first-run card tour: no tour, no video — just the same
 * animated logo that plays on the landing, a single time.
 */
import { useEffect, useState } from 'react';
import { IntroOverlay } from '@/components/intro/IntroOverlay';

const SEEN_KEY = 'smallbridges.studio_intro_seen';

export function StudioEntranceIntro() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* ignore */ }
    if (seen) return;
    // Let the studio paint a frame before the logo animation takes over.
    const t = window.setTimeout(() => setOpen(true), 200);
    return () => window.clearTimeout(t);
  }, []);

  const done = () => {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
  };

  return <IntroOverlay open={open} onComplete={done} />;
}

export default StudioEntranceIntro;
