# Genesis Director — RLS & Edge-Function Auth Security Sweep

**Scope:** systematic sweep of all 387 migrations in `supabase/migrations/` and 142 edge functions in `supabase/functions/`. READ-ONLY. Branch `full-audit`.
**Method:** policies are additive in Postgres and are DROP/recreated across migrations, so every finding below uses the **newest** definition per table/policy/bucket. Three surfaces audited: (1) table RLS coverage, (2) service-role IDOR in edge fns, (3) storage buckets, (4) SECURITY DEFINER RPCs.

**Headline:** The *table* RLS surface is in good shape — the wide-open `USING(true)` write policies the first pass would have feared were almost all remediated (`movie_projects` in `20260104202048`, the universes/characters/templates cluster in `20260611190000`, org role-escalation in `20260704000200`). The real, large, still-open attack surface is **service-role IDOR in the generation/pipeline edge functions** (20 functions) plus **gated render media sitting in public storage buckets**.

---

## 1. RLS COVERAGE MATRIX (core user-data tables, newest policy state)

| Table | RLS | SELECT scope | Write scope | Verdict |
|---|---|---|---|---|
| `movie_projects` | ✅ | owner (`auth.uid()=user_id`, `20260104202048:8`) + org-member (`20260502172041:333`) | owner + org producer/admin | **OK** — original `USING(true)` policies dropped `20260104202048:2-5` |
| `video_clips` | ✅ | owner only (`user_id=auth.uid()`, `20260118000219:189`) + anon deny (`20260222180632`) | owner; anon insert/update/delete denied | **OK** |
| `profiles` | ✅ | public read of non-sensitive cols; `email`+credits+settings REVOKEd from anon/authenticated (`20260611190000:25`, `20260703000000`, `20260705000200`) | owner update | **OK** (first-pass leak fix confirmed; see LOW `profile_overview` note) |
| `organizations` | ✅ | members | INSERT `created_by=auth.uid()`; UPDATE admin/owner | **OK** |
| `organization_members` | ✅ | members | INSERT `has_org_permission(...,'admin')`; UPDATE role-guarded (`20260704000200`) | **OK** — H-1 self-escalation fixed |
| `credit_holds` | ✅ | — | client INSERT/UPDATE/DELETE all blocked | **OK** (service-role only) |
| `credit_transactions` | ✅ | owner (`Users can view own`) + anon deny | service-role only | **OK** |
| `ledger_accounts/entries/txns` | ✅ | admin-only SELECT | service-role only | **OK** |
| `subscriptions` | ✅ | `subscriptions_select_own` | service-role writes only | **OK** |
| `patron_subscriptions` | ✅ | owner | owner | **OK** |
| `creator_earnings_ledger`, `creator_payouts`, `cinema_usage_ledger`, `org_credit_refills` | ✅ | no client policy = deny-by-default | service-role only | **OK** (locked) |
| `org_spend_events` | ✅ | org admins read | service-role | **OK** |
| `atom_purchases` | ✅ | buyer reads own | RPC (`buy_atom`) | **OK** |
| `follows` / `user_follows` | ✅ | public read (by design) | `FOR ALL ... follower_id=auth.uid()` (`20260610230000:137`) | **OK** |
| `notifications` | ✅ | owner (`user_id=auth.uid()`) | client INSERT denied — only service-role/SECURITY DEFINER (`20260213025841:32` removed last permissive INSERT) | **OK** — no notification-spoofing |
| `notification_preferences` | ✅ | owner | owner | **OK** |
| `api_keys` / `org_api_keys` | ✅ | view-only via RPC; `Block direct read` | admin via RPC | **OK** |
| `push_subscriptions` | ✅ | self (`ps_self_all` FOR ALL self) | self | **OK** |
| `direct_messages` | ✅ | sender/recipient (`20260118000219:70`) | INSERT `sender_id=auth.uid()` | **OK** |
| `published_reels` | ✅ | owner + public published | INSERT via `publish_reel` RPC only (`20260611190000:228`) | **OK** |
| `reel_plays` | ✅ | — | INSERT authenticated, `viewer_id=auth.uid()` (`20260611190000:212`) | **OK** |
| `crew_members` | ✅ | self | INSERT denied (RPC `join_public_crew`); self DELETE (`20260611190000:162`) | **OK** — self-insert IDOR fixed |
| `universes`/`characters`/`project_characters`/`script_templates` | ✅ | public/owner | owner-scoped (`20260611190000:64-152`) | **OK** — original `USING(true)` writes dropped |
| `channel_connections` / `channel_connection_secrets` | ✅ | service-role only (oauth tokens) | service-role | **OK** (intentional) |
| `distribution_jobs` | ✅ | org member | service-role | **OK** |
| `genesis_*` (screenplay, scenes, scene_clips, etc.) | ✅ | public read `USING(true)` (shared showcase — by design) | admin `FOR ALL`, contributor `submitted_by=auth.uid()` (`20260116164616`) | **OK** (writes scoped) |
| `security_events` | ✅ | admin-only SELECT | **INSERT `WITH CHECK (true)`** (`20260220042441:88`) | **LOW** — see 1a |

