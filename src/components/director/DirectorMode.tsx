/**
 * DirectorMode — global F-key toggle that puts the user into a focused,
 * distraction-free fullscreen creative session.
 *
 * Behavior:
 *   • Pressing `F` from anywhere toggles director mode.
 *   • While active: sidebar nav hides, page chrome (header / breadcrumb)
 *     fades to 20% opacity, body adopts an `data-director-mode` attribute
 *     that page CSS hooks into to mute decorative ornament.
 *   • A subtle top-right pip indicates the mode is on (Esc or F to exit).
 *   • State persists in sessionStorage so a page-reload mid-session stays
 *     in mode.
 */

import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const KEY = 'smallbridges.director_mode';

export function DirectorMode() {
  const [on, setOn] = useState(false);

  // Read initial state from sessionStorage.
  useEffect(() => {
    try {
      setOn(sessionStorage.getItem(KEY) === '1');
    } catch {}
  }, []);

  // Apply / remove the `data-director-mode` attribute on the html element
  // so global CSS can react. Also persist the state.
  useEffect(() => {
    if (on) {
      document.documentElement.setAttribute('data-director-mode', '1');
      try { sessionStorage.setItem(KEY, '1'); } catch {}
    } else {
      document.documentElement.removeAttribute('data-director-mode');
      try { sessionStorage.removeItem(KEY); } catch {}
    }
  }, [on]);

  // Keyboard shortcut — single `F` press, no modifiers, but only when not
  // typing into a form field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setOn((v) => !v);
      } else if (e.key === 'Escape' && on) {
        setOn(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on]);

  if (!on) return null;

  return (
    <div className="fixed top-4 right-4 z-[80] pointer-events-none">
      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.6)] pointer-events-auto">
        <Eye className="w-3 h-3 text-emerald-300" />
        <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/85">
          Director Mode
        </span>
        <button
          onClick={() => setOn(false)}
          className="text-white/45 hover:text-white text-[9px] font-mono uppercase tracking-[0.32em] inline-flex items-center gap-1 pl-2 border-l border-white/10"
          aria-label="Exit Director Mode"
        >
          <EyeOff className="w-3 h-3" />
          Esc
        </button>
      </div>
    </div>
  );
}

export default DirectorMode;
