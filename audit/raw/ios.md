# Native iOS App Audit — "Small Bridges" (Genesis Director), `ios-app` branch

Scope: the Capacitor 8 (SPM) native iOS shell + the new mobile-first "Aurora" redesign,
in the worktree `/Users/briancole/Developer/genesis-director-ios`.

**STATIC AUDIT ONLY.** Xcode is not installed on this machine, so nothing was built, run,
archived, or exercised at runtime. Every "DONE" below is a *code-path* judgement, not a
runtime verification. Anything depending on the WKWebView runtime, a real device, APNs,
getUserMedia, or an applied DB migration is explicitly downgraded to PARTIAL/UNVERIFIED.

App identity: `appId` `co.smallbridges.app`, display name **Small Bridges** (the product is
branded Small Bridges in this branch, not "Genesis Director"). iOS 15+, iPhone-first.

Diff scope vs `full-audit`: 109 files, +21,969/−7,669. iOS-relevant deltas are the entire
`ios/` native project, `src/lib/native/*`, `src/components/native/*`, `src/components/feed/*`,
and the new mobile pages (`Feed`, `Discover`, `Create`, `Welcome`, `NativeLive`,
`NativeGenerate`, `NativeProduction`, `NativeUploadReel`).

---

## 1. Shell / load strategy / native project

**Content strategy — BUNDLED local assets (DONE).**
`capacitor.config.ts:24-37` sets `webDir: 'dist'`, `backgroundColor '#0a0a0a'`,
`ios.contentInset: 'never'`, inline media allowed. The dev live-reload `server` block
(`capacitor.config.ts:39-43`) is **commented out** — correct for a shippable build (loads
from `capacitor://localhost`, offline shell, data over the network). Plugin config for
SplashScreen / Keyboard / PushNotifications present (`:44-71`).

**Native project (DONE, static).**
`ios/App/App.xcodeproj/project.pbxproj` present; SPM via `ios/App/CapApp-SPM/Package.swift`
pins `capacitor-swift-pm` 8.4.1 and 9 plugins (SecureStorage, App, Browser, Haptics,
Keyboard, Preferences, PushNotifications, SplashScreen, StatusBar) — `Package.swift:14-39`.
`Info.plist` has display name, camera/mic/photo purpose strings (`Info.plist` NS*UsageDescription),
custom URL scheme `smallbridges` (`CFBundleURLSchemes`), `UIBackgroundModes: remote-notification`,
`ITSAppUsesNonExemptEncryption=false`. `PrivacyInfo.xcprivacy` declares no tracking + required-reason
APIs (UserDefaults CA92.1, FileTimestamp C617.1).

**AppDelegate (PARTIAL / concern).** `ios/App/App/AppDelegate.swift` is the stock Capacitor
template — `open url` and `continue userActivity` are forwarded to `ApplicationDelegateProxy`
(good for deep links + Universal Links), but there are **no explicit
`didRegisterForRemoteNotificationsWithDeviceToken` / `didReceiveRemoteNotification` hooks**.
Capacitor's PushNotifications plugin registers via its own proxy, but combined with the
backend gap below, native push is not deliverable. The Push Notifications capability /
`aps-environment` entitlement is a `▶ YOU` Xcode step (documented IOS_SETUP.md §6).

**Native bootstrap is wired (DONE).** `src/components/native/NativeShell.tsx` is mounted in
`src/App.tsx:317` inside the router; it calls `initNativeShell()`, registers `appUrlOpen` /
`backButton` / `getLaunchUrl`, cold-routes `/`→`/feed` (NativeShell.tsx:56), and kicks
`initPush(navigate)`. `MobileTabBar`, `MobileOnboardingGate`, `MobileRouteRedirects` mounted at
`App.tsx:1073-1077`. Status bar / keyboard / splash-hide / haptics implemented and individually
try/caught in `src/lib/native/shell.ts:17-94`.

Rating: shell config DONE · native project DONE (static) · AppDelegate push PARTIAL.

---

## 2. Auth token storage (Keychain) — DONE (static)

`src/lib/native/secureStorage.ts` exports `authStorage`, a Supabase storage adapter that uses
`@aparajita/capacitor-secure-storage` (iOS Keychain) on native and `localStorage` on web, with
fail-safe fallback to localStorage on Keychain error (`secureStorage.ts:41-84`). It is actually
wired into the client: `src/integrations/supabase/client.ts:6,16` (`storage: authStorage`).
Runtime correctness (Keychain round-trip) is UNVERIFIED (no device).

