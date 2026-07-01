# 07 — Library, Media & Galleries (QA reliability audit)

Surface: storage, uploads, deletes, retrieval/playback of saved assets, publishing reels, galleries, share links.
Method: traced every entry control → hook → storage bucket / RPC / edge fn → DB row → list refresh. Bucket public/private flags verified against `supabase/migrations`. Read-only; no source modified.

## INVENTORY

| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| `useFileUpload.uploadFile` | src/hooks/useFileUpload.ts:81 | Generic file upload to a bucket | validateFile → `storage_quota_status` RPC (fail-open) → `storage.from(bucket).upload(userId/ts-name)` → signed URL (default) | OK. Bucket default `user-uploads` is **private** (set `public=false` in migration) and `signed:true` default returns a 7-day signed URL → works. Simulated progress only (cosmetic). |
| `useFileUpload.uploadFromUrl` | :197 | Fetch remote URL → upload | fetch → blob → File → uploadFile | OK |
| `useFileUpload.deleteFile` | :227 | Remove a storage object | `storage.from(bucket).remove([path])` | OK as a primitive, but DELETES STORAGE ONLY (no DB row). Caller's responsibility. |
| `useMediaLibrary` (list) | src/hooks/useMediaLibrary.ts:48 | List user's media | `reconcile_user_media` RPC (best-effort) → `get_user_media_library` RPC | OK. RLS-scoped. Reconcile + realtime re-read each change. |
| `useMediaLibrary.remove` | :105 | Delete a library asset | optimistic remove → `user_media_assets.delete().eq(id)` | PARTIAL — deletes registry row only, leaves storage object (orphan). Likely by-design (asset may be shared by a project). Low. |
| `useMediaLibrary.toggleFavorite` | :115 | Star/unstar | optimistic → `user_media_assets.update`; rolls back on error | OK |
| `Library` page list | src/pages/Library.tsx:115 | Paginated film grid | `usePaginatedProjects(field,dir,"all",search,category)` server-side category+search | OK |
| Library per-category counts | :165 | Pill counts across all pages | `movie_projects.select(genre,status,created_at).eq(user_id)` | OK |
| Library `surpriseMe` | :212 | Open a random film | `navigate('/r/'+id)` | OK |
| **Library delete** | :223 | Delete a film | confirm dialog → **`movie_projects.delete().eq(id)`** (raw) | **BROKEN — see B1.** Bypasses `delete-project` edge fn: orphans storage, doesn't cancel Replicate, can FK-fail. |
| Library Share button | :890 | Copy share link | `navigator.clipboard.writeText(origin+'/r/'+id)` | PARTIAL — see B3. `/r/:id` is login-gated; recipient must sign in. |
| Library Edit button | :885 | Open editor | `window.location.assign('/editor/'+id)` | OK |
| `StitchedVideo` | :540 | Play full multi-clip film | `video_clips.select.eq(project_id).order(shot_index)` filter completed | OK |
| `useGalleryShowcase` (read) | src/hooks/useGalleryShowcase.ts:6 | List gallery_showcase | `gallery_showcase.select.order(sort_order)` (eq is_active unless includeInactive) | OK |
| `useAddGalleryItem` | :29 | Insert showcase item | insert → invalidate `['gallery-showcase']` | OK |
| `useUpdateGalleryItem` | :53 | Update item | update.maybeSingle → invalidate | OK |
| `useDeleteGalleryItem` | :78 | Delete item | delete.eq(id) → invalidate | OK (DB-only; showcase rows reference URLs, no owned storage) |
| `useReorderGalleryItems` | :100 | Reorder | `Promise.all` of N updates → invalidate | OK; non-atomic (partial failure leaves mixed order) — low. |
| `useReelPublisher.publish` | src/hooks/useReelPublisher.ts:25 | Publish project → Lobby reel | `publish_reel` RPC → toast "View" → `/r/{reel_id}` | OK. Reel page resolves id as project OR published_reels id (Reel.tsx:252-269). |
| `PublishWizard.submit` | src/components/publish/PublishWizard.tsx:115 | 3-step publish + daily-prompt entry | `publish_reel` → optional `prompt_submissions` insert (retry w/ user_id) → `navigate('/watch/'+reelId)` | OK. `/watch/:id` redirects to `/r` (App.tsx:838). Guards `!project.video_url`. |
| `GlobalPublishWizard` / `openPublishWizard` | src/components/publish/GlobalPublishWizard.tsx:28,49 | App-root wizard via CustomEvent | window event → PublishWizard | OK |
| `UploadReelDialog.submit` | src/components/publish/UploadReelDialog.tsx:91 | BYO video → project → publish | validate → upload to **video-clips** (public) + **video-thumbnails** (public) → `movie_projects` insert (status completed) → `record_user_media` (best-effort) → onProjectReady | OK. Both buckets are public so `getPublicUrl` playback works. |
| `useWorkspaceCovers` | src/hooks/useWorkspaceCovers.ts:13 | Org cover thumbnails | `movie_projects.select(thumbnail_url).eq(organization_id)` cached per-org | OK |
| `useImagePreloader` | src/hooks/useImagePreloader.ts:47 | Preload images w/ concurrency+abort | Image() w/ cache | OK |
| `useChunkedAvatars` | src/hooks/useChunkedAvatars.ts:51 | Progressive avatar reveal | slice growth on timer | OK |
| `ActiveRendersCard` | src/components/library/ActiveRendersCard.tsx:22 | In-progress renders | `useActiveProjects` → `/production/:id` | OK |
| `FilmsGallery` (/films) | src/pages/FilmsGallery.tsx:83 | Marketing film grid | **static** `PLAYABLE_FILMS` from `@/data/filmsLibrary` | OK — not user data. |
| edge `generate-upload-url` | supabase/functions/generate-upload-url/index.ts | Signed upload URL for pipeline | auth-guard → bucket allowlist {final-videos,video-clips,videos,thumbnails} → path-traversal reject → ownership check → user-scoped path → `createSignedUploadUrl` | OK & well-guarded. NO client invoker found (internal/service-role only) — UNVERIFIED at runtime. |
| edge `mint-project-share` | supabase/functions/mint-project-share/index.ts | Mint `/p/{slug}` public share | auth-guard → user-JWT client → `mint_project_share_slug` RPC → `{slug,url}` | Code OK but **ORPHANED — see B2.** No UI caller; no `project_shares` insert anywhere. |
| edge `delete-project` | supabase/functions/delete-project/index.ts | Full hard delete | auth+owner → cancel Replicate → batch storage delete (parses URLs) → ordered child-table deletes → delete project | OK. Invoked from StudioContext.tsx:360 only (NOT from Library). |
| edge `cancel-project` | supabase/functions/cancel-project/index.ts | Cancel + cleanup + refund | auth → recursive predictionId scan → storage delete → clips delete → status=cancelled → proportional credit refund (idempotent) | OK. Used by Production.tsx, SpecializedModeProgress.tsx. |
| edge `cleanup-stale-drafts` | supabase/functions/cleanup-stale-drafts/index.ts | Cron prune empty drafts | service/admin → select drafts (no script/video) → per-row created==updated check → `.delete().in(ids)` | OK (N+1 per-row recheck; cron only). |
| edge `premiere-recap` | supabase/functions/premiere-recap/index.ts | Public premiere recap | UUID validate → service client → gate `status==='ended'` (else 404) → top reactions | OK; correctly gates non-ended to avoid leaking host/tips. |

