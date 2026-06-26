/**
 * WelcomeSalutation — a brief, cinematic "welcome back" greeting shown
 * once per browser session right after the user is authenticated.
 *
 * Personalization, all client-side (no IP lookup, no PII round-trip):
 *   • Name      — from profile.display_name, falling back to the email
 *                 local-part, then a friendly "director".
 *   • Time      — morning / afternoon / evening / late-night greeting
 *                 derived from the local clock.
 *   • Place     — a city hint derived from the browser's IANA timezone
 *                 (e.g. "America/New_York" → "New York"). This is what
 *                 makes it feel location-aware without asking for the
 *                 location permission or hitting a geo service.
 *
 * Shows once per session (sessionStorage flag via safeSessionStorage so
 * Safari private mode can't crash it), auto-dismisses after ~4.5s, and
 * is fully reduced-motion aware.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { safeSessionStorage } from "@/lib/safeStorage";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import { cn } from "@/lib/utils";

const SHOWN_KEY = "smallbridges.welcome.shown";

function timeOfDayGreeting(hour: number): { label: string; accent: string } {
  if (hour < 5) return { label: "Burning the midnight oil", accent: "hsl(265 80% 70%)" };
  if (hour < 12) return { label: "Good morning", accent: "hsl(38 95% 62%)" };
  if (hour < 17) return { label: "Good afternoon", accent: "hsl(190 90% 60%)" };
  if (hour < 22) return { label: "Good evening", accent: "hsl(280 80% 68%)" };
  return { label: "Working late", accent: "hsl(265 80% 70%)" };
}

/** Derive a human city/region from an IANA timezone string. The last
 *  path segment with underscores turned into spaces is a remarkably
 *  good city label for the vast majority of zones. */
function cityFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || !tz.includes("/")) return null;
    const seg = tz.split("/").pop() ?? "";
    const city = seg.replace(/_/g, " ").trim();
    return city.length > 0 ? city : null;
  } catch {
    return null;
  }
}

function firstName(displayName: string | null | undefined, email: string | null | undefined): string {
  const n = (displayName ?? "").trim();
  if (n) return n.split(/\s+/)[0];
  const local = (email ?? "").split("@")[0]?.trim();
  if (local) {
    // Title-case a plausible name out of the email local-part.
    const cleaned = local.replace(/[._-]+/g, " ").trim();
    if (cleaned) {
      // Title-case the first word. The old form did .slice(1) twice and dropped
      // a second character ("john" -> "Jhn"), audit S221.
      const first = cleaned.split(" ")[0];
      return first.charAt(0).toUpperCase() + first.slice(1);
    }
  }
  return "director";
}

export function WelcomeSalutation() {
  const reducedMotion = useReducedMotion();
  const { user, profile, loading } = useAuth();
  const [show, setShow] = useState(false);
  const [data, setData] = useState<{
    name: string;
    greeting: string;
    accent: string;
    city: string | null;
  } | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    // Once per session only.
    if (safeSessionStorage.get(SHOWN_KEY) === "1") return;

    const now = new Date();
    const { label, accent } = timeOfDayGreeting(now.getHours());
    setData({
      name: firstName(profile?.display_name, user.email),
      greeting: label,
      accent,
      city: cityFromTimezone(),
    });
    setShow(true);
    safeSessionStorage.set(SHOWN_KEY, "1");

    const t = window.setTimeout(() => setShow(false), 4500);
    return () => window.clearTimeout(t);
  }, [loading, user, profile?.display_name, user?.email]);

  if (!data) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          // Top-center banner, floating above the shell chrome.
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
          transition={
            reducedMotion ? { duration: 0.2 } : { type: "spring", stiffness: 240, damping: 26 }
          }
          className="fixed left-1/2 top-5 z-[60] -translate-x-1/2 pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div
            className={cn(
              "relative flex items-center gap-3.5 rounded-2xl px-5 py-3.5",
              "border border-white/[0.12]",
              "bg-[hsl(220_30%_6%/0.72)] backdrop-blur-2xl",
              "shadow-[0_24px_70px_-20px_hsl(0_0%_0%/0.85)]",
            )}
            style={{
              boxShadow: `0 24px 70px -20px hsl(0 0% 0% / 0.85), 0 0 0 1px ${data.accent}22, 0 0 50px -16px ${data.accent}66`,
            }}
          >
            {/* Pulsing sparkle puck */}
            <span
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: `radial-gradient(circle at 30% 30%, ${data.accent}40, transparent 70%)` }}
            >
              {!reducedMotion && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: `0 0 0 1px ${data.accent}55` }}
                  animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <Sparkles className="h-4 w-4" style={{ color: data.accent }} strokeWidth={1.8} />
            </span>

            <div className="min-w-0">
              <p
                className="font-display italic text-[18px] leading-tight font-light tracking-tight text-foreground"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {data.greeting},{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: `linear-gradient(95deg, ${data.accent}, hsl(0 0% 98%))` }}
                >
                  {data.name}
                </span>
              </p>
              <p className={cn(TYPE_META, "mt-0.5 text-muted-foreground/55 tracking-[0.2em]")}>
                {data.city ? `Welcome back · ${data.city}` : "Welcome back to Small Bridges"}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
