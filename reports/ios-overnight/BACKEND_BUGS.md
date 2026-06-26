# Backend bug cluster — broken `toggle_*` RPCs (GATED, needs DB signoff)

Found during the overnight verification cycle (2026-06-26) by functionally
exercising every RPC the native app calls against the LIVE backend (project
`ywcwaumozoejierlfkgj`). These are **shared-backend defects** (they affect the web
app too), not iOS-app bugs. The app handles them gracefully (optimistic update +
rollback + toast), so nothing crashes — but the features silently don't persist.

**These are NOT fixed here.** Applying them is a production DB migration, which is
gated (per project policy — `supabase db push` is a footgun until staging + signoff).
Deliberately not added under `supabase/migrations/` so the next `db push` can't
auto-deploy an unreviewed change.

## Root cause (one copy-paste bug, repeated)

Each function declares the row-count holder as `bool` but assigns it an integer:

```sql
DECLARE v_existed bool;                  -- ❌ should be int
...
GET DIAGNOSTICS v_existed = ROW_COUNT;   -- ROW_COUNT is INTEGER
IF v_existed = 0 THEN                     -- ❌ boolean = integer  → runtime error
```

Runtime error returned to the client: `operator does not exist: boolean = integer`
(PostgREST surfaces it as HTTP 404 with that message).

## Affected functions

| Function | Native app uses it? | User-visible impact |
|---|---|---|
| `toggle_like_reel(p_reel_id)` | ✅ Feed + ReelViewer | **Liking a reel doesn't persist** |
| `toggle_like_reel_comment(p_comment_id)` | ✅ FeedComments | **Liking a comment doesn't persist** |
| `toggle_block(p_target)` | ✅ CreatorProfile menu | **Block/unblock doesn't persist** |
| `react_to_message` | (web/threads; verify native) | Message reactions broken |
| `toggle_follow(p_target)` | ❌ app inserts `user_follows` directly | No in-app impact (RPC unused) |

Note: `toggle_follow` also writes table `follows(follower_id, followed_id)`, while
the app uses `user_follows(follower_id, following_id)` — a separate follow table.
Following works in the app because it never calls the broken RPC.

## The fix (apply with review, on the backend)

For each function, change the declaration `v_existed bool` → `v_existed int`
(everything else is already correct — `IF v_existed = 0` then works as int = int).
A corrective migration would be, e.g.:

```sql
-- 20260626_fix_toggle_rowcount_type.sql  (REVIEW + STAGE BEFORE PUSH)
-- Re-create each function identically except: DECLARE v_existed int;
-- toggle_like_reel, toggle_like_reel_comment, toggle_block, react_to_message,
-- toggle_follow.
```

(Pull each current body from its migration, flip the one DECLARE line, re-`CREATE OR
REPLACE`. No signature/grant changes needed.)

## App-side status

Nothing to change in the iOS app — the calls and params are correct; the failure
is inside the SQL functions. Once the backend fix ships, likes / comment-likes /
blocks start persisting with zero app changes.
