/**
 * MobileRouteRedirects — in the native app, web-only pages (desktop dashboards,
 * the lobby, the web profile/account, etc.) must NEVER appear: they carry web
 * chrome and desktop layouts. This guard redirects those routes to their native
 * equivalents whenever they're hit inside the Capacitor shell. No-op on web.
 *
 * Pages WITHOUT a native equivalent (Studio, Editor) are intentionally left to
 * render — they're the creation tools the native app hands off to.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IS_MOBILE_SHELL } from '@/lib/native';

// [pattern, → native path]. First match wins.
const MAP: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^\/$/, () => '/feed'],            // never show the web cinema landing
  [/^\/account(?:\/.*)?$/, () => '/you'],
  [/^\/profile(?:\/.*)?$/, () => '/you'],
  [/^\/settings(?:\/.*)?$/, () => '/me/settings'],
  [/^\/c\/([^/]+)$/, (m) => `/u/${m[1]}`],
  [/^\/(?:library|projects)$/, () => '/me/library'],
  [/^\/lobby$/, () => '/feed'],
  [/^\/(?:search|explore)$/, () => '/discover'],
  [/^\/films$/, () => '/discover'],
  [/^\/cast$/, () => '/avatars'],
  [/^\/inbox$/, () => '/messages'],
];

export function MobileRouteRedirects() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!IS_MOBILE_SHELL) return;
    for (const [re, to] of MAP) {
      const m = pathname.match(re);
      if (m) { navigate(to(m), { replace: true }); return; }
    }
  }, [pathname, navigate]);
  return null;
}
