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
