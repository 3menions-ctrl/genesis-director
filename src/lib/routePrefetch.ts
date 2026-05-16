/**
 * routePrefetch — intent-based route chunk warming.
 *
 * NavigationLink / useNavigationWithLoading call prefetchRoute() on hover,
 * focus, and touchstart so that by the time the user actually clicks, the
 * lazy chunk + its critical dependencies are already in cache. This is the
 * native-app trick that makes route changes feel "instant".
 *
 * SAFE: dynamic imports are idempotent (module cache); failures are swallowed.
 * SAFE: registry only includes routes that are lazy() in App.tsx — adding new
 *   entries is opt-in. Unknown paths are a no-op.
 */

type Loader = () => Promise<unknown>;

// Registry of lazy chunks — keyed by route prefix.
// Order matters: first matching prefix wins.
const REGISTRY: Array<{ match: (p: string) => boolean; loader: Loader }> = [
  { match: p => p === '/' || p === '',           loader: () => import('@/pages/Landing') },
  { match: p => p.startsWith('/auth/callback'),  loader: () => import('@/pages/AuthCallback') },
  { match: p => p.startsWith('/auth'),           loader: () => import('@/pages/Auth') },
  { match: p => p.startsWith('/onboarding'),     loader: () => import('@/pages/Onboarding') },
  { match: p => p.startsWith('/start'),          loader: () => import('@/pages/StartOnboarding') },
  { match: p => p.startsWith('/welcome/checkout'), loader: () => import('@/pages/WelcomeCheckout') },
  { match: p => p.startsWith('/studio'),         loader: () => import('@/pages/Studio') },
  { match: p => p.startsWith('/projects'),       loader: () => import('@/pages/Projects') },
  { match: p => p.startsWith('/create'),         loader: () => import('@/pages/CreateCanvas') },
  { match: p => p.startsWith('/credits'),        loader: () => import('@/pages/Credits') },
  { match: p => p.startsWith('/pricing'),        loader: () => import('@/pages/Pricing') },
  { match: p => p.startsWith('/profile'),        loader: () => import('@/pages/Profile') },
  { match: p => p.startsWith('/settings'),       loader: () => import('@/pages/Settings') },
  { match: p => p.startsWith('/notifications'),  loader: () => import('@/pages/Notifications') },
  { match: p => p.startsWith('/avatars'),        loader: () => import('@/pages/Avatars') },
  { match: p => p.startsWith('/templates'),      loader: () => import('@/pages/Templates') },
  { match: p => p.startsWith('/help'),           loader: () => import('@/pages/HelpCenter') },
  { match: p => p.startsWith('/blog'),           loader: () => import('@/pages/Blog') },
  { match: p => p.startsWith('/pricing'),        loader: () => import('@/pages/Pricing') },
  { match: p => p.startsWith('/how-it-works'),   loader: () => import('@/pages/HowItWorks') },
  { match: p => p.startsWith('/contact'),        loader: () => import('@/pages/Contact') },
  { match: p => p.startsWith('/editor') || p.startsWith('/video-editor'),
                                                  loader: () => import('@/pages/VideoEditor') },
  { match: p => p.startsWith('/admin'),          loader: () => import('@/refine/AdminLayout') },
  { match: p => p.startsWith('/workspace'),      loader: () => import('@/pages/workspace/WorkspaceOverview') },
];

const warmed = new Set<string>();

function schedule(fn: () => void) {
  // requestIdleCallback when available; otherwise microtask.
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === 'function') {
    ric(fn, { timeout: 250 });
  } else {
    Promise.resolve().then(fn);
  }
}

export function prefetchRoute(path: string | undefined | null): void {
  if (!path || typeof path !== 'string') return;
  // Strip query/hash so /create?foo and /create#bar share a cache entry.
  const clean = path.split('?')[0].split('#')[0];
  if (warmed.has(clean)) return;

  const entry = REGISTRY.find(r => r.match(clean));
  if (!entry) return;

  warmed.add(clean);
  schedule(() => {
    entry.loader().catch(() => {
      // Network blip / chunk error — allow retry on next hover.
      warmed.delete(clean);
    });
  });
}

/** Optional: warm a hard-coded list (e.g. top-nav items) at app idle. */
export function prefetchRoutes(paths: string[]): void {
  paths.forEach(prefetchRoute);
}