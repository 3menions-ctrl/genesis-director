/**
 * viewTransitions — opt-in wrapper around the View Transitions API.
 *
 * Browsers that support `document.startViewTransition` get a buttery
 * 220ms cross-dissolve between routes — the same primitive Mac apps and
 * Apple's marketing pages use. Browsers that don't support it run the
 * passed callback synchronously, which renders the new page instantly
 * (no jank, just no animation).
 *
 * Usage:
 *   import { startTransition } from '@/lib/viewTransitions';
 *   startTransition(() => navigate('/projects'));
 *
 * The transition CSS lives in `src/index.css` under "View Transitions".
 */

type Doc = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition: () => void;
  };
};

export function supportsViewTransitions(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof (document as Doc).startViewTransition === 'function'
  );
}

/**
 * Run `callback` inside a view transition if supported, otherwise run it
 * synchronously. Returns the transition's `finished` promise (or a
 * resolved promise on browsers without support).
 */
export function startTransition(callback: () => void | Promise<void>): Promise<void> {
  const doc = document as Doc;
  if (!doc.startViewTransition) {
    callback();
    return Promise.resolve();
  }
  // Honor prefers-reduced-motion — skip the transition entirely.
  if (typeof window !== 'undefined') {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      callback();
      return Promise.resolve();
    }
  }
  try {
    const t = doc.startViewTransition(() => callback());
    return t.finished.catch(() => undefined);
  } catch {
    callback();
    return Promise.resolve();
  }
}