---

## 3. Deep links — DONE (custom scheme) / PARTIAL (Universal Links)

Entry: `Info.plist` declares scheme `smallbridges` → `NativeShell.tsx:35-38` `appUrlOpen` →
`deepLinkToPath()` → `navigate()`. Cold-start handled via `App.getLaunchUrl()`
(`NativeShell.tsx:51-61`). Resolution is centralized and security-hardened in
`src/lib/native/deepLink.ts`: scheme allowlist rejects `javascript:/data:/file:`
(`deepLink.ts:25`), custom-scheme host+path reassembly (`:40-42`), Supabase auth-callback
forwarding (`:27-34`), and only ever returns a same-app absolute path. `safeInAppPath()`
(`:54-63`) is the shared validator reused by push.

Universal Links are PARTIAL: the router bridge + `continue userActivity` forwarding exist, but
the Associated Domains entitlement and the hosted `apple-app-site-association` file are
`▶ YOU` (IOS_SETUP.md §4). Custom-scheme Supabase redirect URLs must also be added in the
Supabase dashboard (`▶ YOU`).

---

## 4. Spend-only payments gating — DONE (enforced, static)

Single source of truth `src/lib/native/index.ts:15-22` (`IS_NATIVE`, `IS_IOS`) →
`src/lib/native/purchases.ts:19-22` (`PURCHASING_ENABLED = !IS_NATIVE`, `IS_SPEND_ONLY = IS_NATIVE`).
Two-layer enforcement:

- **UI hidden** behind `PURCHASING_ENABLED` at every buy surface I traced:
  `BillingSettings.tsx:212`, `CreationHub.tsx:1392`, `CostConfirmationDialog.tsx:285`,
  `CreditsDisplay.tsx:168`, `StickyGenerateBar.tsx:343`, `CreditLowInline.tsx:75`,
  `Profile.tsx:974`; welcome offer suppressed via `!IS_SPEND_ONLY` (`WelcomeOfferModal.tsx:32`);
  `BuyCreditsModal.tsx:59` renders a neutral "managed on the web" notice when `IS_SPEND_ONLY`.
- **Hard backstop at the source:** `startCreditCheckout()` throws before any provider call when
  `IS_SPEND_ONLY` (`src/lib/payments/creditPackages.ts:50-52`). Per Apple 3.1.1 there is also no
  external "buy on web" link in-app.

This is the most complete feature in the audit. Spending credits (generation) is unaffected.

---

## 5. Push notifications — BROKEN / not deliverable on iOS

Client half is scaffolded: `src/lib/native/push.ts` requests permission, calls
`PushNotifications.register()` (`push.ts:65`), and on `registration` upserts the **APNs device
token** into table **`device_push_tokens`** (`push.ts:29-37`). Tap routing reuses the validated
`safeInAppPath` allowlist (`push.ts:78-82`) — good. `refreshPushToken()` re-registers post-login.

Where it BREAKS — two independent, fatal gaps:

1. **The `device_push_tokens` table does not exist in `supabase/migrations/`.** It exists only
   as a *staged, unapplied* file: `reports/ios-pending/device_push_tokens.sql`, whose own header
   says "STAGED, NOT APPLIED … DB pushes are gated … push never sends." The client upsert is
   wrapped in try/catch and silently no-ops, so the backend has zero device tokens.
2. **There is no APNs sender.** The only push edge function,
   `supabase/functions/send-push-notification/index.ts`, is **Web Push / VAPID only**
   (`web-push@3.6.7`, reads `push_subscriptions` with `endpoint/p256dh/auth_secret`,
   `index.ts:66-71`). Web Push does not deliver to a Capacitor iOS WKWebView via an APNs device
   token. No code path reads `device_push_tokens` or talks to APNs anywhere in the repo.

Net: even with the Xcode Push capability added, iOS notifications cannot be delivered. Push is
effectively MISSING end-to-end for native iOS.

---

## 6. /feed video experience

