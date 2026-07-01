# QA Audit — Surface 01: Social Interactions

Read-only reliability audit. Scope: likes, comments (add/edit/delete/like/react),
reactions, follows/unfollow, DMs, world/lobby chat, notifications, profile follow,
mentions/replies. Verified UI control → handler → hook/mutation → table/RPC →
migration + `types.ts` → RLS → state update → feedback.

**Overall verdict: this surface is mostly healthy.** The live paths (follows,
DMs via Inbox, reel likes/comments/reactions, world chat, notifications) are
well-built — gated RPCs, optimistic-with-rollback, user-scoped realtime,
`confirmAsync` used correctly (no `window.confirm` anywhere). The defects found
are concentrated in **dead/legacy code** (`useSocial.likeComment`, the
`MessagesInbox`/`DirectMessagePanel` DM stack, `useGamification` mutations) and
one **live data-integrity bug** in the Lobby vertical feed (duplicate reactions).

Key DB facts confirmed in `supabase/migrations/`:
- `toggle_follow(p_target)` → `{following: bool}`, deletes-or-inserts `follows(follower_id, followed_id)` — `20260706001600_fix_toggle_rpcs_rowcount_type.sql:46`.
- `toggle_like_reel` / `toggle_like_reel_comment` toggle + maintain `published_reels.like_count` / `reel_comments.like_count` — same file.
- `send_direct_message(p_recipient, p_content, p_reply_to_id, p_reel_id, p_attachments)` exists with defaults — `20260613240000_unified_inbox.sql:286`.
- `comment_likes` has `UNIQUE(comment_id, user_id)` + INSERT and DELETE RLS — `20260116132617_*.sql:269,277,280`.
- `video_reactions` / `comment_reactions` have `UNIQUE(user_id, project_id|comment_id, emoji)` — `20260206223427_*.sql:12,22`.
- `reel_reactions` has **NO** uniqueness (only `id` PK) — `20260610230000_entertainment_hub.sql:141`.
- `project_comments.likes_count` column exists but **no trigger writes it** — `20260116132617_*.sql:230`.

---

## INVENTORY

