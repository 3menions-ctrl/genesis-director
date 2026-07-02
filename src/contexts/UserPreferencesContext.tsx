/**
 * UserPreferencesContext — single source of truth for every preference
 * stored in `profiles.preferences` and `profiles.notification_settings`.
 *
 * All consumers (ThemeProvider, video players, Studio defaults, etc.)
 * read from this hook so the settings page actually changes how the app
 * behaves end-to-end — no "writes work but no consumer reads them" gaps.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserPrefs {
  // Appearance
  theme: "light" | "dark" | "system";
  compactMode: boolean;
  showTutorialHints: boolean;
  reducedMotion: "system" | "reduce" | "no-preference";
  language: string;
  timezone: string;
  // Playback
  autoplayVideos: boolean;
  defaultVolume: number;
  defaultPlaybackSpeed: number;
  captionsDefault: boolean;
  // Generation
  defaultQualityTier: "standard" | "pro" | "cinematic";
  defaultGenre: string;
  defaultEngine: "wan" | "kling";
  defaultAspectRatio: "16:9" | "9:16" | "1:1";
  defaultReelVisibility: "public" | "unlisted" | "private";
  // Privacy
  dmPermission: "everyone" | "followers" | "nobody";
  followPermission: "everyone" | "mutual_only";
  // Identity / presentation (also persisted in profiles.preferences — routed
  // through here so they share one live base with the rest of the column).
  pronouns: string;
  themeAccent: string;
}

export const DEFAULT_USER_PREFS: UserPrefs = {
  theme: "system",
  compactMode: false,
  showTutorialHints: true,
  reducedMotion: "system",
  language: "en",
  timezone: typeof Intl !== "undefined" ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC") : "UTC",
  autoplayVideos: true,
  defaultVolume: 80,
  defaultPlaybackSpeed: 1,
  captionsDefault: false,
  defaultQualityTier: "standard",
  defaultGenre: "drama",
  defaultEngine: "wan",
  defaultAspectRatio: "16:9",
  defaultReelVisibility: "public",
  dmPermission: "everyone",
  followPermission: "everyone",
  pronouns: "",
  themeAccent: "blue",
};

interface UserPreferencesContextValue {
  prefs: UserPrefs;
  isLoaded: boolean;
  /** Patch one or more preference keys; persists to DB and updates locally. */
  setPrefs: (next: Partial<UserPrefs>) => Promise<void>;
  /** Force a re-fetch (e.g. after the Settings page makes a direct update). */
  refresh: () => Promise<void>;
}

const Ctx = createContext<UserPreferencesContextValue | null>(null);

// Cache is namespaced per user id so a shared browser never leaks one
// account's prefs (theme, privacy, default reel visibility) to the next.
const LS_PREFIX = "smallbridges.user-prefs.cache.";
const LS_LAST_UID = "smallbridges.user-prefs.last-uid";

function lastUid(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(LS_LAST_UID); } catch { return null; }
}
function readCache(uid: string | null): UserPrefs | null {
  if (typeof window === "undefined" || !uid) return null;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + uid);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_USER_PREFS, ...parsed };
  } catch {
    return null;
  }
}
function writeCache(uid: string | null, p: UserPrefs) {
  if (typeof window === "undefined" || !uid) return;
  try {
    window.localStorage.setItem(LS_PREFIX + uid, JSON.stringify(p));
    window.localStorage.setItem(LS_LAST_UID, uid);
  } catch { /* ignore */ }
}

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Optimistically read the last-known prefs from localStorage so the
  // theme/motion/etc decisions don't flicker on cold-start.
  const [prefs, setPrefsState] = useState<UserPrefs>(() => readCache(lastUid()) ?? DEFAULT_USER_PREFS);
  const [isLoaded, setIsLoaded] = useState(false);
  // Imperative mirror of `prefs` so rapid successive setPrefs() calls each
  // merge onto the latest value (not a stale render snapshot) — both for the
  // local update and the DB write. Without this, two quick toggles clobber
  // each other in the `profiles.preferences` JSONB column.
  const prefsRef = useRef<UserPrefs>(prefs);

  const load = useCallback(async () => {
    if (!user?.id) {
      // Signed out — drop the previous account's prefs so the next user who
      // signs in on this browser starts from defaults, not the cached values.
      setPrefsState(DEFAULT_USER_PREFS);
      prefsRef.current = DEFAULT_USER_PREFS;
      setIsLoaded(true);
      return;
    }
    // Reset to whatever is cached for *this* user (or defaults) before the
    // fetch resolves, so a different prior user's prefs never show through.
    const cached = readCache(user.id) ?? DEFAULT_USER_PREFS;
    setPrefsState(cached);
    prefsRef.current = cached;
    try {
      const { data } = await supabase
        .from("profiles" as never)
        .select("preferences")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        const next = { ...DEFAULT_USER_PREFS, ...((data as any).preferences ?? {}) } as UserPrefs;
        setPrefsState(next);
        prefsRef.current = next;
        writeCache(user.id, next);
      }
    } finally {
      setIsLoaded(true);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const setPrefs = useCallback(async (next: Partial<UserPrefs>) => {
    // Merge onto the imperative ref (always current), update it synchronously,
    // then write that exact value to both local state and the DB.
    const merged = { ...prefsRef.current, ...next };
    prefsRef.current = merged;
    setPrefsState(merged);
    if (!user?.id) return;
    writeCache(user.id, merged);
    const { error } = await supabase.rpc("update_my_profile" as never, {
      p_patch: { preferences: merged },
    } as never);
    // eslint-disable-next-line no-console
    if (error) console.warn("[UserPreferences] persist failed", error);
  }, [user?.id]);

  const value = useMemo<UserPreferencesContextValue>(() => ({
    prefs, isLoaded, setPrefs, refresh: load,
  }), [prefs, isLoaded, setPrefs, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUserPreferences(): UserPreferencesContextValue {
  const v = useContext(Ctx);
  if (!v) {
    // Soft fallback so unmounted/test contexts don't crash. The
    // signed-out state of the app uses defaults across the board.
    return {
      prefs: DEFAULT_USER_PREFS,
      isLoaded: true,
      setPrefs: async () => {},
      refresh: async () => {},
    };
  }
  return v;
}

/** Convenience hook returning just the prefs object. */
export function useUserPrefs(): UserPrefs {
  return useUserPreferences().prefs;
}
