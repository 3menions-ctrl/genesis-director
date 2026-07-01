# Genesis Director — FUNCTION-INVENTORY.md

Every user-facing function/interaction, with its entry point and code path, grouped by surface. **Verdict legend:** WORKS · BROKEN (see `BROKEN.md` id) · STUB (intentional) · DEAD (built, no caller) · UNVERIFIED (needs live backend). Severity ids (P0-1 …) cross-reference `BROKEN.md`.

Scope: 108 routes, ~150 edge functions, 419 migrations. ~500 functions inventoried across 10 surfaces. Tables below are the consolidated inventories; full reasoning per surface is in `qa-audit/partials/NN-*.md`.

---

## 1. Social interactions — `partials/01-social.md`

| Function | Entry (file:line) | Code path | Verdict |
|---|---|---|---|
| Follow / unfollow (search) | SearchHub.tsx:535 | useSocial.followUser/unfollowUser → `rpc(toggle_follow)` → follows | WORKS |
| Follow (profile) | Profile.tsx:231 | `rpc(toggle_follow)` reads {following} | WORKS |
| Follow (public profile hook) | usePublicProfile.ts:144 | `rpc(toggle_follow)` → invalidate | WORKS |
| Followers/following counts | useSocial.ts:56/76 | `from(follows).count` | WORKS |
| checkFollowing | useSocial.ts:96 | `from(follows).maybeSingle` | WORKS |
| Following feed / creator discovery | usePublicProfile.ts:253/192 | follows→movie_projects / profiles_public | WORKS |
| Add / edit / delete / reply comment | VideoCommentsSection.tsx:298/113/101/293 | useSocial add/update/deleteComment → project_comments | WORKS |
| **Comment like/react + reply/edit/delete (touch)** | VideoCommentsSection.tsx:64,185 | hover-only controls | **BROKEN P2-1** (invisible on mobile) |
| Comment emoji reaction (logic) | VideoCommentsSection.tsx:32 | useCommentReactions.toggleReaction → comment_reactions | WORKS (double-click race P3) |
| Video emoji reaction | VideoReactionsBar.tsx:26 | useVideoReactions → video_reactions | WORKS (race P3) |
| Reel like (theater/feed) | ImmersiveTheater.tsx:309 / ImmersiveFeed.tsx:142 | `rpc(toggle_like_reel)` | WORKS |
| **Reel emoji reaction (feed)** | ImmersiveFeed.tsx:158 | insert-only reel_reactions, no UNIQUE | **BROKEN P2-2** |
| Reel emoji reaction (theater) | ImmersiveTheater.tsx:332 | proper toggle | WORKS |
| Reel comment add / like | ImmersiveTheater.tsx:386/408 | `rpc(add_reel_comment / toggle_like_reel_comment)` | WORKS |
| Reel comments live | ImmersiveTheater.tsx:284 | realtime insert | WORKS (live rows show "Anonymous" P3) |
| Remix reel | ImmersiveTheater.tsx:357 | `rpc(remix_reel)` → /editor | WORKS |
| Share reel/video/project | ImmersiveTheater.tsx:371 / Reel.tsx:425 / PublicShare.tsx:114 | navigator.share / clipboard | WORKS |
| Send DM / mark read / react / tip | Inbox.tsx:774/687/803/807 | `rpc(send_direct_message / react_to_message / tip_in_thread)` | WORKS |
| Accept/reject follow request | Inbox.tsx:1792/1797 | `rpc(accept/reject_follow_request)` | WORKS |
| Thread state / lane read / AI reply | Inbox.tsx:408/1298/1194 | RPCs | WORKS |
| Legacy DM stack (MessagesInbox/DirectMessagePanel) | components/social/* | useConversations / useSocial.useDirectMessages | DEAD |
| World chat load/send/image/realtime | useWorldChat.ts:53/121 / WorldChat.tsx:180 | `rpc(post_world_chat)` + world-chat bucket | WORKS |
| Notifications list/unread/realtime/mark/delete | useNotifications.ts:93/174/252 | from(notifications) | WORKS |
| Notification click deep-link | NotificationBell.tsx:234 | markRead + deepLinkFor | WORKS |
| Gamification stats/leaderboard (reads) | useGamification.ts:61 | user_gamification etc | WORKS (consumer dead) |
| Gamification addXp / updateStreak | useGamification.ts:163/183 | `rpc(add_user_xp / update_user_streak)` | UNVERIFIED (no live caller) |
| `useSocial.likeComment` | useSocial.ts:389 | insert-only comment_likes | **BROKEN P3 (dead code)** |

## 2. Production pipeline — create / front half — `partials/02-pipeline-create.md`

| Step | Entry (file:line) | Code path | Verdict |
|---|---|---|---|
| Studio handleStartCreation | Studio.tsx:301 | credit pre-gate → invoke mode-router → navigate /production/:id | WORKS |
| CreationStudio form | components/studio/CreationStudio.tsx | config → onStartCreation | WORKS |
| mode-router serve | mode-router/index.ts:252 | auth, content-safety, single-project lock, create project, dispatch | WORKS (lock → P1-3) |
| mode-router cinematic / avatar / style / motion | mode-router:1180/685/1034/1107 | → hollywood-pipeline / generate-avatar-direct / stylize-video / motion-transfer | WORKS |
| hollywood-pipeline serve | hollywood-pipeline:6738 | auth/IDOR/engine-lock, reserve_credits HOLD, background run | WORKS (hold pre-approval → P1-3) |
| executePipelineInBackground | hollywood-pipeline:6242 | stages; fail-closed approval gate :6314 | WORKS |
| runPreProduction | hollywood-pipeline:750 | smart-script-generator, extract-scene-identity | WORKS |
| runQualityGate | hollywood-pipeline:1990 | shot optimization / validation gate :4249 | WORKS (gate no-op → P1-7) |
| runAssetCreation | hollywood-pipeline:2160 | generate-scene-images | WORKS (overwrite risk P2-29) |
| runProduction (clip-1 dispatch) | hollywood-pipeline:2666,3850 | generate-single-clip {triggerNextClip} | WORKS — boundary |
| Production loadProject | Production.tsx:274 | 3-retry load, parse script, drive overlays | WORKS |
| Production handleApproveScript | Production.tsx:1193 | invoke resume-pipeline {qualitygate, approvedShots} | WORKS |
| **Production handleRegenerateScript** | Production.tsx:1253 | invoke hollywood-pipeline {action:'regenerate_script'} | **BROKEN P1-2** |
| Production handleResume / handleCancelPipeline | Production.tsx:1076/1140 | resume-pipeline / cancel-project | WORKS |
| Production handleSimpleStitch / handleRetryClip / auto-stitch | Production.tsx:1034/1011/949 | seamless-stitcher / retry-failed-clip / auto-stitch-trigger | back-half (P0-2, P1-1) |
| resume-pipeline serve | resume-pipeline:50 | resolve stage, rebuild script, forward, credit-skip detect | WORKS |
| ScriptApproval / PipelineCreation | components/create/* | onApprove (OK) / onRegenerate (P1-2) | WORKS / broken regen |
| ScriptReviewPanel toggleSmart / generateStoryboard | ScriptReviewPanel.tsx:152/193 | route-shots / generate-storyboard | WORKS |
| smart-script-generator / generate-scene-images / extract-scene-identity / route-shots / generate-storyboard | edge fns | wired | WORKS |
| seedance-pipeline / seedance-script-director | edge fns | UI routes seedance via hollywood; only api-v1:286 calls seedance | DORMANT (drift, P3) |
| generate-script / generate-story / director-card / scene-character-analyzer / generate-character-for-scene / continuity-audit | edge fns | no caller | DEAD |
| useActiveProjects / useProjectChannel / useCast / usePaginatedProjects | hooks | realtime + lists | WORKS |
| usePredictivePipeline | hook | used only in tests | DEAD |
| PipelinePreview / Cinema / WorkspaceEditor | pages | demo / marketing / editor mount | out of pipeline |

## 3. Production pipeline — render / back half — `partials/03-pipeline-render.md`

| Function/Step | Entry (file:line) | Code path | Verdict |
|---|---|---|---|
| generate-video | generate-video:908 | stateless submit, no DB row, client polls | SUSPECT P2-34 |
| generate-single-clip | generate-single-clip:1071 | async + webhook + optional poll; writes video_clips | WORKS (pred-id reuse P2) |
| editor-generate-clip | editor-generate-clip:227 | no webhook/poller; charges at submit | **BROKEN P1-4** |
| free-tier-generate | free-tier-generate:31 | no webhook, no consumer | BROKEN P1-4 (latent) |
| replicate-webhook | replicate-webhook:144 | HMAC; clip lookup; writes status/url | SUSPECT **P1-5** (avatar race) |
| check-video-status | — | polls + autoComplete writeback | SUSPECT P2-37 (dual status) |
| check-specialized-status | — | avatar/multi-clip status | **P1-6** (never terminal on total fail) |
| poll-replicate-prediction | — | service-role poller | OK/SUSPECT P2 |
| replicate-catalog / replicate-audit | — | catalog proxy / admin sweep | WORKS |
| approve-clip-one | approve-clip-one:42 | analyzer, no writes, no caller | DEAD/SUSPECT |
| **retry-failed-clip** | retry-failed-clip:57 | acquires lock then calls locked fn | **BROKEN P0-2** |
| delete-clip | delete-clip:70 | cancel+delete+refund | SUSPECT P2-35 (dead thumbnail branch) |
| comprehensive-clip-validator | :133 | 5/6 validators missing, fail-open | SUSPECT P2-33 |
| comprehensive-validation-orchestrator | :94 (live via hollywood:4249) | all 6 validators missing → always pass | **BROKEN P1-7** |
| validate-seam-continuity | :61 (live via hollywood:4330) | SSIM, fail-soft | WORKS |
| seamless-stitcher | :222 | ffmpeg cog → private bucket → 24h URL | SUSPECT **P0-1** + P1-1 |
| auto-stitch-trigger | :100 | sets stitching, never finalizes | **BROKEN P1-1** |
| sync-music-to-scenes | :116 | music-cue planner (json only) | WORKS |
| final-assembly | :52 (editor render) | atomic claim → stitcher → finalize | WORKS (inherits 24h URL) |
| production-finish | :224 | grade/upscale, 7-day URL | WORKS |
| render-video | — | legacy render entry | UNVERIFIED |
| generate-hls-playlist | :19 | m3u8 from clips; embeds raw urls | SUSPECT P2-36 |
| generate-project-trailer | :29 | ignores trailer params → full re-render + 24h URL | **BROKEN P1-12** |
| generate-project-thumbnail | :21 | replicate frame-extract, public url | WORKS |
| brand-video-download | :86 | byte-concat MP4 → corrupt | **BROKEN P1-13** |
| extract-video-frame | :36 | last-frame extract | WORKS |
| fix-manifest-audio | :16 | sets video_url to manifest json | SUSPECT P2 |
| regenerate-audio | :21 | generate-voice → voice_audio_url | WORKS |
| pipeline-watchdog | :296 | re-driver, disabled+unscheduled, double-refund | **P1-8** |
| admin-stuck-jobs-watchdog | :10 | detect+alert+kick | WORKS (verify_jwt P2-18) |
| zombie-cleanup | :39 | reap stuck, refund; not scheduled in repo | **P1-8** |
| resume-avatar-pipeline | :31 | legacy predictionId only | **P1-8** |
| job-queue | :330 | in-memory maps | DEAD |
| webhook-dispatch | :144 | SSRF-guarded delivery | WORKS |
| TimelinePlayer | player/TimelinePlayer.tsx:196 | no `<video onError>` | **BROKEN P1-9** |
| Reel "Still rendering…" | Reel.tsx:646 | no poll | **BROKEN P1-10** |
| useClipRecovery / usePendingVideoRecovery / useRenderCompleteNotifier | hooks | recovery polls | P1-11 / P2-30 |
| Reel/ProductionFinalVideo download | Reel.tsx:284 | saves .m3u8 as .mp4 | P2-31 |
| FilmsGallery | FilmsGallery.tsx | foreign supabase project urls | P2-32 |

## 4. Auth & onboarding — `partials/04-auth.md`

| Function | Entry (file:line) | Code path | Verdict |
|---|---|---|---|
| Sign in / sign up submit | Auth.tsx:158 | zod → signIn/signUp → banner / OTP | WORKS |
| Verify OTP / resend | Auth.tsx:215/243 | auth.verifyOtp / auth.resend | WORKS |
| Auth auto-redirect | Auth.tsx:128 | route by role/next | WORKS |
| OAuth provider buttons | Auth.tsx (none) | not implemented (copy lies) | BROKEN P3 (doc/UX) |
| signIn / signUp / signOut | AuthContext.tsx:584/679/733 | password + lockout / signUp / purge | WORKS |
| signInWithMagicLink | AuthContext.tsx:718 | no callers | DEAD P3 |
| fetchProfile / reconcileProfile / init / refresh | AuthContext.tsx:77/485 | get_my_profile, session bootstrap | WORKS (timeout misroute P3) |
| AuthCallback | AuthCallback.tsx:40 | confirm/magic/recovery/PKCE | WORKS (post-signup bounce P3) |
| track-signup | AuthCallback.tsx:136 | invoke track-signup | WORKS |
| ForgotPassword / ResetPassword | ForgotPassword.tsx:29 / ResetPassword.tsx:59,128 | resetPasswordForEmail / updateUser | WORKS (copy contradiction P3) |
| Onboarding | Onboarding.tsx:32 | consume_onboarding_intent → patch → route | WORKS |
| AcceptInvite | AcceptInvite.tsx:39 | accept_organization_invite → switchOrg | WORKS |
| BusinessStart advance/provision | BusinessStart.tsx:360/292 | signUp → verifyOtp → provision | WORKS (intent insert P1-20) |
| ProtectedRoute / GatedRoutes / isPublicPath | components/auth/* | auth + onboarding + gate-by-default | WORKS |
| auth-email-hook / track-signup / manage-sessions / oauth-* / update-user-email | edge fns | render+enqueue / analytics / sessions / integrations | WORKS (email-hook config UNVERIFIED) |

## 5. Settings, account & profile editing — `partials/05-settings-account.md`

| Function | Entry (file:line) | Code path | Verdict |
|---|---|---|---|
| Save profile fields / avatar upload | AccountSettings.tsx:166/120 | profiles.update / avatars bucket | WORKS |
| **Change email (/settings)** | AccountSettings.tsx:195 | invoke update-user-email {newEmail} only | **BROKEN P2-3** |
| **Opt-out activity tracking (/settings)** | AccountSettings.tsx:95 | writes user_gamification (wrong table) | **BROKEN P2-4** |
| **Deactivate (/settings)** | AccountSettings.tsx:559 | navigate → redirect | **BROKEN P2-5** |
| Save prefs / notif cadence / password / sign-out-all | PreferencesSettings.tsx:90 / NotificationSettings.tsx:67 / SecuritySettings.tsx:46/76 | profiles.update / auth.updateUser / signOut | WORKS |
| **Active Sessions (/settings)** | SecuritySettings.tsx:300 | hardcoded markup | **BROKEN P2-6 (fake)** |
| Export data | SecuritySettings.tsx:88 | invoke export-user-data | WORKS |
| **Delete account (both surfaces)** | SecuritySettings.tsx:124 / SettingsDashboard.tsx:2508 | invoke delete-user-account (no body) | **BROKEN P1-18** |
| Referrals | ReferralsSettings.tsx:14 | referral_codes / redemptions | WORKS |
| Profile autosave (×12) / avatar+cover / prefs / featured reel | ProfileDashboard.tsx:1138/5245/6098/3711 | profiles.update / storage / RPC | WORKS |
| Settings autosave (×50) | SettingsDashboard.tsx:726-1950 | profiles.update / preferences / notification_settings | WORKS |
| Browser-push toggles | SettingsDashboard.tsx:1248 | push_preferences upsert | WEAK P3 (no feedback) |
| Patron tier inline edits | SettingsDashboard.tsx:1762 | patron_tiers.update | WEAK P3 (no feedback) |
| Change email/password / 2FA / sign-out / link-identity / export / deactivate (account) | SettingsDashboard.tsx:2006/2341/2273/2186/2068/2404/2418 | correct bodies / auth.mfa / auth.signOut | WORKS |
| NotificationSettings (bell) | account/NotificationSettings.tsx:152 | notification_preferences upsert (untyped) | WORKS |
| SessionsCard (real) | components/security/SessionsCard.tsx:63 | invoke manage-sessions | WORKS (mounted only in Profile; missing prop P3) |
| edge: update-user-email / delete-user-account / export-user-data / manage-sessions / newsletter-subscribe / handle-email-* | edge fns | re-auth / delete / export / sessions / subscribe | WORKS (clients don't send delete body → P1-18) |

## 6. Credits, billing & payments — `partials/06-credits-payments.md`

| Function | Entry (file:line) | Code path | Verdict |
|---|---|---|---|
| Buy credits / subscribe | Credits.tsx:164/176 | startCreditCheckout / createSubscriptionCheckout → polar-checkout → redirect | WORKS |
| History / payment-return / balance | Credits.tsx:107/130/160 | credit_transactions / reconcile / get_credit_state | WORKS |
| BuyCreditsModal buy | BuyCreditsModal.tsx:44 | startCreditCheckout → Polar | WORKS |
| getPaymentsProvider / polarProvider / stripeProvider | lib/payments/* | stripe-lock reroutes stripe→polar | WORKS / 🔒 |
| getAuthoritativeCreditState / useEffectiveCredits / useCreditBilling / useTierLimits | hooks | reserve-credits state / org RPC / get_credit_state | WORKS |
| useCinemaEntitlement / useCinemaGuard | useCinemaEntitlement.ts:65,156 | get_cinema_entitlement; guard in Studio.tsx:220 | **BROKEN P2-8 (never enforces)** |
| polar-checkout / polar-portal / polar-webhook | edge fns | hosted checkout / portal / fulfillment | WORKS (portal no caller → P2-7) |
| reserve-credits / reconcile-credit-holds / monthly-credit-refill | edge fns | hold/consume/release / TTL reconcile / org refill | WORKS |
| create-*-checkout / create-portal-session / payments-webhook / cinema/org/invoice/seat fns | edge fns | 503 STRIPE_BILLING_LOCKED | STUB (intentional) |
| create-org-checkout / cinema fns (UI wiring) | — | no caller | **ORPHANED P2-8/P2-9** |
| stripe-connect-onboard / payout | edge fns | KYC / cash-out (not locked) | WORKS (returnUrl P3) |
| PatronHub pledge/cancel | PatronHubPage.tsx:194 | rpc pledge_patron_tier (internal credits) | WORKS |
| Pricing CTAs / WelcomeCheckout | Pricing.tsx:493 | navigate /credits | WORKS (vestigial modal P3) |
| **Billing portal button** | (none) | polar-portal has no UI caller | **BROKEN P2-7** |

## 7. Library, media & galleries — `partials/07-library-media.md`

| Function | Entry (file:line) | Code path | Verdict |
|---|---|---|---|
| useFileUpload upload / fromUrl / delete | useFileUpload.ts:81/197/227 | quota → storage upload → signed url | WORKS (delete = storage only) |
| useMediaLibrary list / remove / favorite | useMediaLibrary.ts:48/105/115 | get_user_media_library / delete row / update | WORKS (remove = registry only P3) |
| Library list / counts / surpriseMe | Library.tsx:115/165/212 | usePaginatedProjects / counts / navigate | WORKS |
| **Library delete** | Library.tsx:223 | raw movie_projects.delete() | **BROKEN P1-19** |
| Library share / edit | Library.tsx:890/885 | clipboard /r/:id (login-gated) / editor | WORKS / P2-17 |
| StitchedVideo playback | Library.tsx:540 | video_clips ordered | WORKS |
| Gallery showcase read/add/update/delete/reorder | useGalleryShowcase.ts:6/29/53/78/100 | gallery_showcase CRUD | WORKS (reorder non-atomic P3) |
| useReelPublisher.publish | useReelPublisher.ts:25 | rpc publish_reel → /r/{id} | WORKS |
| PublishWizard / GlobalPublishWizard | PublishWizard.tsx:115 | publish_reel + prompt_submissions → /watch | WORKS |
| UploadReelDialog (BYO video) | UploadReelDialog.tsx:91 | upload public buckets → movie_projects insert | WORKS |
| useWorkspaceCovers / useImagePreloader / useChunkedAvatars | hooks | covers / preload / progressive | WORKS |
| ActiveRendersCard / FilmsGallery (/films) | components/library / FilmsGallery.tsx:83 | useActiveProjects / static data | WORKS |
| generate-upload-url | edge fn | auth + bucket allowlist + path-traversal reject | WORKS (no client caller, UNVERIFIED) |
| **mint-project-share** | edge fn | mint_project_share_slug; no UI caller | **ORPHANED P2-16** |
| delete-project / cancel-project / cleanup-stale-drafts / premiere-recap | edge fns | full delete / cancel+refund / prune / recap | WORKS |

## 8. Business workspace — `partials/08-business.md` (~110 controls; representative)

| Function | Entry (file:line) | Code path | Verdict |
|---|---|---|---|
| Ad Studio generate concepts / variants | BusinessAdStudio.tsx:279/562 | generate-ad-studio / generate-ad-variants | WORKS (live UNVERIFIED) |
| Export MD / Send to Create / copy | BusinessAdStudio.tsx:447/452 | Blob / saveDraft → /create | WORKS (drops enableMusic P3) |
| Invite / role / remove / credit-limit / revoke | BusinessTeam.tsx:125/148/161/167/178 | organization_invites/members + RPC | WORKS (invite no email P2-12) |
| Permissions matrix | BusinessPermissions.tsx:19 | static MATRIX | STUB |
| sync-org-seats | edge fn | locked + no caller + Stripe | DEAD P3 |
| Brand commit / logo upload | BusinessBrand.tsx:93/340 | organizations update / storage | WORKS (logo not applied until commit P3) |
| Settings / general save | BusinessSettings.tsx:32 / BusinessGeneral.tsx:72 | searchParams / organizations update | WORKS |
| Billing / credits dashboards | BusinessBilling.tsx:98 / BusinessCredits.tsx:130 | rpc org_credit_transactions | WORKS |
| Spend alerts / auto-recharge | BusinessCredits.tsx:155/168 | rpc set_org_* | STUB (persist only, disclosed) |
| Plan/seat/credit purchase | (none) | no control | STUB (by design) |
| Analytics load / range / export | BusinessAnalytics.tsx:52/225/151 | org RPCs + movie_projects / Blob | WORKS |
| Widget config read / log event / generate | get/log/generate-widget-config | configs / events / AI builder | WORKS / WORKS / **ORPHANED P3** |
| Integrations webhook save/test / OAuth connect | BusinessIntegrations.tsx:130/242 | rpc + notify-org-event / oauth-authorize | WORKS |
| Distribution connect / publish / schedule | BusinessDistribution.tsx:383/316/(sched) | distribution-manage | WORKS / Meta premature P2-14 / **never posts P2-13** |
| Verify domain | BusinessSecurity.tsx:121 | verify-org-domain (real DNS TXT) | WORKS |
| API keys list / generate / revoke | BusinessApi.tsx:112/139/179 | org_api_keys | WORKS (auth drift P2-11; pool false P2-15; last_used P3) |
| api-v1 auth / videos / photo / avatars | api-v1:75/274/308/202 | find_api_key_owner → deduct → pipeline | WORKS / 501 stub (drift P2-11) |
| Reports export ×4 | BusinessReports.tsx:114 | export-workspace-report | **BROKEN P2-10 (spend empty)** |
| Templates create/delete / effect tiles | BusinessTemplates.tsx:266/198/132 | org_templates insert(config {}) / Link | WORKS (inert apply STUB) |
| Audit load/export / Assets / Approvals | BusinessAudit.tsx:64 / BusinessAssets.tsx:133 / BusinessApprovals.tsx:228 | events + RPC / storage / approval_requests | WORKS (blank actor P3) |
| Overview / Projects / Security / Notifications / Danger / Rail / Shell | Business*.tsx | real queries + nav | WORKS (owner-name P3) |
| **Onboarding ensureIntent / provisionWorkspace** | BusinessStart.tsx:279/292 | insert onboarding_intents | **BROKEN P1-20 (RLS rejects all)** |

## 9. Admin console — `partials/09-admin.md`

| Function | Entry (file:line) | Code path | Verdict |
|---|---|---|---|
| useAdminAccess / AdminApp routes / gates | useAdminAccess.ts:29 / AdminApp.tsx:91 / AdminLayout.tsx:82 | session + user_roles / is_admin RPC | WORKS (solid gating) |
| List users / adjust credits / toggle role | AdminUsersPage.tsx:55/73/90 | admin_list_users / admin_adjust_credits / admin_manage_role | WORKS |
| Force logout / bulk grant / suspend / restore | AdminUsersPage.tsx:307/127/150/169 | invoke admin-force-logout / admin_bulk_* | WORKS (window.confirm P2-19) |
| User detail / grant / suspend / revoke sessions / destructive auth ops | AdminUserDetailPage.tsx:105/250/270/303/218 | admin_get_user_detail / admin_grant_credits (window.prompt) / admin-user-action | WORKS (**P2-19** prompt fragile) |
| admin-user-action / -force-logout / -replicate-health / -analytics / cleanup-analytics / alert-dispatch | edge fns | admin-gated service-role ops | WORKS |
| admin-stuck-jobs-watchdog | edge fn:10 | requireCronSecret → detect_stuck | **P2-18 (verify_jwt mismatch)** |
| admin-delete-auth-user / revoke-demo-sessions | edge fns | admin-gated but no caller | DEAD P3 |
| check-secrets-status / reconcile-credit-holds | edge fns | admin/service gated | WORKS (dynamic import P3) |
| Secrets / Analytics / Backups / Crash forensics / Replicate health (pages) | Admin*Page.tsx | invoke fns / table reads | WORKS (prod RPC lag UNVERIFIED) |

## 10. Studio assets + editor — `partials/10-studio-editor.md`

| Function | Entry (file:line) | Code path | Verdict |
|---|---|---|---|
| Load/filter avatar vault / add-to-cast / cast-in-studio | Avatars.tsx:133/200/212 | avatar_templates / cast-store | WORKS |
| **Avatar voice preview** | Avatars.tsx:780/1049 | sample_audio_url never populated | **BROKEN P2-25** |
| generate-voice / -avatar-image / -avatar-scene / -avatar-direct / seed-* | edge fns | gated generation | WORKS |
| generate-avatar-batch | — | directory absent | DEAD |
| Build cast / portrait / upload / delete / pin | Cast.tsx:100/66/85/123/129 | director_cast / generate-cast-portrait / storage | WORKS (delete no confirm P3) |
| Crossover load / quick gen / customize | Crossover.tsx:428/558/552 | rpc crossover_browse / mode-router | WORKS (slug dropped P2-24) |
| DirectorCards / BreakthroughLab / director-card fn | DirectorCards.tsx:69 / BreakthroughLab.tsx | table reads / client FX / (no caller) | WORKS / WORKS / DEAD |
| Browse/use templates / increment use | Templates.tsx:371 / TemplateDetailDrawer.tsx:369 | navigate /create?template + rpc | WORKS |
| Browse environments | Environments.tsx:490 | client filter | WORKS |
| **Apply scene to project** | Environments.tsx:530 / useTemplateEnvironment.ts:1456 | resolver knows 20/122 ids | **BROKEN P1-16** |
| Generate score / play / upload | MusicHub.tsx:675/201/531 | generate-music / audio / storage | **P2-21/P2-22 (double-write, duration lie)** |
| scene-music-analyzer / elevenlabs-music / -sfx | edge fns | server-only / no caller | WORKS / DEAD |
| Apply template / chat edit / inpaint / bulk | PhotoEditorHub.tsx:99/231 / PhotoBulkPanel.tsx:50 | edit-photo / inpaint-photo | WORKS (**refund P1-15**, idempotency P2-26) |
| Image studio generate / reference analyze | ImageStudioHub.tsx:225 / ReferenceImageUpload.tsx:101 | studio-image / analyze-reference-image | WORKS / **P2-27 (aspect-expand no-op)** |
| Stylize video / motion transfer / lipsync | mode-router:1061/1132 / DialogueLipSync.tsx:84 | stylize-video / motion-transfer / apply-lipsync | **P1-17 (placeholder versions)** / WORKS |
| Editor mount / autopick | Editor/index.tsx:30/79 | useProject/persistence/sync | WORKS / DEAD |
| **Approve & Render (×3) / orchestrator / render queue / addRenderJob** | Script.tsx:418 / orchestrator.ts:298 / RenderQueuePanel.tsx:54 | installJobRunner never called | **BROKEN P1-14 (dead)** |
| Export (Save & publish) | ExportPanel.tsx:43 | flush → publish_reel → is_public | WORKS (no render) |
| Generate clip (editor) | CreatePanel.tsx:244 | editor-generate-clip | WORKS (orphan risk P1-4) |
| Director Chat NL edits | DirectorChat.tsx:115 | store mutators / director-chat | WORKS |
| Music pick/generate/upload / **replace** | MusicPicker.tsx:119 / Timeline.tsx:587 | ingest / store-only delete | WORKS / **P2-23 (old row kept)** |
| **Trim / reorder / split / delete / title** | Timeline.tsx:1464 / store.ts:553/1278/1142 | editor_state only; stitcher reads scenes[] | **BROKEN P2-20 (dropped from render)** |
| Text overlays / color grade / audio mix | TextStudioPanel.tsx:44 / store.ts:974/1080 | editor_state / clip.properties → video_clips | WORKS |
| Cast CRUD / save dialog / auto-captions / TTS | CastEditor.tsx:60 / SaveDialog.tsx:134 / auto-captions.ts:33 / editor-tts.ts:35 | document-store / editor-transcribe/tts | WORKS (not credit-gated P3) |
| editor-ai-scene / svg-rasterize / translate-text | edge fns | no caller / service / public | DEAD / WORKS |

---

### Cross-cutting verified-good (not exhaustive)
Gate-by-default + tight public allowlist; admin server-side role re-checks on every destructive fn; Polar webhook idempotency + correct ledger writes; payout double-charge protection; `confirmAsync` used everywhere except admin (P2-19) and Cast delete (P3); double-submit guards across auth.
</content>