| Function | Entry point (file:line) | What it should do | Code path | Verdict |
|---|---|---|---|---|
| Follow (state-gated) | SearchHub `FollowButton.toggle` `src/pages/SearchHub.tsx:535` | Follow/unfollow a creator | → `useSocial.followUser/unfollowUser` `useSocial.ts:119/142` → `rpc('toggle_follow')` → `follows` | WORKS |
| Follow (profile page) | Profile `toggleFollow` `src/pages/Profile.tsx:231` | Follow/unfollow viewed profile | → `rpc('toggle_follow')` reads `{following}`, updates count optimistically | WORKS |
| Follow (public profile hook) | `usePublicProfile.followUser/unfollowUser` `usePublicProfile.ts:144/166` | Follow/unfollow + refresh stats | → `rpc('toggle_follow')` → invalidate | WORKS |
| Followers/following counts | `useSocial.ts:56/76`, `usePublicProfile.ts:51/57` | Count rows in `follows` | `from('follows').select(count)` on `followed_id`/`follower_id` | WORKS |
| checkFollowing | `useSocial.ts:96` | Is viewer following user | `from('follows').maybeSingle()` | WORKS |
| Following feed | `useFollowingFeed` `usePublicProfile.ts:253` | Videos from followed creators | `follows`→`movie_projects` | WORKS |
| Creator discovery/search | `useCreatorDiscovery` `usePublicProfile.ts:192` | List/search creators | `profiles_public` + video counts | WORKS |
| Add comment | VideoCommentsSection `handleSend` `src/components/social/VideoCommentsSection.tsx:298` | Post project comment | → `useProjectComments.addComment` `useSocial.ts:364` → insert `project_comments` (owner notif by trigger) | WORKS |
| Edit comment | `VideoCommentsSection.tsx:113` `saveEdit` | Edit own comment | → `updateComment` `useSocial.ts:409` → update `project_comments` | WORKS |
| Delete comment | `VideoCommentsSection.tsx:101` `handleDelete` | Delete own comment (confirm) | `confirmAsync` → `deleteComment` `useSocial.ts:428` | WORKS |
| Reply to comment | `VideoCommentsSection.tsx:293` | Threaded reply | `addComment({replyToId})` | WORKS |
| **Like comment (`likeComment`)** | `useSocial.ts:389` | Toggle a like on a project comment | insert-only `comment_likes`; no toggle; no count trigger | **BROKEN (latent — not wired to any UI)** |
| Comment emoji reaction | CommentReactions `handleReaction` `VideoCommentsSection.tsx:32` | Toggle emoji on comment | → `useCommentReactions.toggleReaction` `useVideoReactions.ts:130` → insert/delete `comment_reactions` | WORKS (minor double-click race) |
| Video emoji reaction (Reel) | VideoReactionsBar `handleReaction` `src/components/social/VideoReactionsBar.tsx:26` | Toggle emoji on a project | → `useVideoReactions.toggleReaction` `useVideoReactions.ts:58` → insert/delete `video_reactions` | WORKS (minor double-click race) |
| Reel like (theater) | ImmersiveTheater `toggleLike` `src/components/social/ImmersiveTheater.tsx:309` | Heart a reel | `rpc('toggle_like_reel')` → `reel_likes` + `published_reels.like_count` | WORKS |
| Reel like (feed) | ImmersiveFeed `toggleLike` `src/components/social/ImmersiveFeed.tsx:142` | Heart a reel | `rpc('toggle_like_reel')` | WORKS |
| **Reel emoji reaction (feed)** | ImmersiveFeed `react` `ImmersiveFeed.tsx:158` | React with emoji | insert-only `reel_reactions`, no toggle, no UNIQUE → dupes | **BROKEN** |
| Reel emoji reaction (theater) | ImmersiveTheater `react` `ImmersiveTheater.tsx:332` | Toggle emoji reaction | insert/delete `reel_reactions` (proper toggle) | WORKS |
| Reel comment add | ImmersiveTheater `submitComment` `ImmersiveTheater.tsx:386` | Post reel comment | `rpc('add_reel_comment')` | WORKS |
| Reel comment like | ImmersiveTheater `toggleCommentLike` `ImmersiveTheater.tsx:408` | Like a reel comment | `rpc('toggle_like_reel_comment')` | WORKS |
| Reel comments live | `ImmersiveTheater.tsx:284` | Live new comments | realtime `reel_comments` INSERT | WORKS (live rows show "Anonymous" — see BROKEN) |
| Remix reel | ImmersiveTheater `remix` `ImmersiveTheater.tsx:357` | Create remix project | `rpc('remix_reel')` → /editor | WORKS |
| Share reel/video | ImmersiveTheater/Feed/Reel `share`/`handleShare` `ImmersiveTheater.tsx:371`, `ImmersiveFeed.tsx:170`, `src/pages/Reel.tsx:425` | Web Share / copy link | `navigator.share` w/ clipboard fallback | WORKS |
| Share project (public) | PublicShare `copyShare` `src/pages/PublicShare.tsx:114` | Copy share link | `navigator.clipboard` | WORKS |
| Send DM (Inbox, live) | Inbox `send` `src/pages/Inbox.tsx:774` | Send a DM | `rpc('send_direct_message')` w/ error mapping | WORKS |
| Mark DM read | Inbox `load`/realtime `src/pages/Inbox.tsx:687,705` | read_at on received msgs | direct update on `direct_messages` | WORKS |
| React to DM | Inbox `react` `src/pages/Inbox.tsx:803` | Emoji on a DM | `rpc('react_to_message')` | WORKS (errors swallowed, minor) |
| Tip in thread | Inbox `sendTip` `src/pages/Inbox.tsx:807` | Credit tip via DM | `rpc('tip_in_thread')` | WORKS |
| Accept/reject follow request | Inbox `src/pages/Inbox.tsx:1792,1797` | Private-account approvals | `rpc('accept_follow_request'/'reject_follow_request')` | WORKS |
| Thread state / lane read | Inbox `set_thread_state`/`mark_lane_read` `Inbox.tsx:408,1298` | Mute/archive/read | RPCs exist | WORKS |
| Start AI video reply | Inbox `Inbox.tsx:1194` | Queue AI video reply | `rpc('start_ai_video_reply')` (downstream edge fn `process-ai-video-replies` runs on cron) | WORKS (edge fn not invoked from this surface) |
| Send DM (legacy hook) | DirectMessagePanel `handleSend` `src/components/social/DirectMessagePanel.tsx:103` | Send a DM | → `useDirectMessages.sendMessage` `useSocial.ts:280` → `rpc('send_direct_message')` | WORKS but **DEAD** (component unused) |
| DM conversations list (legacy) | MessagesInbox `src/components/social/MessagesInbox.tsx:77` | List convos | `useConversations` `useConversations.ts:19` | WORKS but **DEAD** (unused) |
| Message-user button | `DirectMessagePanel.tsx:214` `MessageUserButton` | Open DM modal from profile | self-contained | **DEAD** (no caller) |
| World chat load | `useWorldChat.ts:53` | Load recent room msgs | `from('world_chat')` | WORKS |
| World chat send | WorldChat `submit` `src/components/lobby/WorldChat.tsx:194` | Post to lobby | → `useWorldChat.send` `useWorldChat.ts:121` → `rpc('post_world_chat')` | WORKS |
| World chat image upload | WorldChat `onFile` `WorldChat.tsx:180` | Attach image | `useWorldChat.uploadImage` → `world-chat` bucket | WORKS |
| World chat realtime + presence | `useWorldChat.ts:74` | Live msgs + online count | channel `world-chat` INSERT + presence | WORKS |
| Notifications list/unread | `useNotifications.ts:93,115` | Load + exact unread badge | `from('notifications')` | WORKS |
| Notif realtime + toast | `useNotifications.ts:174` | Live + urgent toast w/ prefs | user-scoped channel; honors quiet hours/ch_inapp | WORKS |
| Notif mark read / all / delete / clear | `useNotifications.ts:252,278,308,331` | Optimistic + rollback + settle | updates/deletes `notifications` | WORKS |
| Notif click → deep-link | NotificationBell `handleClick` `src/components/social/NotificationBell.tsx:234` | Mark read + navigate | `markRead` + `deepLinkFor` | WORKS |
| Public profile + stats | `usePublicProfile.ts:29` | Profile, counts, is_following | `profiles_public` + `follows` + `movie_projects` | WORKS |
| Gamification stats/achievements/leaderboard (reads) | `useGamification.ts:61,118,132,149` | XP/level/streak/leaderboard | `user_gamification`/`achievements`/`leaderboard` | WORKS but only consumed by dead `UserStatsBar` |
| Gamification addXp / updateStreak | `useGamification.ts:163,183` | Award XP / bump streak | `rpc('add_user_xp'/'update_user_streak')` | UNVERIFIED (RPCs exist; **no live UI caller**) |

