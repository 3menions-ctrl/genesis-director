# Overnight autonomous cycle — running log (2026-06-25 → 26)

Cycle = complete/fix → triple-check (tsc app-config, Playwright crash sweep,
functional/backend check) → gap-analysis → repeat. All claims verified against the
LIVE backend (types.ts is drifted). Branch `ios-app`; nothing pushed to main/DB.

## Fixes shipped (app-side, verified, committed)
- **Signed-out feed showed sample films** — `useReelsFeed` selected the anon-restricted
  `comment_count` → query 400'd → static fallback. Dropped the column. (`2ffc1b9d`)
- **DM sending was a silent no-op** — `send_direct_message` overload ambiguity (PGRST203).
  Added `p_reply_to_id:null` to bind the 5-arg overload. Round-trip verified. (`177d3f51`)
- **DM reading was broken** — called non-existent `get_decrypted_messages`; now reads
  `direct_messages` directly (plaintext). (earlier, same session)
- **Discovery surfaced nobody** — People deck + search read empty `find_friends_directory`;
  switched to `profiles_public` (13 real users). (earlier)
- **Creator cover never loaded** — read RLS-locked `profiles`; now `profiles_public.cover_url`.
- **Creator profile crashed** (`isSelf` undefined) — defined it. (`9c9e3712`)
- **Creator profile** made fully immersive + **media moved to a masonry gallery** below.

## Backend defects found (GATED — documented, NOT pushed; see BACKEND_BUGS.md)
- `toggle_like_reel`, `toggle_like_reel_comment`, `toggle_block` (+ `react_to_message`,
  app-unused `toggle_follow`): all `v_existed bool` vs `ROW_COUNT` int → runtime
  `operator does not exist: boolean = integer`. Likes / comment-likes / blocking don't
  persist. One-line fix each (`bool`→`int`). App handles the failure gracefully. (`f50696f3`)

## Verified CLEAN (no bug)
- 21 routes: 0 runtime crashes. 9 interaction flows (sheets/swipes/toggles/publish/
  message/comments): 0 crashes.
- Write RPCs that work: `add_reel_comment`, `remix_reel`, `update_user_streak`,
  `toggle_pin_reel` (graceful `not_your_reel`).
- Social/profile data sources correct: `useFollowList`/`useInbox` use
  `user_follows`/`direct_messages` + `profiles_public`. Following list resolves +
  renders 3 real users. Empty notifications/likes/followers/inbox = new account, not a bug.
- Create-mode handoffs (image/photo/music/template → chrome-free Studio/MusicHub) all
  render without crashes.
- No ambiguous-overload RPCs in the native path other than `send_direct_message` (fixed).

## Cycle 5 — visual QA + write verification
- **Fixed: Leaderboard rendered blank with 1-2 ranked users** — podium needed 3 rows
  and the list only showed rows beyond top-3, so a 1-2 row board showed nothing.
  Now renders everyone as a list when <3. (`b881874f`)
- Visual QA of 16 screens signed-in: all others clean (feed, discover, you, recap,
  activity, messages, plans, settings, generate, presets, templates, library,
  avatars, create, immersive reel). Proper empty states everywhere (new account).
- `update_profile_text` (edit-profile save) verified working ({"success":true}).
- Minor (not bugs): profile "following" count can exceed the list when a followee
  has no public display_name; mobile edit sheet omits p_location (not editable).

## Cycle 6 — generate-flow correctness + production edge cases
- **Verified (read, no spend): NativeGenerate's mode-router request matches the web's
  proven handleStartCreation** on all required fields (mode/userId/prompt/aspectRatio/
  clipCount/clipDuration/clipDurations/enableNarration/enableMusic/videoEngine/
  qualityOptions). The web's extra fields are optional/undefined for plain text/
  image-to-video → a funded user's generation will work. No fix needed.
- **Fixed: NativeProduction could spin at 100% forever** if a project completes with
  no video_url/manifestUrl — added a terminal "ready → Library/Publish" state. (`8e404ae9`)

## Cycle 7 — component edge-case audit (CLEAN)
Audited every native component/sheet for "renders nothing/wrong" + null/edge crashes:
- PeopleSwipe: end-of-deck → `<AllCaught>` ("That's everyone" / "No new creators" +
  Refresh). MediaTile: null src AND videoSrc → fallback gradient (no crash).
