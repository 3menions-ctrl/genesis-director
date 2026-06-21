/**
 * safeStorage — localStorage / sessionStorage that never throws.
 *
 * Safari private mode, storage-quota-exceeded, and disabled-storage
 * environments all throw on `localStorage.getItem` / `.setItem`. An
 * unguarded access in a render path or a context initializer takes the
 * whole app down with a blank white screen. These wrappers swallow the
 * failure and degrade to "no persisted value" instead.
 *
 * Use these instead of touching `localStorage` / `sessionStorage`
 * directly anywhere outside a try/catch.
 */

export const safeLocalStorage = {
  get(key: string): string | null {
    try {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): boolean {
    try {
      if (typeof window === "undefined") return false;
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const safeSessionStorage = {
  get(key: string): string | null {
    try {
      if (typeof window === "undefined") return null;
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): boolean {
    try {
      if (typeof window === "undefined") return false;
      window.sessionStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    try {
      if (typeof window === "undefined") return;
      window.sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/** Parse a JSON value from localStorage, returning `fallback` on any
 *  storage error OR parse error. */
export function safeLocalJSON<T>(key: string, fallback: T): T {
  const raw = safeLocalStorage.get(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
