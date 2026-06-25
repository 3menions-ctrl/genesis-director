/**
 * NativeShell — the bridge between the Capacitor native runtime and the React
 * Router app. Mounted once inside <BrowserRouter> (so it can navigate).
 *
 * Responsibilities:
 *   • Boot native chrome (status bar / keyboard) and hide the splash screen.
 *   • Handle incoming deep links (custom scheme + Universal Links) → router.
 *   • Handle the Android-style hardware back button (harmless on iOS).
 *   • Forward Supabase auth-callback deep links into the existing /auth flow.
 *
 * Entirely inert on web: every effect early-returns when !IS_NATIVE, and the
 * Capacitor plugins are dynamically imported so they never enter the web chunk.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IS_NATIVE } from '@/lib/native';
import { initNativeShell, hideSplash } from '@/lib/native/shell';
import { initPush } from '@/lib/native/push';

/**
 * Map an incoming deep-link URL to an in-app path.
 *
 * Accepts both:
 *   • Custom scheme:   smallbridges://studio/abc   →  /studio/abc
 *   • Universal Link:  https://smallbridges.co/studio/abc → /studio/abc
 *
 * Auth callbacks (which carry Supabase tokens in the hash/query) are passed
 * through verbatim to /auth/callback so the existing AuthCallback page can
 * complete the session exchange.
 */
function deepLinkToPath(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // Supabase auth redirect — keep the hash/query, route to the callback page.
  const looksLikeAuth =
    url.pathname.includes('auth') ||
    /access_token|refresh_token|error_description|code=/.test(url.hash + url.search);
  if (looksLikeAuth) {
    return `/auth/callback${url.search}${url.hash}`;
  }

  // Everything else: use the path (+ query + hash) as the in-app route.
  const path = `${url.pathname}${url.search}${url.hash}`;
  return path && path !== '/' ? path : '/';
}

export function NativeShell() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!IS_NATIVE) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      await initNativeShell();

      const { App } = await import('@capacitor/app');

      // Deep link while the app is running (or cold-started via a link).
      const urlListener = await App.addListener('appUrlOpen', ({ url }) => {
        const path = deepLinkToPath(url);
        if (path) navigate(path);
      });

      // Hardware back button (Android). On iOS this never fires; harmless.
      const backListener = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });

      // If the app was cold-launched from a deep link, handle the initial URL.
      // Otherwise, send the native app to its mobile-first home: the feed.
      try {
        const launch = await App.getLaunchUrl();
        if (launch?.url) {
          const path = deepLinkToPath(launch.url);
          if (path) navigate(path, { replace: true });
        } else if (window.location.pathname === '/') {
          navigate('/feed', { replace: true });
        }
      } catch {
        if (window.location.pathname === '/') navigate('/feed', { replace: true });
      }

      // Kick off push-notification registration (no-op until permission).
      initPush(navigate).catch(() => {});

      cleanup = () => {
        urlListener.remove();
        backListener.remove();
      };
    })();

    // Reveal the app once React has mounted real content.
    hideSplash();

    return () => cleanup?.();
    // navigate identity is stable for the app lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