- PublishSheet: useWorlds has WORLDS_FALLBACK (6) → never empty.
- FeedComments: empty → "No comments yet"; loading state present.
- MessageThread: empty thread + loading states present.
- Presets: clips = mine + SAMPLES (8 bundled, always non-empty) → clips[0] safe;
  src defaults to '' (no crash).
- You.tsx: PinSheet (films.length===0), PeopleSheet (followers/following empty),
  content tabs (EmptyTab) all have empty states.
Result: no component-level bugs — the component layer is robust.

## Cycle 8 — full regression sweep (+ a real crash caught by the CORRECT tsc)
- Crash sweep: 0 pageerrors / 22 routes. Interaction sweep: 0 / 8. Key fixes
  re-verified live: anon feed query 200, DM send+read-back+cleanup, leaderboard
  renders, all green.
- **Fixed: tapping a People-deck card crashed** — PeopleSwipe onTap read
  `info.offset.x`, but framer-motion's TapInfo has no `offset` →
  "Cannot read properties of undefined (reading 'x')" on every card tap, so
  opening a profile from the deck threw and never navigated. `onTap={() => onOpen()}`.
  Now navigates to /u/:id, zero errors. (`96c2e107`)
  CAUGHT BY: running `tsc -p tsconfig.app.json` (the correct project) over ALL 62
  session files — my earlier `-p tsconfig.json` had hidden these. Same root cause
  that hid the isSelf crash. Lesson reinforced.
- Also cleaned type errors in session files (no runtime change): AvatarLibrary
  filter typing, useDiscover daily-prompt null-narrowing, You.tsx cover_url cast.
- Remaining 2 erroring session files are PRE-EXISTING web pages from the original
  ios-app commit, not native work: Profile.tsx (redirected to /you on native —
  unreachable) and CreationHub.tsx (non-crash aspect-setState type looseness in the
  web Studio). All 60 native files are tsc-clean.

## Cycle 9 — deep gesture/media/flow sweep (CLEAN)
Exercised the interactions the basic sweep missed (where the People-tap crash hid):
- Tap media tiles directly (discover/avatar/library) · swipe gestures (people deck
  L/R drag, creator profile swipe, feed scroll) · media controls (avatar voice
  play, reel mute, presets compare-hold) · multi-step flows (create video + music
  wizards, /welcome steps, settings autosave toggles) · comment composer.
- Result: 0 crashes / 14 interactions. The Cycle-8 People-tap fix resolved the last
  interaction crash; no new ones. Native files stay tsc-clean (no code changes).

## Cycle 10 — network-failure resilience (PASS + 1 documented edge case)
- Aborted ALL supabase data traffic (rest/rpc/functions/realtime) and loaded every
  major data screen: **0 crashes, 0 stuck spinners** — graceful degradation. Hooks
  all clear loading in catch/finally or use React Query; usePinnedReels has no
  loading state (its bare catch is fine).
- FOUND (documented, NOT auto-fixed — critical shared auth path): an offline/slow
  launch can bounce an already-onboarded user to /welcome. When get_my_profile
  times out, AuthContext commits a FALLBACK profile with onboarding_completed=false
  (intentional, "MUST be false — forces onboarding for new OAuth users",
  authProfile.ts:15), and MobileOnboardingGate redirects on it. Severity LOW
  (recoverable: tap Skip; corrects when the authoritative profile loads; no crash).
  RECOMMENDED FIX (needs review + testing, not applied autonomously): expose a
  monotonic `profileAuthoritative` boolean from AuthContext
  (`setProfileAuthoritative(p => p || authoritative)` at the reconcileProfile commit
  sites ~166/191/286/376; reset to false on the setProfile(null) sign-out sites),
  add it to the context value/type, and in MobileOnboardingGate require
  `profileAuthoritative` before redirecting (`if (!profileAuthoritative) return;`).
  Then a fallback profile can never trigger onboarding; real new users still get it
  once their authoritative (onboarding=false) profile loads.

## Cycle 11 — console / React-warning sweep (CLEAN)
Captured console warnings+errors across all routes:
- **No React warnings** — no "unique key" warnings, no controlled/uncontrolled input,
  no setState-after-unmount, no act() warnings. Component code is solid (stable keys,
  controlled inputs throughout).
