# Backfill plan — durable final-film URLs (P0-1)

**Status: NOT RUN.** This worktree has no Supabase credentials and the rule is
never-prod. The script (`scripts/backfill-durable-video-urls.mjs`) is written and
reviewable; run it against **dev/staging first**, verify, then schedule a
prod run only after your sign-off. It defaults to **dry-run**.

## What needs backfilling
The forward fix (this batch) stops *new* films from storing the 24h signed URL.
Existing rows in `movie_projects` whose `video_url` is already an expiring URL
still need repair. Two URL shapes qualify:
1. `…/storage/v1/object/sign/published-renders/<path>?token=…` — a Supabase
   **signed** URL into the private renders bucket (the dominant case).
2. `…replicate.delivery/…` — a raw Replicate delivery URL stored directly.

## The crucial fact: the master object usually still exists
A Supabase signed URL expiring does **not** delete the stored object — only the
token times out. So for case (1) the stitched MP4 is still sitting in
`published-renders/<path>`. We can recover it **without re-stitching** by
re-reading it (fresh signed URL) and copying it into durable public storage
(`video-clips`, the same bucket the forward fix + clip persistence use), then
storing the resulting `getPublicUrl`.

## Recovery tiers (what the script does per row)
- **TIER A — re-resolvable (no re-render):** `video_url` is a signed
  `published-renders` URL. Parse `<path>`, mint a fresh signed URL, `HEAD` to
  confirm the object exists, download, upload to public `video-clips/<projectId>/
  final_video_backfill_<ts>.mp4`, and set `video_url` to the new public URL.
- **TIER B — re-resolvable from storage despite a Replicate URL:** `video_url`
  is a `replicate.delivery` link (almost certainly already dead), but a
  `published-renders/<projectId>/…mp4` object exists (listed). Recover from that
  object exactly like Tier A.
- **TIER C — needs re-stitch (FLAG ONLY, no write):** no durable master object
  can be found, but the project still has completed `video_clips` rows. These
  cannot have their URL re-resolved; they must be re-stitched. The script writes
  a flag (`pending_video_tasks.needs_restitch = true`) and lists them; it does
  **not** auto-trigger a re-render (that spends credits/compute — your call).
- **TIER D — unrecoverable (FLAG ONLY):** expiring `video_url`, no master
  object, and no completed clips. Listed for manual review.

## Safety properties
- **Dry-run by default.** `--apply` is required to write anything.
- **Idempotent.** Re-running skips rows whose `video_url` is already durable
  (the broadened `isExpiringUrl` guard decides), and Tier A/B uploads use a
  timestamped key so a half-finished run never corrupts an existing object.
- **Non-destructive.** Never deletes the `published-renders` master or any clip.
  Tier C/D only annotate `pending_video_tasks`; they never clear `video_url`.
- **Owner-scoped batches.** Supports `--limit N` and `--project <id>` so you can
  pilot on a handful before a full sweep.
- **Per-row try/catch.** One bad row can't abort the batch; failures are
  collected and printed.

## How to run (dev/staging)
```bash
# 1) point at dev/staging (NEVER prod) — service role required for storage + update
export SUPABASE_URL=https://<dev-ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<dev-service-role-key>

# 2) dry-run — classify only, write nothing
node scripts/backfill-durable-video-urls.mjs --limit 25

# 3) pilot a few for real
node scripts/backfill-durable-video-urls.mjs --apply --limit 5

# 4) verify those projects play, then widen
node scripts/backfill-durable-video-urls.mjs --apply
```

## Prod
Do **not** run against prod (`ywcwaumozoejierlfkgj`) without explicit sign-off.
Also note CLAUDE.md: prod is migrations-behind and has out-of-band state — confirm
the `video-clips` bucket is public in prod and that `published-renders` objects
exist before a prod sweep. Run the dry-run there first and review the tier counts.

## Output
The script prints a summary: `{ scanned, tierA, tierB, tierC_needs_restitch,
tierD_unrecoverable, repaired, failed }` and the project-id lists for Tier C/D so
you can decide on re-stitching.