### 1a. LOW — `security_events` accepts client-forged rows
`supabase/migrations/20260220042441_dc8ad9eb...sql:87` — `CREATE POLICY "Security events: service can insert" ... FOR INSERT WITH CHECK (true)`. Any authenticated (or anon, no role restriction) caller can INSERT arbitrary rows into the security-audit table (forge/spam `event_type`, `severity`, another user's `user_id`). It is read-restricted to admins, so this is log-poisoning / audit-integrity only, not data disclosure. **Severity: LOW.**

**Coverage verdict:** RLS is ENABLED on every core user-data table (no `DISABLE ROW LEVEL SECURITY` exists anywhere in the 387 migrations). The remaining `USING(true)` SELECT policies are on intentionally-public content (reels, likes, follows, premieres, genesis showcase, public profiles). No core table is RLS-disabled, no core table has a permissive `USING(true)` SELECT exposing private data, and no core table is missing its write check — **except** the `security_events` INSERT (LOW). The table layer is solid; the holes live in the edge-function and storage layers.

---

## 2. SERVICE-ROLE IDOR (the real attack surface) — 20 functions

`_shared/auth-guard.ts`'s `validateAuth()` accepts **any** valid end-user JWT *or* the service-role key, and `resolveEffectiveUserId()` only proves *who the caller is* — never that the caller owns the body's `projectId`/`clipId`/`sessionId`. Most of these functions also set `verify_jwt = false`. A function is vulnerable when, after auth, it does `.eq('id', <body projectId>)` (or `.eq('project_id', …)`) with **no** `.eq('user_id', caller)` tie, while holding the service-role (RLS-bypassing) client. The first pass found `continue-production`; the full sweep finds 19 more.

### CRITICAL
- **`supabase/functions/seamless-stitcher/index.ts:274`** — `.eq("id", body.projectId)`. **No auth at all**: `verify_jwt = false` and no `validateAuth`/`requireServiceRole` in the file; service-role client built unconditionally (`:240`). An **unauthenticated** caller POSTs `{projectId, forceRestitch:true}` → reads the victim project + all `video_clips` (`:422`), **charges the project OWNER's credits** via `deduct_credits(p_user_id: projectUserId)` (`:972`), and **overwrites the victim's `movie_projects.video_url`** (`:1003`). Clips-mode drives service-role FFmpeg writing arbitrary bytes into `published-renders`. Unauthenticated, destructive, bills victims, unbounded compute. **THE single most exploitable issue.**

### HIGH — authenticated cross-user project/clip hijack (continue-production class)
- **`continue-production/index.ts:152`** (first-pass reference) — `.eq('id', projectId)` (+ `:184/:290/:336/:468/:822/:1148`); `resolveEffectiveUserId` proves caller only.
- **`retry-failed-clip/index.ts:158/176`** — end-user branch retries a victim's clip, takes the gen lock, fires a Replicate job.
- **`final-assembly/index.ts:311`** — `.update(finalUpdate).eq('id', projectId)`; project select never reads `user_id` (`:103`). Forces stitch/render, overwrites status/`video_url`, or forces `error` (DoS).
- **`render-video/index.ts:64/261`** — `edit_sessions .eq('id', sessionId)`, no owner tie. Exfiltrates `render_url`/`predictionId`; `submit` starts a billable concat overwriting the victim session.
- **`generate-single-clip/index.ts:1077`** (`.eq('id',projectId)` `:1192/:1383`).
- **`generate-avatar-direct/index.ts:182`** (~15 `movie_projects .eq('id',projectId)` writes).
- **`generate-scene-images/index.ts:308`** — trusts **both** body `projectId` **and** body `userId` (no `resolveEffectiveUserId`); writes scene images into victim project and invokes `resume-pipeline` (`:447`). Worst-of-set.
- **`hollywood-pipeline/index.ts:6815`** — full orchestrator vs a victim `projectId` (body `userId` mismatch is rejected `:6584`, but `projectId` never tied to it).
- **`seedance-pipeline/index.ts:375`** — engine-lock + status writes `.eq("id",request.projectId)` on the existing-project branch, no `user_id` filter. (Newly found.)
- **`check-specialized-status/index.ts:69`** — `{projectId,predictionId}`; attacker's succeeded prediction overwrites victim `status`/`video_url`/clips.
- **`mode-router/index.ts:428`** — `.update({...status,pipeline_state}).eq('id',projectId)` hijacks/overwrites a victim project.
- **`auto-stitch-trigger/index.ts:141`** — `{projectId,forceStitch}` flips victim project to stitching/completed.
- **`fix-manifest-audio/index.ts:44/108`** — rewrites victim `pending_video_tasks.manifestUrl` + `video_url` (`:114`) → hijacks playback.
- **`extract-scene-identity/index.ts:631`** — merges/overwrites victim `pro_features_data.sceneIdentity` (charges attacker 5 credits only).
- **`comprehensive-clip-validator/index.ts:457`** — `video_clips .update({quality_score}).eq('project_id',projectId)`, ownership-less write (narrow field).

### MEDIUM — cross-user read / low-impact write
- **`check-video-status/index.ts:81`** — status-poll path (`autoComplete=false`) returns another user's prediction `videoUrl`/`status` (the write path *is* owner-checked `:89`).
- **`extract-video-frame/index.ts:181`** — returns victim's private reference/golden/scene image URLs; writes attacker frames into `temp-frames/${projectId}/` (render poisoning).
- **`generate-hls-playlist/index.ts:44/134`** — discloses victim clip/video URLs + writes playlist cache into their project.
- **`generate-voice/index.ts:336`** — `get_or_assign_character_voice({p_project_id:projectId})` overwrites a character→voice mapping in a victim project.

**Fix pattern already in-repo:** `generate-music:727`, `generate-project-trailer:56`, `generate-upload-url:70`, `regenerate-audio:59` each `select('user_id').eq('id',projectId)` then reject `user_id !== auth.userId` (skipping for `auth.isServiceRole`). Replicating that guard closes the authenticated class; `seamless-stitcher` additionally needs an auth gate added (it has none); `generate-scene-images` must stop trusting body `userId`.

**Confirmed SAFE (ownership/role/cron/signature enforced):** editor-generate-clip (`:317` owner+org), editor-tts/editor-ai-scene/editor-transcribe, delete-clip (`:128`), delete-project (`:73`), delete-user-account (self only), cancel-project, reserve-credits (`:103/:135`), api-keys-manage, api-v1, distribution-manage (org-role `:69`), export-user-data, export-workspace-report (`:28`), all create-*-checkout, polar-webhook (HMAC `:213`), payments-webhook (Stripe sig), replicate-webhook (sig `:44`), send-push-notification/process-email-queue/monthly-credit-refill (requireServiceRole/cron), admin-* (user_roles gated), and ~70 others.

---

## 3. STORAGE BUCKETS

There is **no `private-media` bucket** — `20260626130000_private_media_buckets.sql` only privatizes `photo-edits` + `support-screenshots`.

### HIGH — gated render output served from PUBLIC buckets (RLS silently bypassed)
`videos` (`20260119050216:3`), `final-videos` (`20260106120200:3`), `video-clips` (`20260106114819:3`), and `scene-images` (`20260104223545:6`) are all `public = true`. Supabase serves public buckets via `/object/public/...` **without RLS**, so anyone with (or guessing/enumerating) the object URL reads it regardless of policy. The repo even added owner-scoped SELECT policies for these (`final_videos_user_select`, `video_clips_user_select`, `videos_user_select`, `20260608010403:30-43`) — but they are **dead** because the bucket `public` flag short-circuits RLS, and `20260626100000_storage_policy_fixes.sql:51-54` confirms this is intentional ("the bucket is public … no SELECT policy needed"). Impact: any visitor with a render/scene URL (shared link, referrer leak, CDN cache, folder enumeration) reads other users' generated — potentially paid/unpublished — media. The per-user policies give false confidence. **Severity HIGH** (project memory flags these as possibly UNUSED pre-launch — confirm before launch).

### GOOD — correctly remediated private buckets (owner-scoped folder isolation)
`user-uploads` (private `20260516140918:2`), `photo-edits`+`support-screenshots` (`20260626130000`), `character-references` (`20260516224719`), `genesis-castings`/`hoppy-uploads`/`enterprise-brand-kits` (`20260516140231:21-27`), `published-renders` (private, owner read scoped to `movie_projects.user_id`, `20260612010000:9-30`), `branded-downloads` (private, owner-folder, `20260611220000:26-33`), `temp-frames` (per-user folder, `20260611190000:257`), `voice-tracks` (private, read-locked — LOW functional lockout only).

### LOW / by-design public
`thumbnails`, `video-thumbnails`, `avatars`, `profile-covers`, `reactions`, `director-commentary`, `workspace-brand`, `brand-assets` (shared public assets).

---

## 4. SECURITY DEFINER FUNCTIONS

Surface is **well-hardened in current state** — credit/role/org mutators consistently re-check `auth.uid()` or are REVOKEd from `authenticated`. No privilege-escalation hole in newest definitions.

**Verified SAFE:** `deduct_credits` (REVOKEd from authenticated, service-role only, `20260516142227:195`), `admin_adjust_credits` (`is_admin` gate), `admin_manage_role` (locked-admin + blocks granting admin), `charge_pre/production_credits` (`auth.uid()`), `revoke_org_seat` (admin/owner), `set_org_onboarding_override` (admin), `tip_reel`/`pledge_patron`/`buy_atom` (spend from `auth.uid()`, reject self, idempotent), `consume_onboarding_intent`, `record_user_media` (IDOR-hardened: rejects `p_user_id <> auth.uid()`), `reserve_credits`/`consume_credit_hold`/`release_credit_hold`/`increment_credits` (REVOKEd from authenticated), the email-containment RPCs (`get_my_profile`, `org_member_directory`, `admin_*`).

### LOW — `profile_overview` PII coupling is fragile
Newest definition (`20260614000000:72`) **dropped** `SECURITY DEFINER` (now invoker) and is granted to `anon, authenticated` (`:178`). It builds `to_jsonb(p.*)` stripping only the three credit columns (`:94`) — it does **not** strip `email`/other PII. The cross-tenant email read is contained *only* because `20260703000000` later REVOKEd the `email` column from `authenticated`. If any table/column SELECT grant is ever re-added, this RPC re-leaks email. Recommend an explicit public-column allowlist. **Severity: LOW (currently contained).**

### LOW — anon-granted RPCs (none mutate privileged state)
`resolve_sso_for_email` (email→SSO enumeration oracle), `analytics_ingest` (anon write), `system_status_overview` (anon read). Info-disclosure/spam only.

---

## TALLY (RLS / auth holes by severity)

| Severity | Count | Items |
|---|---|---|
| CRITICAL | 1 | `seamless-stitcher` (unauthenticated, bills victims, overwrites any project's video) |
| HIGH | 16 | 15 edge-fn IDOR (continue-production class) + public-bucket gated-media leak |
| MEDIUM | 4 | check-video-status, extract-video-frame, generate-hls-playlist, generate-voice (cross-user read / low-impact write IDOR) |
| LOW | 3 | `security_events` open INSERT, `profile_overview` PII coupling, anon RPC enumeration |

**RLS table-layer holes:** effectively **0 high/critical** — every core table is RLS-enabled and correctly scoped (the historical `USING(true)` writes were all remediated). The only table-level finding is `security_events` open INSERT (LOW). **The risk has moved entirely into the edge-function (service-role IDOR) and storage-bucket layers.**

### Single most exploitable issue
**`seamless-stitcher` (CRITICAL).** It is the only finding that is **fully unauthenticated** (`verify_jwt = false`, no in-code auth guard at all) while holding the service-role client. A bare `curl` with a guessed/leaked `projectId` lets an anonymous attacker overwrite any user's finished movie `video_url`, spend the victim owner's credits via `deduct_credits(p_user_id: projectUserId)`, and drive unbounded FFmpeg/compute — no account required.
