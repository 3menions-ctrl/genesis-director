/**
 * Native platform detection + capability flags.
 *
 * This is the single source of truth the rest of the web app uses to decide
 * "am I running inside the Capacitor native shell?" — used to toggle native
 * integrations (status bar, splash, push, secure storage, deep links) and to
 * switch the app into spend-only mode (Apple IAP rules) on iOS.
 *
 * Safe to import anywhere: `@capacitor/core` resolves on the web too, where
 * `isNativePlatform()` returns false and `getPlatform()` returns "web".
 */
import { Capacitor } from '@capacitor/core';

/** True only inside the Capacitor native runtime (iOS/Android), false on web. */
export const IS_NATIVE: boolean = Capacitor.isNativePlatform();

/** 'ios' | 'android' | 'web' */
export const PLATFORM: string = Capacitor.getPlatform();

export const IS_IOS: boolean = PLATFORM === 'ios';
export const IS_ANDROID: boolean = PLATFORM === 'android';

/** Is a given Capacitor plugin actually available in this runtime? */
export function isPluginAvailable(name: string): boolean {
  return Capacitor.isPluginAvailable(name);
}

/**
 * Whether to show the mobile app chrome (bottom tab bar, mobile-only screens).
 * True inside the native shell, and ALSO on the web when previewing the mobile
 * UI via `?shell=mobile` (sticky via localStorage; `?shell=web` clears it).
 * This lets the iPhone-style UI be previewed in a desktop/mobile browser
 * without a device build.
 */
function computeMobileShell(): boolean {
  if (IS_NATIVE) return true;
  if (typeof window === 'undefined') return false;
  try {
    const param = new URL(window.location.href).searchParams.get('shell');
    if (param === 'mobile') {
      window.localStorage.setItem('sb_shell', 'mobile');
      return true;
    }
    if (param === 'web') {
      window.localStorage.removeItem('sb_shell');
      return false;
    }
    return window.localStorage.getItem('sb_shell') === 'mobile';
  } catch {
    return false;
  }
}

export const IS_MOBILE_SHELL: boolean = computeMobileShell();

// Apply a class so CSS (e.g. --tabbar-h) reacts in the web preview too. On
// native this class is added by the shell bootstrap instead.
if (typeof document !== 'undefined' && IS_MOBILE_SHELL && !IS_NATIVE) {
  document.documentElement.classList.add('mobile-shell-preview');
}