**Player — DONE (static).** `src/components/feed/FeedVideo.tsx`: a muted, inline, looping
`<video playsInline>` (`:119-130`). HLS handled correctly — native `.m3u8` via
`canPlayType('application/vnd.apple.mpegurl')` on iOS, else lazy-loaded `hls.js`
(`FeedVideo.tsx:51-72`), with `video.src` fallback. Aspect-correct `object-contain` over a
blurred poster backdrop, opacity fade on `canPlay`, error state on `onError`, progress bar
(`:35-41, 138-142`). hls.js is in deps.

**Autoplay / scroll — DONE (static).** `src/pages/Feed.tsx` snap-scroll container
(`Feed.tsx:95-101`); an `IntersectionObserver` at 0.6 ratio sets the active index
(`:47-62`); FeedVideo plays only while `active` (`FeedVideo.tsx:81-96`), rewinds off-screen.
Windowing: only active ± 1 neighbour mounts a `<video>`, far cards show a poster
(`Feed.tsx:154-160`). Infinite scroll triggers `loadMore` near the end (`:65`); pull-to-refresh
(`:67-73`).

**Data — DONE/PARTIAL.** `src/hooks/useReelsFeed.ts` queries `published_reels`
(`is_taken_down=false`, ordered by `play_count`, paged) decorated with `profiles_public`
(`fetchReelPage`), with a bundled static `FILMS` fallback when empty/offline/signed-out
(`staticFeed()`). PARTIAL detail: the select **omits `comment_count`** (column-restricted for
anon, would 400 the query — `useReelsFeed.ts` comment) so `comment_count` is always 0 for real
reels in the feed rail. Static fallback items carry `isStatic:true` and are correctly degraded
(no like/remix/comment backend).

**Social — DONE (static).** Like → `toggle_like_reel` RPC (`Feed.tsx:198`), Remix →
`remix_reel` RPC → `/production/:id` (`Feed.tsx:224-231`), Comments sheet, emoji React via
`useVideoReactions`, Share via Web Share + clipboard fallback. RPCs `toggle_like_reel`,
`remix_reel`, `tip_reel` are defined in `supabase/migrations/20260610230000_entertainment_hub.sql`.

**FeedComments — DONE (static).** `src/components/feed/FeedComments.tsx` uses real RPCs
`reel_comments_for`, `add_reel_comment` (optimistic), `toggle_like_reel_comment`
(`FeedComments.tsx:59,86,105`), all defined in
`supabase/migrations/20260613000000_patron_comments_messages.sql`. Static films show an empty
state.

**"LiveFlow" overlay — DONE (static, decorative).** `src/components/feed/LiveFlow.tsx` is NOT
live streaming — it is the floating-hearts burst (`useHeartBurst`/`HeartLayer`) + a TikTok-style
comment ticker (`CommentFlow`) that pulls real comments via `reel_comments_for`
(`LiveFlow.tsx:53`) and cycles them. Used in `Feed.tsx:274-275`. Cosmetic but wired to real data.

---

## 7. Live streaming (NativeLive) — PARTIAL

This is the real "Live" feature (distinct from the LiveFlow overlay). `src/pages/NativeLive.tsx`
(routed `/live`, `/live/:id` in `App.tsx:922-928`, gated on `IS_MOBILE_SHELL`).

- **Social + economy layer — real over Supabase Realtime:** presence/viewer count, broadcast
  chat, floating reactions, credit gifts via `GiftSheet` (`tip_reel`) and `live-<roomId>` channel
  (`NativeLive.tsx:166-197`). "Go live" inserts into `live_rooms` (`:65-69`); leave/end calls
  `end_live_room` RPC (`:246`).
- **Video transport — real P2P WebRTC mesh, but limited.** `src/lib/native/liveBroadcast.ts`
  (`LiveRTC`) opens one `RTCPeerConnection` per viewer, signals SDP/ICE over the same Realtime
  channel, host streams `getUserMedia({video,audio})` (`NativeLive.tsx:205-206`). The file itself
  states there is **no SFU/media server** — a P2P mesh that "won't scale" past intimate rooms; the
  header comment also says viewers may only see the host poster until an SFU is wired.
- **DB dependency risk:** the `live_rooms` table + `end_live_room`/`claim_live_guest_seat` are in
  `supabase/migrations/20260627000000_live_rooms.sql` — a **future-dated migration on a gated DB**
  (memory: `supabase db push` is a footgun, pending migration backlog). If not applied to prod,
  every `live_rooms` query 400s and Live is dead. Cannot confirm it is applied from here.
