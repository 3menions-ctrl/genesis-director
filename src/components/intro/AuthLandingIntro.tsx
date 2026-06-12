/**
 * AuthLandingIntro — global "first thing after login" brand reveal.
 *
 * Mounted once at the App root. Watches AuthContext: the moment a real
 * user object materialises in a session that hasn't already played the
 * intro, the overlay fires.
 *
 * Gate: a sessionStorage flag (`sb.intro_seen_this_session`) keyed per
 * user id. Cleared automatically when the user signs out (the sign-out
 * flow already nukes every `apex.*` key).
 *
 * Skip rules:
 *   • The user can hit the Skip button or Esc after the first ~1.8s of
 *     the intro (the horizon-line draw window) — see IntroOverlay.
 *   • If the user has never seen the intro (cold signup), the skip
 *     waits 3.5s instead so they get a full first impression.
 *   • Anything triggered before auth resolved (the loading splash) is
 *     ignored — only authenticated users get the brand reveal.
 *
 * Routes excluded: /auth, /forgot-password, /reset-password, /auth/callback,
 * /verify, /confirm, /admin (admins land on /admin and shouldn't get a
 * consumer brand reveal every time).
 */
import { memo, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { IntroOverlay } from "@/components/intro/IntroOverlay";

const SESSION_FLAG = 'smallbridges.intro_seen_this_session';
const LIFETIME_FLAG = 'smallbridges.intro_seen_lifetime';

const EXCLUDED_PATH_PREFIXES = [
  "/auth",
  "/verify",
  "/confirm",
  "/forgot-password",
  "/reset-password",
  "/admin",
  "/p/",       // public share pages do their own thing
  "/embed/",   // embed players too
  "/contact",
];

export const AuthLandingIntro = memo(function AuthLandingIntro() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    // Skip the brand reveal on routes that aren't the user's "first stop."
    if (EXCLUDED_PATH_PREFIXES.some((p) => location.pathname.startsWith(p))) return;

    let seenThisSession = false;
    try {
      seenThisSession = sessionStorage.getItem(SESSION_FLAG) === user.id;
    } catch { /* ignore storage failures */ }
    if (seenThisSession) return;

    try {
      sessionStorage.setItem(SESSION_FLAG, user.id);
    } catch { /* ignore */ }
    setOpen(true);
  }, [loading, user, location.pathname]);

  const isFirstEver = (() => {
    try { return localStorage.getItem(LIFETIME_FLAG) !== "1"; }
    catch { return false; }
  })();

  return (
    <IntroOverlay
      open={open}
      onComplete={() => {
        setOpen(false);
        try { localStorage.setItem(LIFETIME_FLAG, "1"); } catch { /* ignore */ }
      }}
      // First-ever users get a longer skip-protect window so they actually
      // see the brand. Returning users can skip almost immediately.
      skipAvailableAfterMs={isFirstEver ? 3500 : 800}
    />
  );
});

export default AuthLandingIntro;
