/**
 * Native shell bootstrap — status bar, splash screen, keyboard, app lifecycle.
 *
 * Everything here is guarded by IS_NATIVE and dynamically imports the relevant
 * Capacitor plugin so that none of this native code is pulled into (or executed
 * by) the plain web bundle. Calls are individually try/caught: a single plugin
 * failing must never block app boot.
 */
import { IS_NATIVE, IS_IOS } from './index';

let booted = false;

/**
 * Configure the native chrome and hide the launch splash. Call once, as early
 * as the React tree is interactive. No-op on web.
 */
export async function initNativeShell(): Promise<void> {
  if (!IS_NATIVE || booted) return;
  booted = true;

  // ── Status bar ──────────────────────────────────────────────────────────
  // The app theme is near-black (#0a0a0a) with light text, so we want light
  // (white) status-bar glyphs and a transparent bar that the web content can
  // draw under (we reserve the inset via CSS env(safe-area-inset-top)).
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark }); // Dark = light text
    if (IS_IOS) {
      // On iOS, overlay lets web content extend under the status bar.
      await StatusBar.setOverlaysWebView({ overlay: true });
    }
  } catch {
    /* status bar not critical */
  }

  // ── Keyboard ────────────────────────────────────────────────────────────
  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    // Add a class to <html> while the keyboard is open so layouts can react.
    Keyboard.addListener('keyboardWillShow', () => {
      document.documentElement.classList.add('keyboard-open');
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.classList.remove('keyboard-open');
    });
  } catch {
    /* keyboard plugin optional */
  }

  // Mark the document as running natively so CSS can adapt (see index.css).
  document.documentElement.classList.add('capacitor-native');
  if (IS_IOS) document.documentElement.classList.add('platform-ios');
}

/**
 * Hide the splash screen. Called once React has painted real content so the
 * user never sees a white flash between the launch image and the app.
 */
export async function hideSplash(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* nothing to hide on web */
  }
}

/** Light haptic tap — used to make native interactions feel responsive. */
export async function hapticTap(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* haptics optional */
  }
}