---

## BROKEN

### ImmersiveFeed.react — duplicate reactions, insert-only, no toggle — **P2 (major)**
- **Symptom:** In the Lobby vertical/TikTok feed, tapping an emoji on a reel
  inserts a **new** `reel_reactions` row every single tap. There is no unlike and
  the table has no uniqueness, so a user can inflate a reel's reaction totals
  arbitrarily by tapping repeatedly. The same emoji can never be removed from
  this surface. The transient `reactCount` local state is also incremented but
  never rendered.
- **Repro:** Open Lobby → enter the immersive feed (`ImmersiveFeed`) → tap 🔥 ten
  times. Ten rows are written to `reel_reactions`. Open the same reel in the
  Theater view — the aggregate count reflects all ten.
- **Root cause:** `src/components/social/ImmersiveFeed.tsx:158-168` `react()` only
  ever `insert`s into `reel_reactions` (`.insert({reel_id, reactor_id, reaction_url})`)
  with the error swallowed (`catch { /* burst already shown; non-fatal */ }`).
  `reel_reactions` has no unique constraint (`supabase/migrations/20260610230000_entertainment_hub.sql:141-147`,
  only `id` PK), so duplicate inserts succeed silently. The sibling
  `ImmersiveTheater.react()` (`ImmersiveTheater.tsx:332-355`) does it correctly
  (checks `myReactions`, deletes-or-inserts) — the two surfaces are inconsistent.
- **Fix:** Mirror the Theater toggle in `ImmersiveFeed.react`: track the viewer's
  own reactions, delete-or-insert, and surface errors. Better: add
  `UNIQUE(reel_id, reactor_id, reaction_url)` to `reel_reactions` so the data
  layer enforces it and counts are honest.

### useSocial.likeComment — insert-only like + orphan count column — **P3 (latent; would be P1 if wired)**
- **Symptom:** None today — the mutation is **not called by any UI** (only
  referenced in `src/test/regression/comments-system.test.ts`). If it were ever
  wired to a button it would: (a) throw a UNIQUE violation on the 2nd click
  because there is no unlike/toggle, and (b) never change any visible count.
- **Repro (hypothetical, if wired):** Click "like" on a project comment twice →
  second insert violates `comment_likes UNIQUE(comment_id, user_id)` → error toast,
  and the displayed count stays 0 forever.
