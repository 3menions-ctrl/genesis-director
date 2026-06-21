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
 *
 * Failure modes that resolve (not reject) so callers never surface
 * "Something went wrong" to the user:
 *   • Browser without `document.startViewTransition` — runs synchronously.
 *   • `prefers-reduced-motion` — runs synchronously.
 *   • Document is hidden (background tab, page minimized) — the View
 *     Transitions API rejects `finished` with `AbortError`/`InvalidStateError`
 *     and the message "View transition was skipped because document
 *     visibility state is hidden." We pre-flight this, bypassing the
 *     animation but STILL running the callback so navigation happens.
 *   • Any other thrown error / rejected promise — swallowed; callback
 *     runs synchronously as a fallback.
 *
 * In short: the animation is best-effort cosmetic, never blocking.
 */
export function startTransition(callback: () => void | Promise<void>): Promise<void> {
  const doc = document as Doc;
  const runCallbackSafe = () => {
    try {
      const r = callback();
      if (r && typeof (r as Promise<void>).catch === 'function') {
        (r as Promise<void>).catch(() => undefined);
      }
    } catch {
      /* the caller's callback is responsible for its own errors */
    }
  };

  // No View Transitions API — run synchronously.
  if (!doc.startViewTransition) {
    runCallbackSafe();
    return Promise.resolve();
  }
  // Honor prefers-reduced-motion — skip the transition entirely.
  if (typeof window !== 'undefined') {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq.matches) {
        runCallbackSafe();
        return Promise.resolve();
      }
    } catch {
      /* matchMedia unavailable — proceed */
    }
  }
  // Pre-flight document visibility: the View Transitions API throws /
  // rejects when the document is hidden (background tab, minimized
  // window). Run the callback synchronously and skip the animation.
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    runCallbackSafe();
    return Promise.resolve();
  }
  try {
    const t = doc.startViewTransition(() => {
      runCallbackSafe();
    });
    // Swallow EVERY rejection — `finished`, `ready`, and
    // `updateCallbackDone`. All three can reject independently when
    // the transition is skipped (visibility change, manual
    // skipTransition, browser-internal abort) and an uncaught one
    // surfaces to the root error boundary as the user-reported
    // "Something went wrong" toast.
    t.ready.catch(() => undefined);
    t.updateCallbackDone.catch(() => undefined);
    return t.finished.catch(() => undefined);
  } catch {
    // Synchronous throw from startViewTransition itself — fall back
    // to a plain callback so navigation still happens.
    runCallbackSafe();
    return Promise.resolve();
  }
}
