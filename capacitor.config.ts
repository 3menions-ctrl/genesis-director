import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the native iOS (and future Android) shell of the
 * Small Bridges web app.
 *
 * Content strategy: BUNDLED LOCAL ASSETS. `npm run build` emits the SPA into
 * `dist/`, and `npx cap sync` copies it into the native project. The app loads
 * from `capacitor://localhost` (offline-capable shell); all data/API calls
 * still go out to Supabase / remote services. This is the App-Store-friendly
 * "real native app" path (vs. pointing the webview at the live URL).
 *
 * ── Local live-reload during development ──────────────────────────────────────
 * To iterate against the Vite dev server on a simulator/device, run
 * `npm run dev` (port 7777) and temporarily uncomment the `server` block below,
 * pointing `url` at your Mac's LAN IP, then `npx cap run ios`. Re-comment it
 * before producing any build you intend to ship — a shipped app must NOT point
 * at a dev server.
 */
const config: CapacitorConfig = {
  appId: 'co.smallbridges.app',
  appName: 'Small Bridges',
  webDir: 'dist',
  // Dark background everywhere the native layer shows through (status bar
  // area, launch, rotation) so there is no white flash against the app's
  // near-black (#0a0a0a) theme.
  backgroundColor: '#0a0a0a',
  ios: {
    // Let the web content extend under the status bar / home indicator; we
    // manage the inset ourselves via CSS `env(safe-area-inset-*)`.
    contentInset: 'never',
    backgroundColor: '#0a0a0a',
    // Allow media (generated videos, previews) to play inline rather than
    // forcing fullscreen native playback.
    limitsNavigationsToAppBoundDomains: false,
  },
  // server: {
  //   // ── DEV LIVE-RELOAD ONLY — never ship this uncommented ──
  //   // url: 'http://192.168.1.XX:7777',
  //   // cleartext: true,
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false, // we hide it manually once React has mounted
      backgroundColor: '#0a0a0a',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      // Resize only the body so fixed/safe-area chrome stays put when the
      // on-screen keyboard appears.
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      // Show banner + badge + sound while the app is foregrounded.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
