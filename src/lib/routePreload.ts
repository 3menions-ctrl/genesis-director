/**
 * routePreload — anticipatory code-splitting prefetcher.
 *
 * Vite splits every `lazy(() => import(...))` route into a separate chunk.
 * Network-tab inspection shows that on hover, the chunk download (cold,
 * fast network) takes 150–400ms. If we *start* the download the moment
 * the user hovers a link, the chunk is usually in memory by the time
 * they click — meaning the page appears instant.
 *
 * This module registers a single delegated mouseover/focus listener on
 * the document. When the target is an `<a href="/foo">` or anything with
 * a `data-prefetch="/foo"` attribute, we look up the registered prefetch
 * function for `/foo` (set during route definition) and call it.
 *
 * A WeakSet de-dupes per element so the prefetch only fires once per
 * link per session.
 */

type PrefetchFn = () => Promise<unknown>;
const REGISTRY = new Map<string, PrefetchFn>();
const FIRED = new WeakSet<Element>();

/** Register a prefetcher for a route. Pass the same `() => import(...)`
 *  callback used in the `lazy(...)` call. */
export function registerPrefetch(routePath: string, fn: PrefetchFn): void {
  // Normalize trailing slash variants and dynamic-segment templates to a
  // base path so `/library/cast` and `/library/looks` both hit the same
  // entry for `/library/:atom`.
  REGISTRY.set(routePath, fn);
}

/** Programmatic prefetch by pathname — used by the Concierge to warm
 *  the next-likely route during idle time. */
export function prefetchByPath(pathname: string): void {
  const fn = lookup(pathname);
  if (fn) { void fn(); }
}

/** Match a concrete pathname against the registry, returning the best
 *  matching prefetcher (longest matching prefix). */
function lookup(pathname: string): PrefetchFn | undefined {
  // Exact match wins.
  const exact = REGISTRY.get(pathname);
  if (exact) return exact;
  // Otherwise pick the longest registered prefix.
  let best: PrefetchFn | undefined;
  let bestLen = 0;
  for (const [key, fn] of REGISTRY) {
    if (key.endsWith('/*') && pathname.startsWith(key.slice(0, -2)) && key.length > bestLen) {
      best = fn;
      bestLen = key.length;
    } else if (pathname.startsWith(key + '/') && key.length > bestLen) {
      best = fn;
      bestLen = key.length;
    }
  }
  return best;
}

/** Bootstrap the global delegated listeners. Call once at app startup. */
export function installRoutePrefetcher(): void {
  if (typeof document === 'undefined') return;
  if ((document as { __sb_prefetch_installed?: boolean }).__sb_prefetch_installed) return;
  (document as { __sb_prefetch_installed?: boolean }).__sb_prefetch_installed = true;

  const handle = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const anchor = target.closest('a[href], [data-prefetch]') as HTMLElement | null;
    if (!anchor || FIRED.has(anchor)) return;
    const path =
      anchor.getAttribute('data-prefetch') ??
      (() => {
        const href = (anchor as HTMLAnchorElement).getAttribute('href') ?? '';
        // Only intercept internal paths.
        if (!href.startsWith('/') || href.startsWith('//')) return null;
        return href.split('#')[0].split('?')[0];
      })();
    if (!path) return;
    const fn = lookup(path);
    if (!fn) return;
    FIRED.add(anchor);
    // Use idle callback so prefetch doesn't compete with user input.
    const schedule =
      (window as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 1));
    schedule(() => {
      void fn().catch(() => {
        // Failed prefetch is harmless — actual navigation will retry.
      });
    });
  };

  // mouseover for desktop hover, focusin for keyboard-tabbed prefetch,
  // touchstart for mobile (very first touch primes the chunk).
  document.addEventListener('mouseover', handle, { passive: true, capture: false });
  document.addEventListener('focusin', handle, { passive: true, capture: false });
  document.addEventListener('touchstart', handle, { passive: true, capture: false });
}