- CSP meta warnings (X-Frame-Options + frame-ancestors ignored in <meta>) are KNOWN
  & INTENTIONAL (index.html:46-48 comment — real enforcement ships as HTTP headers;
  for the native webview the meta CSP is the only CSP, so it's needed). Left as-is.
- 3 MEDIA 404s (a few reels/sample films reference missing storage objects) — DATA
  issue, not app code; handled gracefully by MediaTile/img fallbacks. Noted.

## Cycle 12 — native config + ship-readiness (2 real ship-blockers fixed)
- **FIXED: missing camera/photo-library usage strings** (Info.plist). The app uploads
  photos via the WKWebView file picker (avatar/cover/film); its Take-Photo/Library
  options touch the camera+library in-process → iOS HARD-CRASHES without the purpose
  strings + App Review rejects. Added NSCameraUsageDescription +
  NSPhotoLibraryUsageDescription (read-only; no Add). plutil -lint OK. (`9b8a36bd`)
- **FIXED: Apple 3.1.1 external-purchase link** in Plans. It had a tappable "Manage
  plan on the web" → Browser.open(smallbridges.co/credits), steering to external
  purchase of digital credits — the exact 3.1.1 reject pattern AND a drift from the
  app's own policy (IOS_SETUP §5: "we deliberately do not link out to the web
  checkout"). Replaced with the neutral non-tappable notice. (`bef04164`)
- VERIFIED clean: Info.plist valid + has deep-link URL scheme (smallbridges://),
  push background mode, ITSAppUsesNonExemptEncryption=false; AppIcon + Splash assets
  present; spend-only enforced (PURCHASING_ENABLED=!IS_NATIVE; no StoreKit; no
  @capacitor/camera or other permission-linking plugins beyond push/keychain).
- Updated IOS_SETUP §8 with the usage-strings note.

## Cycle 13 — spend-only / Apple 3.1.1 completeness (PASS)
Swept ALL purchase/checkout surfaces in src/. On a real native build there is NO
reachable in-app purchase or external-checkout path — verified at every layer:
- `startCreditCheckout` hard-throws when IS_SPEND_ONLY (source-level guarantee).
- Pricing.tsx: `if (IS_NATIVE) navigate('/studio'); return null;` — no buy UI.
- /credits route → <Navigate to="/account?tab=credits"> → (MobileRouteRedirects)
  /account → /you. Studio's navigate('/credits') resolves the same way.
- Plans (native /me/plans): external "Manage on web" link already removed (cycle 12);
  packs are view-only info + a neutral notice.
- Buy UI hidden via PURCHASING_ENABLED=!IS_NATIVE; BuyCreditsModal/upgrade CTAs gated.
- Profile.tsx (has /credits + /pricing links) is redirected to /you on native.
- ADDED: /pricing,/billing → /me/plans in MobileRouteRedirects (defense-in-depth +
  consistency; lands credit intents on the compliant page in preview AND device).
- Runtime: /pricing→/me/plans, /credits→/you, no external page opened. (`d59eba7b`)

## Cycle 14 — ship assets + accessibility + visual regression (PASS)
- **App icon**: REAL branded "SB" art (white serif monogram on the dark-blue Aurora
  gradient + accent bar), 1024x1024, hasAlpha=NO (App Store opaque requirement met).
  NOT the Capacitor placeholder. (Minor cosmetic: baked-in rounded corners; iOS masks
  again — acceptable, not a blocker.) Splash: matching branded "SB" art, dark theme.
- **Accessibility**: 0 unlabeled buttons and 0 undersized (<40pt) unlabeled tap
  targets across 14 native screens — every interactive control has an accessible name.
- **Visual regression**: re-screenshot creator-profile masonry (varied aspect ratios,
  immersive) and leaderboard (demo's row renders) after the night's commits — both
  still correct. No regression.
- No fixes needed this cycle.

## Cycle 15 — performance / memory (PASS)
- **Feed video windowing works**: across 18 scrolls the mounted <video> count stayed
  BOUNDED at 2–3 (never grew), JS heap stable ~21MB (even dropped — GC reclaiming, no
  leak), image count flat (31), 0 pageerrors. Far cards render a poster, not a <video>;
  unmount cleanup confirmed empirically.
- **Galleries are img-only**: discover (30 imgs), creator masonry (20), templates (10),
  avatars (461 imgs, loading=lazy so off-screen bytes don't fetch) — 0 <video> elements
  mounted (real reels have thumbnails → MediaTile uses img, the metadata-video fallback
  only fires for thumbnail-less tiles, none here). No excessive simultaneous videos.
- No performance fixes needed.
