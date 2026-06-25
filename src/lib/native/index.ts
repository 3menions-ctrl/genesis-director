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
