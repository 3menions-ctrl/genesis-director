/**
 * UserPreferencesContext — single source of truth for every preference
 * stored in `profiles.preferences` and `profiles.notification_settings`.
 *
 * All consumers (ThemeProvider, video players, Studio defaults, etc.)
 * read from this hook so the settings page actually changes how the app
 * behaves end-to-end — no "writes work but no consumer reads them" gaps.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

const LS_KEY = "smallbridges.user-prefs.cache";

function readCache(): UserPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_USER_PREFS, ...parsed };
  } catch {
    return null;
  }
}
function writeCache(p: UserPrefs) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Optimistically read the last-known prefs from localStorage so the
  // theme/motion/etc decisions don't flicker on cold-start.
  const [prefs, setPrefsState] = useState<UserPrefs>(() => readCache() ?? DEFAULT_USER_PREFS);
  const [isLoaded, setIsLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoaded(true);
      return;
    }
    try {
      const { data } = await supabase
        .from("profiles" as never)
        .select("preferences")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        const next = { ...DEFAULT_USER_PREFS, ...((data as any).preferences ?? {}) } as UserPrefs;
        setPrefsState(next);
        writeCache(next);
      }
    } finally {
      setIsLoaded(true);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const setPrefs = useCallback(async (next: Partial<UserPrefs>) => {
    setPrefsState((prev) => {
      const merged = { ...prev, ...next };
      writeCache(merged);
      return merged;
    });
    if (!user?.id) return;
    const merged = { ...prefs, ...next };
    await supabase
      .from("profiles" as never)
      .update({ preferences: merged } as never)
      .eq("id", user.id);
  }, [user?.id, prefs]);

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
