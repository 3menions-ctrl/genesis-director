/**
 * Auth token storage adapter for Supabase.
 *
 *   • Native (iOS): tokens live in the iOS Keychain via
 *     @aparajita/capacitor-secure-storage — encrypted at rest, not readable by
 *     other apps, and not exposed in the webview's localStorage.
 *   • Web: falls back to window.localStorage (unchanged from before).
 *
 * The plugin's getItem/setItem/removeItem already match the Web Storage shape
 * Supabase expects (sync OR async return values both accepted), so this adapter
 * is a thin, fail-safe wrapper: if the Keychain ever errors we degrade to
 * localStorage rather than logging the user out.
 */
import { IS_NATIVE } from './index';

type SupabaseStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

// Lazily load the native plugin exactly once. Never imported on web, so it
// stays out of the browser bundle.
let securePromise: Promise<typeof import('@aparajita/capacitor-secure-storage').SecureStorage> | null =
  null;
function secure() {
  if (!securePromise) {
    securePromise = import('@aparajita/capacitor-secure-storage').then((m) => m.SecureStorage);
  }
  return securePromise;
}

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const authStorage: SupabaseStorage = {
  async getItem(key) {
    if (!IS_NATIVE) return lsGet(key);
    try {
      return await (await secure()).getItem(key);
    } catch {
      return lsGet(key);
    }
  },
  async setItem(key, value) {
    if (!IS_NATIVE) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* quota / private mode */
      }
      return;
    }
    try {
      await (await secure()).setItem(key, value);
    } catch {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    }
  },
  async removeItem(key) {
    if (!IS_NATIVE) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      await (await secure()).removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
