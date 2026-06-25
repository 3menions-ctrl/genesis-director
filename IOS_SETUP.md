# Small Bridges — iOS app (Capacitor) setup

This document is the hand-off for getting the native iOS app onto a simulator, a
device, and eventually the App Store. It's written so you can follow it without
guessing. Anything that needs **your Apple Developer account** or **Xcode** is
called out as a **`▶ YOU`** step — I can't do those from here.

The native shell wraps the **existing** Small Bridges web app (Vite/React) with
[Capacitor](https://capacitorjs.com). The web build is bundled into the app, so
the app works offline for its shell and only goes to the network for data
(Supabase, media, etc.).

> **Note on the mockups:** the iPhone mockups I sent (`Feed / Create / Presets /
> You`) are a *proposed redesign*, not what this build currently renders. Today
> the app runs your current responsive web UI inside the native shell. Building
> the new mobile-first UI is a separate, larger piece of work — see
> [The redesign](#the-redesign-fun--tiktok) at the bottom.

---

## 0. What's already done (in this branch, `ios-app`)

- Capacitor 8 installed and configured (`capacitor.config.ts`).
- iOS native project generated under `ios/` — **uses Swift Package Manager, not
  CocoaPods**, so there is *no* `pod install` step.
- Bundle ID **`co.smallbridges.app`**, display name **Small Bridges**, iOS 15+.
- App icon + launch/splash generated into the Xcode asset catalog from
  `assets/icon.png` (dark `#0a0a0a` theme).
- Native plugins wired: App (deep links), StatusBar, SplashScreen, Keyboard,
  Haptics, Browser, Preferences, Push Notifications, and Keychain secure storage.
- Web app made native-aware: safe-area insets, status-bar theming, splash
  hide-on-mount, service worker disabled on native, CSP updated for the
  `capacitor://localhost` scheme, deep-link → router bridge.
- **Auth tokens stored in the iOS Keychain** on device (localStorage on web).
- **Spend-only payments** on iOS (Apple guideline 3.1.1 — see
  [Payments](#5-payments--spend-only-important)).

The pieces below are what *you* need to do.

---

## 1. Prerequisites — **`▶ YOU`**

1. **A Mac with Xcode** (15 or newer). Xcode is **not installed** on this
   machine right now — install it from the App Store, then run once:
   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```
2. **Apple Developer Program membership** ($99/yr) — required for running on a
   physical device, push notifications, and any App Store / TestFlight upload.
   A *free* Apple ID is enough for the **simulator** only.
3. Node + the repo installed (`npm install`) — already done here.

You do **not** need CocoaPods/Ruby — Capacitor 8 uses Swift Package Manager.

---

## 2. Build the web app and sync it into iOS

Every time the web code changes, rebuild and copy it into the native project:

```bash
# from the repo root
npm run build          # produces dist/ (the web bundle)
npx cap sync ios       # copies dist/ into ios/ and refreshes native plugins
```

### Environment variables (important)
The web build **bakes in** `VITE_*` env vars at build time. There is no `.env`
in the repo, so create one before building or the app will boot without a
backend:

```bash
cp .env.example .env       # then fill in at least:
# VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
```
The Supabase publishable (anon) key is safe to ship in a client bundle. Do
**not** put any service-role key or server secret in a `VITE_*` var — those are
exposed in the app.

---

## 3. Open, sign, and run — **`▶ YOU`**

```bash
npx cap open ios       # opens ios/App/App.xcworkspace in Xcode
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities**.
2. Check **Automatically manage signing** and pick your **Team**. Xcode
   provisions `co.smallbridges.app` for you. (If the bundle ID is taken, change
   it in Xcode *and* in `capacitor.config.ts` → `appId`, then `npx cap sync`.)
3. **Run on a simulator:** pick e.g. *iPhone 15 Pro* in the toolbar and press
   ⌘R. No paid account needed.
4. **Run on your iPhone:** plug it in, trust the Mac, select it as the target,
   press ⌘R. First launch: on the phone, **Settings → General → VPN & Device
   Management → trust your developer cert**.

### Faster dev loop (optional live reload)
Instead of rebuilding for every change, point the app at the Vite dev server:

1. `npm run dev` (serves on port `7777`, binds to your LAN).
2. In `capacitor.config.ts`, uncomment the `server` block and set
   `url: 'http://<your-mac-LAN-ip>:7777'`.
3. `npx cap run ios`.
4. **Re-comment the `server` block before any build you intend to ship.**

---

## 4. Deep links

- **Custom scheme** `smallbridges://…` already works (declared in
  `ios/App/App/Info.plist`, routed by `src/components/native/NativeShell.tsx`).
  Test it in the simulator:
  ```bash
  xcrun simctl openurl booted "smallbridges://studio"
  ```
- **Universal Links** (`https://smallbridges.co/…` open the app) — **`▶ YOU`**:
  1. In Xcode → Signing & Capabilities → **+ Capability → Associated Domains**,
     add `applinks:smallbridges.co`.
  2. Host an `apple-app-site-association` (AASA) JSON file at
     `https://smallbridges.co/.well-known/apple-app-site-association` (served as
     `application/json`, no extension) containing your Team ID + bundle ID, e.g.:
     ```json
     { "applinks": { "details": [
       { "appID": "TEAMID.co.smallbridges.app", "paths": ["*"] }
     ] } }
     ```
  3. The router bridge already turns the incoming URL path into an in-app route.

### Supabase auth on device
Deep links carrying Supabase tokens are forwarded to `/auth/callback` by the
shell. In the **Supabase dashboard → Authentication → URL Configuration**, add
your redirect URLs (`smallbridges://auth/callback` and the Universal Link form)
so OAuth/magic-link redirects can return into the app. **`▶ YOU`**.

---

## 5. Payments — spend-only (important)

Apple **App Store Review Guideline 3.1.1** requires that digital credits
consumed in an iOS app are sold **only** through Apple In-App Purchase. We are
**not** wiring StoreKit/IAP right now, so the iOS app ships **spend-only**:

- Credit **balance** is visible and credits are **spent** normally.
- All **purchase UI is hidden** on iOS — Buy Credits buttons, the Pricing page,
  the welcome offer, and top-up CTAs. The buy modal becomes a neutral "managed
  on the web" notice, and `startCreditCheckout()` hard-throws if ever reached.
- Per 3.1.1 we deliberately **do not** link out to the web checkout from inside
  the app. Users buy credits on `smallbridges.co` in a browser.

This is controlled by `src/lib/native/purchases.ts` (`PURCHASING_ENABLED` /
`IS_SPEND_ONLY`). On the web nothing changes.

**If you later want in-app purchasing**, that's a StoreKit 2 / IAP project:
define consumable credit-pack products in App Store Connect, add a purchase +
restore flow, and validate receipts server-side (an edge function) before
granting credits. Ask me and I'll scaffold it.

---

## 6. Push notifications — **`▶ YOU`** (mostly)

Client side is scaffolded (`src/lib/native/push.ts`): it requests permission,
registers with APNs, forwards the device token to Supabase, and routes
notification taps. To make it live:

1. **Xcode** → Signing & Capabilities → **+ Capability → Push Notifications**.
   (Background delivery mode is already in `Info.plist`.)
2. **Apple Developer** → create an **APNs Auth Key (.p8)**; note the Key ID and
   your Team ID.
3. **Backend** — create the table the client writes to and an edge function that
   sends via APNs. Suggested table:
   ```sql
   create table public.device_push_tokens (
     user_id    uuid not null references auth.users(id) on delete cascade,
     token      text not null,
     platform   text not null default 'ios',
     updated_at timestamptz not null default now(),
     primary key (token)
   );
   alter table public.device_push_tokens enable row level security;
   create policy "own tokens" on public.device_push_tokens
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```
   Until this table exists the client registration is a silent no-op (it's
   wrapped in try/catch), so the app is unaffected.

---

## 7. App icon / splash — regenerating

Source art lives in `assets/` (`icon.png` 1024², `splash.png` / `splash-dark.png`
2732²). To regenerate after changing them:
```bash
npx capacitor-assets generate --ios
```
Replace `assets/icon.png` with real brand art (ideally a crisp 1024×1024) when
you have it — the current icon is upscaled from the 512px web favicon.

---

## 8. App Store submission checklist — **`▶ YOU`**

1. **App Store Connect** → create the app record with bundle ID
   `co.smallbridges.app`.
2. In Xcode: set **Version** (`MARKETING_VERSION`) and **Build**
   (`CURRENT_PROJECT_VERSION`), then **Product → Archive → Distribute App →
   App Store Connect**.
3. **Export compliance:** `ITSAppUsesNonExemptEncryption` is already set to
   `false` in `Info.plist` (standard HTTPS only), so you won't be asked each
   upload.
4. **App Privacy** questionnaire: declare what you collect (auth email, usage
   analytics via PostHog, crash data, any media). Be accurate.
5. **Review notes:** explain the **spend-only** model — "Credits are purchased on
   the website; the app only spends them, so there is no in-app purchase." Give
   the reviewer a **demo account** with credits so they can exercise creation.
6. **Minimum functionality (Guideline 4.2):** because this wraps a web app,
   make sure the native build feels like an app (it does: native splash, status
   bar, deep links, push, offline shell). The planned redesign below strengthens
   this considerably.
7. Provide screenshots for the required device sizes (6.7" and 6.5" at minimum).

---

## Command reference

```bash
npm run build            # build web bundle → dist/
npx cap sync ios         # copy web + plugins into the native project
npx cap open ios         # open in Xcode  (needs Xcode)
npx cap run ios          # build + launch on simulator/device (needs Xcode)
npx capacitor-assets generate --ios   # regenerate icons + splash
xcrun simctl openurl booted "smallbridges://studio"   # test a deep link
```

---

## The redesign ("fun > TikTok")

The mockups propose a mobile-first reimagining that is **not yet built**:

- **Feed** — a full-screen, swipeable wall of AI films; every clip is one-tap
  **Remixable** into your own (the thing TikTok structurally can't do).
- **Create** — one prompt + a style chip + a length; generate. No timeline.
- **Presets** — the entire "editor" is a swipeable deck of one-tap looks with a
  live before/after.
- **You** — a gamified profile (levels, XP, streaks, badges).
- Many current web-only pages (admin, marketing, settings depth, full editor)
  are **dropped** from the mobile app.

This is a real product build (new screens, new navigation, native gestures,
haptics, video-feed performance), best done as its own milestone on top of the
working native shell delivered here. The shell, plugins, secure storage,
deep-linking and spend-only gating it needs are already in place.