- **Runtime UNVERIFIED:** WKWebView `getUserMedia`, WebRTC negotiation, and camera permission flow
  cannot be exercised without a device/build.

Rating: PARTIAL — code is real and non-trivial, but scale-limited by design, DB-application
unverified, and runtime unverified.

---

## 8. Other mobile screens (traced, briefly)

- **Tab bar — DONE.** `MobileTabBar.tsx` renders only when `IS_MOBILE_SHELL`, 5 destinations
  (Feed/Discover/Create/Editor/Profile), hidden on immersive/auth prefixes (`:29,44-45`).
- **Onboarding gate — DONE.** `MobileOnboardingGate.tsx` redirects signed-in users with
  `!profile.onboarding_completed` to `/welcome` once (`:19-24`).
- **Create handoff — DONE.** `src/pages/Create.tsx` routes selections to the real engines:
  `/me/generate?prompt=…` (`:77,154`), `/avatars` (`:111`), `/upload` (`:113`), `/live` (`:115`),
  `/templates` (`:143`); avatar photo upload to the `avatars` storage bucket (`:130-132`).
- **Discover — DONE.** `src/hooks/useDiscover.ts` queries `channel_worlds`, `published_reels`,
  `current_daily_prompt`, and the `search_everything` RPC + `profiles_public` name match
  (`:28,46,102,127-128`); People swipe deck in `components/discover/PeopleSwipe.tsx`.

These were traced enough to confirm real data wiring but not exhaustively; treat as DONE-static.

---

## Tally

| Feature | Rating |
|---|---|
| Capacitor shell config / bundled-load strategy | DONE (static) |
| iOS native project (xcodeproj, SPM, Info.plist, Privacy manifest) | DONE (static) |
| AppDelegate remote-notification forwarding | PARTIAL |
| Status bar / splash / keyboard / haptics / safe-area | DONE (static) |
| Auth token Keychain storage | DONE (static) / runtime UNVERIFIED |
| Deep links — custom scheme | DONE (static) |
| Universal Links | PARTIAL (entitlement + AASA = ▶ YOU) |
| Spend-only payments gating | DONE (enforced) |
| Push notifications (end-to-end iOS/APNs) | BROKEN / MISSING |
| Feed video player (HLS + hls.js, autoplay, windowing) | DONE (static) |
| Feed data wiring (published_reels + fallback) | DONE; comment_count PARTIAL |
| Feed social (like/remix/react/share) + Comments | DONE (static) |
| LiveFlow hearts/comment-ticker overlay | DONE (static) |
| Live streaming (NativeLive WebRTC + economy) | PARTIAL |
| Tab bar / onboarding gate / route redirects | DONE (static) |
| Create handoff / Discover data | DONE (static) |

Counts: **DONE ≈ 11 · PARTIAL ≈ 4 · BROKEN/MISSING ≈ 1 · everything DONE is static-only (runtime UNVERIFIED).**

## Top blockers to shipping the iOS app

1. **Push notifications are non-functional on iOS.** Client targets `device_push_tokens` (table
   only staged in `reports/ios-pending/`, never migrated) and the only sender
   (`send-push-notification`) is Web Push/VAPID with no APNs path. Needs: apply the token
   migration + build an APNs sender (StoreKit-free, .p8 key) + Xcode Push capability.
2. **Gated/unapplied DB migrations.** `live_rooms` (20260627) and `device_push_tokens` are future-dated
   and the project's `supabase db push` is a known footgun. Until applied to prod, Live 400s and
   push has no table. Requires a deliberate, signed-off DB push.
3. **No build possible here / all Apple steps outstanding (`▶ YOU`).** Signing & Team, Push +
   Associated Domains + Keychain capabilities, AASA file, archive/TestFlight — none verifiable.
   The entire app is UNVERIFIED at runtime; HLS playback, IntersectionObserver autoplay, Keychain,
   getUserMedia, and WebRTC have only been read, not run.
4. **Live video does not scale (P2P mesh, no SFU)** and depends on WKWebView `getUserMedia` +
   camera entitlement that are unverified. Acceptable for a soft launch of intimate lives; not for
   large rooms.
5. **Minor data gap:** feed `comment_count` is always 0 for real reels (column omitted from the
   anon-safe select) — cosmetic but visible.