## BROKEN

### B1. Library delete bypasses `delete-project` → orphaned storage + uncancelled spend (+ FK-fail for genesis projects) — HIGH
- **Symptom:** Deleting a film from the Library page leaves all of its storage files (final video, every clip, thumbnails, first/last-frame images, HLS) permanently in the buckets, and does NOT cancel any in-flight Replicate predictions (continued API spend). For projects that have `genesis_scene_clips` rows the delete fails entirely.
- **Repro:**
  1. Create/own a completed film with clips. Open `/library`, hover a card, click trash → Delete permanently.
  2. The `movie_projects` row goes; `video_clips`/likes/comments cascade. But `final-videos`/`video-clips`/`thumbnails`/`video-thumbnails` objects remain (verify in Storage). Any running prediction keeps billing.
  3. The confirm dialog text even claims: "permanently removed from your library + database. The source clips and renders are not retrievable" — false; storage is retained.
  4. Variant: a project with a `genesis_scene_clips` row → the raw delete throws a FK violation, optimistic remove rolls back, toast "Couldn't delete" — the film cannot be deleted from Library at all.
- **Root cause:** `src/pages/Library.tsx` `handleConfirmDelete` (line 223-245) issues a raw `supabase.from("movie_projects").delete().eq("id", target.id)` instead of invoking the `delete-project` edge function (which exists precisely to cancel predictions + batch-delete storage + clean non-cascade children). `genesis_scene_clips.project_id` is `REFERENCES movie_projects(id)` with NO `ON DELETE` action (migration 20260116164616, line ~103; no later override) → RESTRICT. (credit_transactions = SET NULL, api_cost_logs/video_clips/etc. = CASCADE, so those don't block, but storage still orphans.)
- **Fix:** Replace the raw delete with `supabase.functions.invoke('delete-project', { body: { projectId: target.id } })` (same call StudioContext.deleteProject already uses, src/contexts/StudioContext.tsx:360), keeping the optimistic UI + rollback. Optionally fix the dialog copy. This single change removes the orphan-storage, uncancelled-spend, and genesis FK-fail issues at once.

### B2. Public share feature (`mint-project-share` + `/p/:slug` + `/embed/:slug`) is orphaned — has no creation path — MEDIUM
- **Symptom:** The "share a public, no-login page for my film" capability cannot be produced by any user. The edge fn `mint-project-share`, the `mint_project_share_slug` RPC, the `/p/:slug` `PublicShare` page and `/embed/:slug` `EmbedPlayer` all exist, but nothing in the UI ever mints a slug or inserts a `project_shares` row.
- **Repro:** Grep the client for share creation: `supabase.functions.invoke('mint-project-share')` → 0 hits; `project_shares … insert` → 0 hits. Only `types.ts` references the RPC. Every share button instead copies `/r/{projectId}` (Library.tsx:892, Reel.tsx:427, ImmersiveFeed/Theater). So `/p/` pages can only be reached by hand-crafting a slug that was never created.
- **Root cause:** Feature half-wired — the publish/share UI standardized on `/r/:id` (the Reel page) and the `project_shares`/`/p/` path was left without an entry point.
- **Fix:** Either (a) wire a "Create public link" action to `mint-project-share` and surface the returned `/p/{slug}` URL, or (b) delete the dead `mint-project-share` fn + `PublicShare`/`EmbedPlayer` routes to avoid confusion. (Decision-dependent; flagging, not auto-fixing.)

### B3. Share links point to a login-gated route — logged-out recipients bounce to /auth — MEDIUM (known design tradeoff)
- **Symptom:** The Library and Reel "Share" buttons copy `${origin}/r/{id}` and toast "Link copied", but `/r/:id` (and `/p/:slug`, `/embed/:slug`) are NOT in the public allowlist (`src/lib/publicRoutes.ts`), so `GatedRoutes` (src/components/auth/GatedRoutes.tsx:27) redirects any unauthenticated visitor to `/auth`. A shared link does not show the film to a logged-out person.
- **Repro:** Log out, open a copied `/r/{id}` link → redirected to `/auth?...`. Confirm `/r`, `/p`, `/embed` absent from `PUBLIC_EXACT`/`PUBLIC_PREFIXES`.
- **Root cause:** Intentional per "gate app by default" (App.tsx:874/882 comments: "now login-gated"). But the share UX still presents these as public links, so externally-shared links appear broken to recipients.
- **Fix:** Product decision. If shares should be public, add `/r/`, `/p/`, `/embed/` (or just `/p/`+`/embed/`) to `publicRoutes.ts` with their own RLS gates (PublicShare already relies on `project_shares.is_public`); the Reel page would also need an unauth read path. If shares are intentionally private, update the share button copy to set expectations. UNVERIFIED against intended product spec.

## NOTES / lower-severity
- `useMediaLibrary.remove` (B-table) deletes only the `user_media_assets` row, never the storage object → registry/storage drift; likely intentional (asset shared with project). Low.
- `useReorderGalleryItems` fires N independent `update`s via `Promise.all` (non-atomic) — a partial failure can leave inconsistent `sort_order`; onError toasts but doesn't reconcile. Low.
- `cleanup-stale-drafts` does an N+1 per-draft re-select to compare created_at==updated_at (Supabase can't compare columns in a filter) — correctness OK, just chatty; cron-only. Low.
- `generate-upload-url` is solid (auth guard, bucket allowlist, path-traversal reject, per-user path scoping) but has **no client caller** in this surface; runtime use is internal/service-role — UNVERIFIED here.
- Bucket privacy confirmed from migrations: `user-uploads` **private** (later `SET public=false`); `video-clips`, `video-thumbnails`, `thumbnails`, `videos`, `final-videos` **public**. UploadReelDialog + useFileUpload(signed) are each consistent with their bucket's privacy. No broken-playback-from-private-bucket found on this surface.

## SUMMARY
- Functions/entries inventoried: ~33 (15 hooks/components, 6 edge fns, plus Library/Reel/Publish flows).
- Broken by severity: **HIGH 1** (B1 Library raw delete → orphaned storage + uncancelled Replicate spend + genesis FK-fail), **MEDIUM 2** (B2 orphaned public-share feature; B3 share links point to login-gated route). No CRITICAL.
- Worst issue: **B1** — `src/pages/Library.tsx:223-245` deletes the project row directly instead of calling the existing `delete-project` edge function; storage files and active video-provider predictions are left behind on every Library delete, and deletes outright fail for genesis-pipeline projects. One-line-ish fix: route through `functions.invoke('delete-project')`.

Partial written to: qa-audit/partials/07-library-media.md