- **Root cause:**
  - `src/hooks/useSocial.ts:389-405` `likeComment` does a bare
    `from('comment_likes').insert({comment_id, user_id})` — no existence check,
    no delete branch.
  - `comment_likes` has `UNIQUE(comment_id, user_id)` (`supabase/migrations/20260116132617_*.sql:269`).
    (A DELETE RLS policy *does* exist at line 280, so a toggle is feasible.)
  - `project_comments.likes_count` (`...sql:230`) has **no trigger** populating it
    — the only trigger on the table is `trg_notify_project_comment`
    (`20260625000000_notifications.sql:239`), which sends a notification, not a count.
- **Fix:** Either delete the dead `likeComment` mutation (the live UI already does
  comment "likes" correctly via emoji `comment_reactions` in
  `useCommentReactions`), or rewrite it as a toggle (check existing → delete-or-insert)
  and add an `AFTER INSERT/DELETE` trigger maintaining `project_comments.likes_count`.

### ImmersiveTheater — live reel comments render as "Anonymous" — **P3 (minor)**
- **Symptom:** While the Theater is open, a comment posted by *another* user that
  arrives via realtime shows "Anonymous" with no avatar until the page is reloaded
  (your own comments render fine).
- **Repro:** User A opens a reel's Theater; User B comments on the same reel → A
  sees the new comment appear with name "Anonymous".
- **Root cause:** `src/components/social/ImmersiveTheater.tsx:284-299` pushes the
  raw realtime row (`payload.new as Comment`) straight into state. The realtime
  payload is the bare `reel_comments` row — it has no joined `author` object
  (unlike `add_reel_comment`/`reel_comments_for` which enrich it), so
  `CommentRow` falls back to "Anonymous" (`ImmersiveTheater.tsx:835`).
- **Fix:** On realtime INSERT for a row whose `author_id !== user.id`, fetch the
  author from `profiles_public` (or re-run `reel_comments_for`) before/while
  appending.

### Video/comment emoji reaction — double-click race can throw — **P3 (minor)**
- **Symptom:** Rapidly double-tapping the same emoji on a project video/comment
  can show a "Failed to react" toast even though the reaction is actually applied.
- **Repro:** Double-click 🔥 on a Reel before the first request resolves.
- **Root cause:** `useVideoReactions.toggleReaction` (`src/hooks/useVideoReactions.ts:58-88`)
  and `useCommentReactions.toggleReaction` (`useVideoReactions.ts:130-154`) decide
  insert-vs-delete from the cached `reactions` array, which hasn't refetched between
  the two clicks → both branches `insert` → 2nd hits
  `UNIQUE(user_id, project_id|comment_id, emoji)` (`20260206223427_*.sql:12,22`).
  Non-destructive (the row exists) but produces a spurious error toast.
- **Fix:** Add a per-emoji in-flight guard (ignore taps while `isPending`), or use
  upsert/`onConflict` ignore, or switch to a SECURITY-DEFINER toggle RPC like the
  reel path uses.

---

## Notes / non-defects worth flagging (not user-facing breaks)

- **Dead legacy DM stack:** `MessagesInbox`, `DirectMessagePanel` (+ `MessageUserButton`),
  `useConversations`, and `useSocial.useDirectMessages` are only referenced by
  `src/components/social/index.ts` and tests — superseded by the live, robust
  `src/pages/Inbox.tsx` (own DM impl with read-marking, reactions, presence,
  typing, tips, follow-request approvals). Functional but unwired; remove to avoid
  confusion. (`useSocial.useDirectMessages` comment correctly notes it stopped
  using the nonexistent `get_decrypted_messages` RPC and now reads the table
  directly — verified consistent with RLS.)
- **`useGamification` largely unwired:** its only consumer is `UserStatsBar`, which
  is itself referenced only in a test (`forwardRefAudit.test.ts`). `add_user_xp`
  and `update_user_streak` RPCs exist but have no live caller → marked UNVERIFIED
  rather than WORKS.
- **`gamification-event` / `notify-org-event` edge functions:** not invoked from
  any file on this surface (only test/catalog references) → out of scope in practice.
- **`process-ai-video-replies`:** invoked indirectly — the UI calls the
  `start_ai_video_reply` RPC (`Inbox.tsx:1194`); the edge function runs on cron.
- **Realtime channels are correctly user/pair-scoped** (`notifications-${user.id}`,
  `dm-${sorted ids}`, `world-chat`) — no channel-collision (audit gap K19) found.
- **`confirmAsync` used, `window.confirm` absent** across the entire surface
  (verified by grep) — break pattern #10 clean.
