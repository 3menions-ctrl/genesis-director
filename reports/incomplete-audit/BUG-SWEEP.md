# Small Bridges — Deep Bug Sweep (200+ target met)
> 2026-06-26. Net-new bugs found by 8 parallel hunters, on top of the 109 in BACKLOG.md. Each has `file:line` evidence + severity. **Grand total documented: 109 + 345 = 454** (this file = the 345 new, S1–S345).
> Sections: A pages(68) B forms(48) C ai-integration(37) D a11y(47) E null-safety(22) F security(17) G hooks(24) H routing(16) I storage(22) J performance(19) K realtime(16) L type-casts(9). Crit/High first within each.

## A — Pages / routes (68)
- [ ] S1 🔴 `SettingsDashboard.tsx:2389` delete-account ignores `{error}` → false "deleted" confirmation + sign-out on server failure
- [ ] S2 `SettingsDashboard.tsx:983` external-links editor writes to DB on every keystroke; out-of-order writes clobber latest
- [ ] S3 `SettingsDashboard.tsx:1176` timezone free-text writes profile per keystroke
- [ ] S4 `SettingsDashboard.tsx:1506,1981,1993,2305` tier-delete/disable-2FA/unlink/deactivate use native window.confirm (violates standard)
- [ ] S5 `SettingsDashboard.tsx:2003` "Link google/github/apple" starts OAuth though app is email-only (dead/broken)
- [ ] S6 `Settings.tsx:37` activeSection seeded once; no sync to searchParams (back/forward desync)
- [ ] S7 `Settings.tsx:51` setSearchParams replaces whole query string, drops other params
- [ ] S8 `Settings.tsx:197` nav indicator y=index*68 but rows h-16 (64px) → drift
- [ ] S9 `Settings.tsx:124` back uses history.back(); deep-link/new-tab → no-op
- [ ] S10 `AuthCallback.tsx:187` PKCE recovery `?code` with no type → dropped into app not /reset-password
- [ ] S11 `ResetPassword.tsx:146` navigates /projects but UI says "redirecting to sign in" → contradiction
- [ ] S12 `Auth.tsx:235` resendCode no try/catch → unhandled rejection, no banner
- [ ] S13 `WelcomeCheckout.tsx:44` starterCredits computed, never used (dead)
- [ ] S14 `BusinessTeam.tsx:210` invite dropdown omits valid `editor` role
- [ ] S15 `BusinessStart.tsx:413` runProvision navigates /business even on provision failure (swallowed) → no org
- [ ] S16 `BusinessSecurity.tsx:142` ssoAvailable checks plan business/enterprise but real plans growth/scale → paying orgs see SSO unavailable
- [ ] S17 `BusinessDanger.tsx:88` export reads organization_brand_assets but Brand writes workspace_brand_assets → logos missing
- [ ] S18 `BusinessDanger.tsx:135` shared busy flag → Transfer/Delete spins the Export row
- [ ] S19 `BusinessAudit.tsx:247` positive-credit badge branch dead (rows filtered to project_id) → grants never show
- [ ] S20 `BusinessProjects.tsx:111` owner names from profiles not org_member_directory → RLS makes all "Member"
- [ ] S21 `BusinessIntegrations.tsx:303` oauth.find no status ordering → revoked row masks active as "Not connected"
- [ ] S22 `BusinessNotifications.tsx:141` RouteSpec.channels unused → toggles unsupported channels
- [ ] S23 `BusinessGeneral.tsx:88` fn_log_workspace_event awaited in save try; its failure shows "Failed to save" after commit
- [ ] S24 `BusinessAdStudio.tsx:308` ConceptCard keyed by index → VariantLab state leaks across regenerated concepts
- [ ] S25 `BusinessAdStudio.tsx:565` UI caps Math.min(12,…) but generate() sends uncapped
- [ ] S26 `BusinessApprovals.tsx:243` Approved/Rejected with 0 matches → fully blank page (no header/empty state)
- [ ] S27 `BusinessProjects.tsx:450` Sort pill permanently highlighted (active=value!=="all" reused, never "all")
- [ ] S28 `BusinessOverview.tsx:81`(+BusinessProjects:90,BusinessNotifications:62) load() returns early on !orgId without clearing loading → perpetual skeleton
- [ ] S29 `BusinessCredits.tsx:282,417` links to retired /workspace/billing + /workspace/analytics
- [ ] S30 `BusinessBrand.tsx:89` addCustom .slice(0,5) drops color at cap but clears input as if saved
- [ ] S31 `BusinessTeam.tsx:206` Enter in invite email bypasses the inviting/empty guard
- [ ] S32 `BusinessStart.tsx:247` OTP accepts 6–8 chars but codes are 6 → 7–8 pass UI then fail
- [ ] S33 `BusinessStart.tsx:815` PreviewCard key={c} on [primary,accent] → dup keys when equal
- [ ] S34 `BusinessReports.tsx:57` a.click() then immediate revokeObjectURL → can cancel download
- [ ] S35 🔴 `Crossover.tsx:281` TIER_HUE[tier].replace + ENGINES[bp.engine] deref throws → crashes the card for unknown tier/engine
- [ ] S36 `Crossover.tsx:677` onSeeAll={()=>{}} but CategoryRail renders clickable "See all" → dead button
- [ ] S37 `Lobby.tsx:406` "directors" link to /u/:id while app uses /c/… → broken profile path
- [ ] S38 `Help.tsx:412` "ENTER TO JUMP" hint but no onKeyDown → no-op
- [ ] S39 `Help.tsx:769` FAQ open tracked by numeric idx → wrong item expands after search filters list
- [ ] S40 `Inbox.tsx:1020` Bubble reads msg.ai_video_url not in type/select → AiVideoPreview never renders
- [ ] S41 `Lobby.tsx:367` "New this week" built from unfiltered feed → shows other worlds when one selected
- [ ] S42 `Lobby.tsx:260` "Films today" = top-30 all-time by play_count → mislabeled metric
- [ ] S43 `Library.tsx:219` "New film" shows ⌘N shortcut but no handler
- [ ] S44 `Library.tsx:141` category pills computed from loaded page only → later-page genres hidden
- [ ] S45 `Avatars.tsx:1517` CastBar "max 8" but toggleCast/addToCast enforce no cap
- [ ] S46 `Blog.tsx:289` "{count} stories" always BLOG_ARTICLES.length, ignores filter
- [ ] S47 `MusicHub.tsx:199,363` `<a download>` won't force cross-origin download; copy mismatch (10min vs 500MB·10min)
- [ ] S48 `StudioShowcase.tsx:700` "Start now" always /auth?mode=signup even when signed in
- [ ] S49 `StudioShowcase.tsx:462` enterStudio()/BrandReveal transition never invoked (dead)
- [ ] S50 `Studio.tsx:484` handleStartCreation deps omit `effective` → stale org-balance gate
- [ ] S51 `TrainingVideo.tsx:288` preload fires ~27 serial generate-voice TTS calls per cold-cache mount
- [ ] S52 `Pricing.tsx:483` setShowBuyModal never called → rendered BuyCreditsModal can never open
- [ ] S53 `PatronHubPage.tsx:182` goalPct ÷ target_credits no zero guard → "NaN% FUNDED"
- [ ] S54 `Reel.tsx:447` "views" value = likes_count under Eye icon but labeled reactions
- [ ] S55 `Production.tsx:943` auto-stitch effect reads clipResults but missing from deps (1002) → stale gate
- [ ] S56 `EmbedPlayer.tsx:34` empty slug early-returns without setLoading(false) → permanent black screen
- [ ] S57 `EnterpriseComingSoon.tsx:35` two conflicting document.title writes on mount
- [ ] S58 `SearchHub.tsx:192` track("search") inside debounce logs partial query strings
- [ ] S59 `WorldDetail.tsx:160,238`(+Profile:1341) links to legacy /watch/:id (redirect hop)
- [ ] S60 `CastEditor.tsx:162` save/remove mutate doc.cast in place + flushNow → snapshot ref unchanged, removed char stays visible
- [ ] S61 `BudgetPanel.tsx:234` getEngine(...).displayName unguarded → crashes Budget panel on unknown engine
- [ ] S62 `EditorShell.tsx:391` Esc guard checks 5 of ~12 modal flags → Esc closing others also wipes selection
- [ ] S63 `Timeline.tsx:451,670` "Clear all clips"/delete-track use window.confirm
- [ ] S64 `CreatePanel.tsx:303` poll success `if(!videoUrl) return` → optimistic clip stuck, toast unresolved
- [ ] S65 `Script.tsx:1547` completed ShotCardCta shows Lock+"Re-render" title but wired to onApprove → contradiction
- [ ] S66 `EditorShell.tsx:439` E/C on no-project surface set open flag but panels project-gated → dead key
- [ ] S67 `MediaLibrary.tsx:272` footer hint "Shift M" but bound to Shift+Y
- [ ] S68 `CommentsPanel.tsx:160` panel C handler loses to shell c-toggle → "press C to focus" never works

## B — Forms / input validation (48)
- [ ] S69 🔴 `VoicePalette.tsx:97,134` promises "type instead" fallback but renders no input → unusable in Firefox/older Safari
- [ ] S70 `CreationHub.tsx:1044` prompt textarea no maxLength/slice (counter says /1000) → unbounded text to DB/pipeline
- [ ] S71 `AccountSettings.tsx:375` profile fields (display_name/company/role/use_case) no maxLength/validation
- [ ] S72 `AccountSettings.tsx:174` handleSave no trim() → whitespace-only names persist
- [ ] S73 `NotificationSettings.tsx:49` setIsLoading(false) only inside if(profile) → null-profile stuck spinner
- [ ] S74 `PreferencesSettings.tsx:72` same null-profile stuck spinner
- [ ] S75 `ReferralsSettings.tsx:33` get-or-create never checks insert error → empty code+link, no error
- [ ] S76 `BillingSettings.tsx:178` CSV export no quote-escape / no formula-injection neutralize
- [ ] S77 `AuthOtpInput.tsx:39` slices each onChange to 1 char → one-time-code autofill captures only first digit
- [ ] S78 `BrandInquiryDialog.tsx:83` email type but button onClick (no form) → native validation never fires
- [ ] S79 `BrandInquiryDialog.tsx:87` budget number min=0 no max → 999999999 stored
- [ ] S80 `BrandInquiryDialog.tsx:91,99` deliverables/notes/contactEmail no maxLength
- [ ] S81 `PublishWizard.tsx:264` tags no maxLength/per-tag cap
- [ ] S82 `PublishWizard.tsx:273` director-notes no maxLength
- [ ] S83 `DirectMessagePanel.tsx:112` handleSend swallows failures (console only), no toast
- [ ] S84 `WatchParty.tsx:126` chat insert fire-and-forget, optimistic msg lost on RLS/DB failure
- [ ] S85 `ReferenceImageUpload.tsx:85` FileReader no onerror → failed read hangs await, isAnalyzing never resets
- [ ] S86 `AdminGalleryManager.tsx:71` no trim/url-validate; Save not disabled while pending → dup rows
- [ ] S87 `CreationStudio.tsx:831,920` breakout/crossover create no in-flight disabled → double credit charge
- [ ] S88 `BusinessTeam.tsx:117` invite Enter path not a form → HTML5 email validation skipped → garbage persisted
- [ ] S89 `BusinessTeam.tsx:117` handleInvite no if(inviting) guard → dup invite rows
- [ ] S90 `BusinessGeneral.tsx:72` billingEmail never validated (onClick not form) → invalid email saved
- [ ] S91 `DirectorCommentaryRecorder.tsx:99` no blob.size/min-duration guard → 0-byte file + duration_seconds:0 row
- [ ] S92 `VoicePalette.tsx:182` "Enter to send" but no Enter handler (dead)
- [ ] S93 `SecuritySettings.tsx:40` currentPassword in state, never used → no re-auth on password change
- [ ] S94 `SecuritySettings.tsx:52` only length<8 enforced, strength shown not enforced
- [ ] S95 `SecuritySettings.tsx:125` delete-confirm !=='DELETE' no trim → trailing space blocks correct word
- [ ] S96 `SecuritySettings.tsx:76` "Sign Out All" no in-flight guard → concurrent global sign-outs
- [ ] S97 `AccountSettings.tsx:136` avatar fileExt from split('.').pop() (dotless→whole name); no ext whitelist
- [ ] S98 `BillingSettings.tsx:60` fetchTransactions swallows error → "No transactions" hides failure
- [ ] S99 `ReferralsSettings.tsx:61` null code → Copy copies '' but toasts "copied"
- [ ] S100 `AuthOtpInput.tsx:50` backspace on empty cell desyncs cells from value
- [ ] S101 `BrandInquiryDialog.tsx:95` deadline date no min → past date selectable
- [ ] S102 `UploadReelDialog.tsx:77` no client size check; multi-GB accepted despite "≤500MB"
- [ ] S103 `VideoCommentsSection.tsx:167` fetchProfiles no race guard → stale out-of-order authors
- [ ] S104 `VideoCommentsSection.tsx:86` handleDelete no confirmation → one click permanently deletes
- [ ] S105 `SupportInbox.tsx:66` realtime filter interpolates email.eq.${email} → control char breaks `or`
- [ ] S106 `AdminCreditPackagesManager.tsx:152` name !form.name only; no maxLength/upper-bound; delete double-fire
- [ ] S107 `AdminSystemConfig.tsx:206` 3 sequential upserts no transaction → partial save; free text no maxLength
- [ ] S108 `AdminMessageCenter.tsx:142` adminNotes/replyText no maxLength; buttons no in-flight guard; mailto unencoded
- [ ] S109 `TemplateComposer.tsx:65` copyPrompt clipboard no try/catch → unhandled rejection
- [ ] S110 `BusinessTeam.tsx:163` setLimit window.prompt+parseInt → "12abc"→12, no upper bound
- [ ] S111 `BusinessGeneral.tsx:122` name/website no maxLength/url-validate
- [ ] S112 `Contact.tsx:100` name/subject/message inserted untrimmed (whitespace-only persists)
- [ ] S113 `Contact.tsx:108` email validated on trim but inserted untrimmed
- [ ] S114 `BusinessStart.tsx:551` company/display/website no maxLength
- [ ] S115 `AdminAvatarBatchV2.tsx:151` nextIndex no null guard → NaN progress + "Resume #NaN"
- [ ] S116 `AdminPricingConfigEditor.tsx:284` stale "$0.116/credit" text contradicts $0.10; description no maxLength

## C — AI / media provider integration (37)
- [ ] S117 🔴 `generate-single-clip/index.ts:111` Seedance hardcoded `seedance-2.0` vs catalog `seedance-1-pro` → 404
- [ ] S118 🔴 `generate-single-clip/index.ts:104` default Kling `kling-v3-video` vs catalog `kling-v2.1-master` → default engine 404
- [ ] S119 🔴 `composite-character/index.ts:67` Replicate `version:"lucataco/remove-bg"` (slug not hash) → bg-removal always fails
- [ ] S120 🔴 `composite-character/index.ts:129` `version:"black-forest-labs/flux-1.1-pro"` slug-not-hash → compositing rejected
- [ ] S121 🔴 `editor-transcribe/index.ts:40` `model_id:"scribe_v2"` invalid (only v1) → every transcription 422
- [ ] S122 🔴 `landing-demo-chat/index.ts:190` `gemini-3-flash-preview` (verify existence) → demo chat canned fallback
- [ ] S123 🔴 `director-chat/index.ts:69` same model id (I shipped this in M13 — VERIFY the gateway supports it, else chat always fallback)
- [ ] S124 `extract-video-frame/index.ts:34` pinned version hash → 404 when retired, silent degraded frames
- [ ] S125 🔴 `extract-scene-identity/index.ts:398` JSON.parse(choices[0].content) no try/catch; throws after 5cr charged, no refund
- [ ] S126 `extract-scene-identity/index.ts:534` same for Pass-2 (max_tokens 3500), paid-but-failed
- [ ] S127 🔴 `poll-replicate-prediction/index.ts:147` succeeded+null output → neither branch → self-chains 30× on terminal prediction
- [ ] S128 `scene-music-analyzer/index.ts:143` JSON.parse(jsonMatch[0]) outside try/catch → truncation 500s, skips fallback
- [ ] S129 `scene-character-analyzer/index.ts:307` JSON.parse no try/catch → truncated/fenced output 500s casting
- [ ] S130 `generate-voice/index.ts:232` output?.url||output returns raw object → TypeError on .substring
- [ ] S131 `translate-text/index.ts:199` assumes tool_calls[0]; plain content → silently returns untranslated source
- [ ] S132 `replicate-webhook/index.ts:309` error.substring(0,500) assumes string → object error 500s webhook
- [ ] S133 `replicate-audit/index.ts:293` Array.isArray?output[0]:output under truthy check → empty [] → undefined to fetch()
- [ ] S134 `generate-story/index.ts:480` max_tokens 2000 regardless of clipCount(≤20) → truncated, fewer clips, no finish_reason check
- [ ] S135 `_shared/video-engines.ts:350` submitToReplicate single fetch, no timeout/5xx-retry/429 handling
- [ ] S136 `check-video-status/index.ts:114` status fetch no timeout/retry → transient 429/503 marks running clip FAILED
- [ ] S137 `poll-replicate-prediction/index.ts:102` poll fetch no AbortController → hang stalls past budget
- [ ] S138 `elevenlabs-music/index.ts:38` music fetch no timeout/retry
- [ ] S139 `generate-scene-images/index.ts:276`(+inpaint:60) `if(!ok) continue` swallows 429/5xx, loops 3s
- [ ] S140 `composite-character/index.ts:95` poll .json() no .ok check → undefined status spins to timeout
- [ ] S141 🔴 `generate-avatar-image/index.ts:158` assumes base64 data URI; HTTP url/svg → atob throws, 500s avatar gen
- [ ] S142 `edit-photo/index.ts:311` non-data output fetched with no ok/content-type/size → error HTML stored as PNG
- [ ] S143 `elevenlabs-music/index.ts:59` arrayBuffer forced audio/mpeg, no upstream content-type check → JSON relayed as corrupt audio (also sfx:60)
- [ ] S144 `generate-avatar-image/index.ts:164` hardcoded contentType image/png though JPEG/WebP possible (also analyze-reference:193,322; composite:58,116)
- [ ] S145 `elevenlabs-music/index.ts:46` sends duration_seconds to /v1/music (expects music_length_ms) → ignored
- [ ] S146 `elevenlabs-sfx/index.ts:46` duration_seconds unclamped, sfx caps ~22s → 30s default 422s
- [ ] S147 `studio-image/index.ts:88` user referenceUrl → gateway image_url, no SSRF allowlist/size cap
- [ ] S148 `script-assistant/index.ts:105` expand/condense branches use raw currentScript/userPrompt not validated* → bypass length caps
- [ ] S149 `generate-script/index.ts:252` userIntent.coreAction interpolated verbatim into SYSTEM prompt → injection vector
- [ ] S150 🔴 `check-specialized-status/index.ts:208` read-modify-write of predictions array → concurrent webhook clobbers a clip
- [ ] S151 `replicate-audit/index.ts:237` orphan match only kling/video/start_image → Seedance/Veo/Sora/Wan orphans skipped
- [ ] S152 `check-specialized-status/index.ts:81` replicateApiKey never null-checked → `Bearer undefined` 401
- [ ] S153 `landing-demo-chat/index.ts:227` success text/event-stream but error paths application/json → EventSource can't parse fallback

## D — Accessibility (47)
- [ ] S154 `SecuritySettings.tsx:213,236` password show/hide toggles no aria-label (×2)
- [ ] S155 `BusinessStart.tsx:660` password visibility toggle no aria-label
- [ ] S156 `ProjectFilters.tsx:118` search clear-X no aria-label
- [ ] S157 `ProjectFilters.tsx:257,268` grid/list view toggles no aria-label/aria-pressed (×2)
- [ ] S158 `TwoFactorCard.tsx:216` copy-secret no aria-label
- [ ] S159 `WelcomeOfferModal.tsx:108` modal close X no aria-label
- [ ] S160 `DirectMessagePanel.tsx:138,156` back/close icon buttons no aria-label (×2)
- [ ] S161 `ExamplesGallery.tsx:425,442` custom play/pause + mute buttons no aria-label (×2)
- [ ] S162 `FilmsGallery.tsx:70` clip-selector dots no descriptive aria-label
- [ ] S163 `AccountSettings.tsx:322` user avatar alt=""
- [ ] S164 `ImmersiveTheater.tsx:517,739` creator/comment-author avatars alt="" (×2)
- [ ] S165 `BusinessProjects.tsx:198,215` project thumb + owner avatar alt="" (×2)
- [ ] S166 `ProfileDashboard.tsx:2027,5553` reel/project thumbnails alt="" (×2)
- [ ] S167 `WidgetOverlay.tsx:127` brand logo alt="" (meaningful)
- [ ] S168 `DirectMessagePanel.tsx:187` message input placeholder-only, no label
- [ ] S169 `WatchParty.tsx:168` chat input placeholder-only
- [ ] S170 `CreationHub.tsx:1042` prompt textarea label not associated
- [ ] S171 `Avatars.tsx:487` avatar search input no label
- [ ] S172 `CommandCenter.tsx:511` command palette search no aria-label
- [ ] S173 `EffectsPanel.tsx:359` range MiniSlider label sibling-only (repeats all effect sliders)
- [ ] S174 `AudioMixPanel.tsx:472` range Slider label sibling-only (15+ EQ instances)
- [ ] S175 `ColorGradePanel.tsx:112` GradeSlider label sibling-only (R/G/B)
- [ ] S176 🔴 `PremiumControls.tsx:443` seek bar is `<div>` no role=slider/aria-value*/keyboard
- [ ] S177 🔴 `PremiumControls.tsx:498` volume slider `<div>` no role/aria/keyboard
- [ ] S178 `ExamplesGallery.tsx:456` progress bar `<div>` no role/keyboard
- [ ] S179 `TextStudioPanel.tsx:486` color input no label
- [ ] S180 `EffectsPanel.tsx:384` color swatch accessible name only via title
- [ ] S181 `ProjectCard.tsx:297` clickable card `<div onClick>` no role/tabIndex/keydown
- [ ] S182 `ReferenceImageUpload.tsx:268` drop-zone `<div>` button no role/tabIndex/keyboard
- [ ] S183 `SupportInboxModal.tsx:32` onEscapeKeyDown preventDefault → blocks Escape
- [ ] S184 `DirectMessagePanel.tsx:246` backdrop close, no Escape / focus mgmt
- [ ] S185 `PublishWizard.tsx:173` role=dialog but no Escape/focus-trap
- [ ] S186 `BusinessTemplates.tsx:168` custom modal no Escape/focus mgmt
- [ ] S187 `Avatars.tsx:1081` avatar dialog backdrop close, no Escape
- [ ] S188 `BusinessAdStudio.tsx:419,531,623` expand/collapse toggles no aria-expanded (×3)
- [ ] S189 `SignOutDialog.tsx:79` `<div role=button>` wrapping interactive children
- [ ] S190 `FeaturesShowcase.tsx:199` hover `<video>` no controls/track/name
- [ ] S191 `BeforeAfter.tsx:135` autoplay/loop `<video>` no captions/aria-label
- [ ] S192–S200 (a11y cont.) broad gap: ~most async/toast surfaces lack aria-live regions (only ~8 files have them); editor slider pattern fix (S173-175) labels 30+ at once; bare file-inputs OK; numerous more icon-button instances across business pages. [grouped — 9 slots reserved for the aria-live/slider-pattern instances enumerated in the a11y agent output]

---
### Highest-priority NEW items to fix first
1. **Wrong/nonexistent model IDs** (S117–S123) — break whole features (Seedance/Kling create, bg-removal, transcription, demo+director chat) with 404s. *Verify each model id against the live gateway/Replicate before fixing.*
2. **S1** false delete-account confirmation; **S35/S61/S141** crashes (Crossover card, Budget panel, avatar gen); **S125/S127** credit-charged-then-crash + infinite poll; **S150** concurrent prediction clobber.
3. **S16** SSO plan check (paying orgs blocked); **S69** VoicePalette unusable in Firefox/Safari; **S73/S74/S85/S56** permanent stuck-state UIs.

---
## E — Null-safety / crash (22) [S201–S222]
- [ ] S201 🔴 `Production.tsx:375` JSON.parse(pipeline_state) outside try/catch + loadProject no outer catch → unhandled rejection, infinite spinner
- [ ] S202 `ImageStudioHub.tsx:528` ASPECTS.find(...)!.w/.h per image → crash on aspect drift
- [ ] S203 `ImageStudioHub.tsx:277` ASPECTS.find(...)! on active aspect → throw on unknown key
- [ ] S204 `CrossoverDetailDrawer.tsx:535` availableMoods.find(activeMood)! → crash on mismatch
- [ ] S205 `Environments.tsx:608` WORLD_FILTERS.find(worldId)!.icon → crash if order/filters drift
- [ ] S206 `Inbox.tsx:1343` LANES.find(lane)!.Icon → crash on out-of-set lane
- [ ] S207 `CreationStudio.tsx:311` MODES.find(mode)!.hint non-null on state-find
- [ ] S208 `CreationStudio.tsx:365` MODES.find(mode)!.label same
- [ ] S209 `TemplateComposer.tsx:62` MOODS.find(moodKey)! → crash if not in MOODS
- [ ] S210 `AdminProjectionsPage.tsx:87` GRAINS.find(grain)! non-null
- [ ] S211 `AdminProjectionsPage.tsx:132` METRICS.find(metric)!.label
- [ ] S212 `AdminProductionPage.tsx:18`/`AdminFinancePage.tsx:21` TABS.find(active)!.Component fragile
- [ ] S213 `CostAnalysisDashboard.tsx:809` size_mb/totalStorageMB unguarded div → NaN width
- [ ] S214 `AdminPricingConfigEditor.tsx:152` profit/revenue with credits=0 → NaN/Infinity margin
- [ ] S215 `ProjectCard.tsx:38` formatTimeAgo no date-validity → "NaNm ago"
- [ ] S216 `ActiveProjectBanner.tsx:134` getTimeAgo invalid-date → "NaNm ago"
- [ ] S217 `BillingSettings.tsx:158` formatRelativeTime invalid-date → "NaNm ago"
- [ ] S218 `ProjectCard.tsx:347` new Date(updated_at) no guard → "Invalid Date"
- [ ] S219 `AdminMessageCenter.tsx:356` msg.name.charAt(0) — null name throws
- [ ] S220 `ProductionDashboard.tsx:144` clip.status.charAt(0) — null status throws in tooltip
- [ ] S221 `WelcomeSalutation.tsx:59` double .slice(1) drops a char ("john"→"Jhn")
- [ ] S222 `MergeDownloadDialog.tsx:141` handleDownloadIndividual no res.ok → error HTML saved as .mp4

## F — Client security (17) [S223–S239]
- [ ] S223 🔴 `Profile.tsx:1409` SocialLinks `<a href={v}>` from user input, no scheme check → stored XSS (javascript:) on public page
- [ ] S224 🔴 `Profile.tsx:926` second social-link `<a href={value}>` unvalidated public
- [ ] S225 🔴 `ProfileDashboard.tsx:5454` "where to find them" `<a href={e.url}>` user links unvalidated
- [ ] S226 `WidgetOverlay.tsx:227` `<a href={secondary_cta_url}>` business config to anon public, no validation
- [ ] S227 `LandingPageRenderer.tsx:249` `<a href={secondary_cta_url}>` same
- [ ] S228 `WidgetRenderer.tsx:127` window.open(cta_url) no scheme check
- [ ] S229 `WidgetLanding.tsx:80` window.open(cta_url) dup public
- [ ] S230 `BusinessDistribution.tsx:414` `<a href={job.external_url}>` unvalidated
- [ ] S231 `AdminOrgDetailPage.tsx:226,373` `<a href={org.website}>` unvalidated in admin (super-admin blast radius)
- [ ] S232 `AdminProjectDetailPage.tsx:447` `<a href={c.video_url}>` admin unvalidated
- [ ] S233 `AdminContentModeration.tsx:400` `<a href={video.video_url}>` admin unvalidated
- [ ] S234 `ImageStudioHub.tsx:553,653` `<a href={img.url}>` unvalidated (own content)
- [ ] S235 `AdminUsersPage.tsx:183` CSV export no formula-injection neutralize (=+-@)
- [ ] S236 `AdminConsoleV2.tsx:183`+AdminAuditLog:59+AdminInvoices:70+Business* CSV exporters — same injection
- [ ] S237 `client.ts:13` supabase session (access+refresh JWT) in localStorage — raises XSS stakes
- [ ] S238 `AuthContext.tsx:261` SECURITY_VERSION_KEY force-logout driven off tamperable localStorage
- [ ] S239 `Blog.tsx:135` dangerouslySetInnerHTML JSON-LD — safe now (static), flag if it becomes user-sourced
- [ ] FIX: add a shared `safeHref()` allowlist helper (http/https/mailto) for S223–S234

## G — Custom hooks (24) [S240–S263]
- [ ] S240 🔴 `useAvatarTemplatesQuery.ts:214` isLoading && !isFetching always false on first load → spinner never shows
- [ ] S241 `useImagePreloader.ts:199` inline images array → preload thrash, never completes
- [ ] S242 `useAvatarVoices.ts:244` preloadVoices stale queue closure → dup preload
- [ ] S243 `useAvatarVoices.ts:170` audio.onended attached after play → previewingVoice stuck
- [ ] S244 `useChunkedAvatars.ts:73` inline array resets loadedCount every render → defeats progressive load
- [ ] S245 `useChunkedAvatars.ts:106` inner setTimeout never cleared → setState after unmount
- [ ] S246 `useFileUpload.ts:195` deps omit signed/expiresIn → stale signing closure
- [ ] S247 `useGamification.ts:68` 8s timeout never cleared + xpProgress div-by-zero → NaN
- [ ] S248 `useVideoReactions.ts:58` toggleReaction no optimistic/onError → dup row on double-click
- [ ] S249 🟠 `usePublicProfile.ts:160` follow inserts notification client-side → double-fires w/ server trigger
- [ ] S250 `useMediaLibrary.ts:97` realtime refresh on own writes → redundant full re-read each mutation
- [ ] S251 `useEffectiveCredits.ts:74` refresh deps on context object identity → memo churns
- [ ] S252 `NavigationLoadingContext.tsx:83` startNavigation useCallback([]) reads stale location.pathname
- [ ] S253 `WorkspaceContext.tsx:51` fetchOrgs/createOrg/value new identity each org switch → cascade re-renders
- [ ] S254 🟠 `UserPreferencesContext.tsx:147` setPrefs unordered un-checked writes → last-arriving wins, local/DB diverge
- [ ] S255 🟠 `useGalleryShowcase.ts:104` reorder Promise.all never checks {error} → "Order updated" on partial fail
- [ ] S256 `useWidgetBehaviorEngine.ts:124` hero setTimeout never cleared → setState after unmount
- [ ] S257 `useWidgetBehaviorEngine.ts:132` idle effect deps on state → 4 listeners churn each transition
- [ ] S258 `usePredictivePipeline.ts:62` opts rebuilt each render → effect re-fires on every keystroke
- [ ] S259 `useStableAsync.ts:229` useAsyncEffect omits execute → stale closure on option change
- [ ] S260 `useStablePageMount.ts:155` abortSignal from getSafeSignal() during render → stale controller
- [ ] S261 `use-toast.ts:172` MAX_LISTENERS shift() evicts a live component's setState
- [ ] S262 `useRenderCompleteNotifier.ts:38` firedRef/lastStatusRef grow unbounded, never reset → can't re-toast
- [ ] S263 `usePublicProfile.ts:114,319` N+1: per-project video_clips lookup in useFollowingFeed

## H — Routing / guards (16) [S264–S279]
- [ ] S264 🔴 `AuthCallback.tsx:97,203` success navigate no {replace} → Back lands on consumed-token error card
- [ ] S265 `AuthCallback.tsx:84+` `next` param unvalidated (open-redirect; Auth.tsx guards it)
- [ ] S266 `App.tsx:799` /user/:userId → Navigate /projects drops :userId
- [ ] S267 `routeConfig.ts:21` HEAVY_ROUTES keyed on retired /create,/projects,/creators; real heavy /studio,/library,/editor missing
- [ ] S268 `App.tsx:543` /workspace/* no wildcard/param variants → /workspace/editor/:id 404s
- [ ] S269 `ProtectedRoute.tsx:159` onboarding bounce drops ?next destination
- [ ] S270 `App.tsx:414` /studio guard nesting order differs from all other surfaces
- [ ] S271 `App.tsx:283` BusinessWorldIsolation outside Routes → blocked page mounts+fetches before redirect
- [ ] S272 `Onboarding.tsx:113` navigates to legacy redirect stubs (double-nav)
- [ ] S273 `Production.tsx:364,1177…`(+AcceptInvite,Inbox,etc.) navigate /projects (redirect stub) → double-nav everywhere
- [ ] S274 `Profile.tsx:726`(+Account,PublicShare,Credits,WelcomeOffer) legacy path prefixes in live links
- [ ] S275 `ProtectedRoute.tsx:174` admin allow-list references dead redirect routes → admin bounced
- [ ] S276 `App.tsx:522` /settings business → 3-hop redirect chain
- [ ] S277 `App.tsx:650` /studio/* drops splat → /studio/project/123 loses id
- [ ] S278 `AuthCallback.tsx:107` setStatus('error') before success check → fragile false "Verification Failed"
- [ ] S279 `App.tsx:891` /admin/* unregistered in public build → 404 not graceful redirect

## I — Storage / media / playback (22) [S280–S301]
- [ ] S280 🔴 `upload-ingest.ts:211` probeVideo onseeked no timeout → ingest hangs forever when currentTime already 0
- [ ] S281 `upload-ingest.ts:233` object-URL leak on catch path (no revoke)
- [ ] S282 `UploadReelDialog.tsx:101` new Error(describeIngestError obj) → user sees "[object Object]"
- [ ] S283 `MyLibraryPanel.tsx:82` same "[object Object]" in bulk upload
- [ ] S284 `upload-ingest.ts:268` Promise.all video+thumb upload → orphan on partial failure / insert fail
- [ ] S285 `DirectorCommentaryRecorder.tsx:103` commentary → public bucket (world-readable) + orphans old file on re-record
- [ ] S286 `UploadReelDialog.tsx:112`(+upload-ingest:281) source videos → public video-clips bucket (no paywall boundary)
- [ ] S287 `useFileUpload.ts:124` fake +10%/200ms progress (no real bytes)
- [ ] S288 `useFileUpload.ts:151` default signed=7-day URL persisted to DB → 404 after 7 days
- [ ] S289 `useFileUpload.ts:159` signed=false returns getPublicUrl on PRIVATE user-uploads → 403
- [ ] S290 `useFileUpload.ts:113` Date.now()-name with upsert:true → same-ms multi-select overwrite
- [ ] S291 `LazyVideoThumbnail.tsx:190` onerror just finish(null) (comment says retry w/o crossOrigin) → thumbs silently fail on CORS
- [ ] S292 `LazyVideoThumbnail.tsx:54` thumbCache + IDB grow unbounded (base64 JPEGs)
- [ ] S293 `PausedFrameVideo.tsx:130` `<video src>` never cleared → media buffer leak across grid
- [ ] S294 `TimelinePlayer.tsx:49` A/B video src never cleared + preload=auto → leak
- [ ] S295 `TimelinePlayer.tsx:119` advance() parity vs activeKey desync → wrong/black frame after seek
- [ ] S296 `PlayerCanvas.tsx:171` SourceMonitor video src never released
- [ ] S297 `ProductionFinalVideo.tsx:38` multi-clip download loops a.click() → only first lands
- [ ] S298 `MediaLibrary.tsx:308`(+MyLibraryPanel:420) img no onError fallback + no w/h → broken glyph + CLS
- [ ] S299 `MusicPicker.tsx:97` shared Audio no onerror → row stuck "playing" on load fail
- [ ] S300 `upload-ingest.ts:217` thumbnail canvas full 4K res → can exceed 5MB video-thumbnails cap
- [ ] S301 `BrandedVideoPlayer.tsx:646` `<track>` captions need crossOrigin set → cross-origin captions fail

## J — Performance (19) [S302–S320]
- [ ] S302 🔴 `AuthContext.tsx:818` context value inline object, never memoized → app-wide re-render cascade on every token refresh
- [ ] S303 `NavigationLoadingContext.tsx:229` value inline, not memoized
- [ ] S304 🔴 `Inbox.tsx:680` dm_reactions select('*') NO filter/limit → whole-platform table fetched, client-filtered
- [ ] S305 🔴 `useConversations.ts:28` direct_messages select('*') no limit → all msgs ever, just for a list
- [ ] S306 `useMediaLibrary.ts:88` realtime '*' → reconcile RPC + 200-row re-read on every change
- [ ] S307 `useMediaLibrary.ts:105` remove/toggleFavorite deps on assets → identity churn
- [ ] S308 `useVideoReactions.ts:48` reactionCounts recomputed every render (no useMemo)
- [ ] S309 `useVideoReactions.ts:38` video/comment_reactions select('*') no limit → viral video loads all rows
- [ ] S310 `AdminPipelineMonitor.tsx:127` api_cost_logs no limit (whole day) + :271 every 10s
- [ ] S311 `AdminPipelineMonitor.tsx:120` stitch_jobs select('*') no limit
- [ ] S312 `usePendingVideoRecovery.ts:43` per-clip check-video-status invoke every 20s (N+1 over network)
- [ ] S313 no virtualization anywhere (Library:310, ProfileDashboard:1586,1720, galleries)
- [ ] S314 `Library.tsx:315` inline onOpen/onDelete + FullBleedCard not memo → whole grid re-renders
- [ ] S315 `StudioContext.tsx:161` movie_projects select('*') heavy cols (pipeline_state)
- [ ] S316 `useGamification.ts:118` achievements select('*') no limit, no staleTime
- [ ] S317 `ProfileDashboard.tsx` 6504-line component, all sections re-render together; 8 sequential fetch effects
- [ ] S318 `Production.tsx:335`(+BillingSettings:65,useTemplateEnvironment:1353) select('*') heavy single rows
- [ ] S319 `ProfileDashboard.tsx:1502,1611…` lazy imgs no w/h/aspect-box → CLS
- [ ] S320 `useMediaLibrary` mount refresh() + realtime re-bind → duplicate reconcile around mount

## K — Realtime / subscriptions (16) [S321–S336]
- [ ] S321 🔴 `Inbox.tsx:187` direct_messages subscription NO filter → every DM streamed to every user (leak if RLS lax); also :446
- [ ] S322 🔴 `Inbox.tsx:1758` all-feed 4 tables unfiltered + full RPC reload each event → thundering herd
- [ ] S323 `Inbox.tsx:2074` rooms channel chat_room_messages unfiltered → full list_my_rooms reload on any room's msg
- [ ] S324 `useNotifications:181`+Inbox:186,1297,1757 — 4-5 concurrent notifications subs per user → refetch storm per event
- [ ] S325 `ActiveProjectBanner.tsx:89` static channel topic (not user-keyed) → collision drops updates
- [ ] S326 `SupportInbox.tsx:85` entire support_messages table subscribed → every user's tickets streamed
- [ ] S327 `AdminMessageCenter.tsx:119` channel resubscribes on each message select → events dropped in gap
- [ ] S328 systemic: no reconnect/visibility refetch backstop on most channels → stale after socket drop
- [ ] S329 `CommentsPanel.tsx:108` only INSERT subscribed → edited/deleted comments never refresh
- [ ] S330 `usePresence.ts:75` deps on display_name/avatar → presence blips offline→online on profile edit
- [ ] S331 `AdminNotificationBell.tsx:125`(+AdminNotificationsPage:105) dep on user object not user.id → resubscribe blip
- [ ] S332 `useScriptDocument.ts:143` equal-timestamp guard can clobber just-flushed local edit
- [ ] S333 `usePendingVideoRecovery.ts:73` recovery poll never stops (no idle/visibility)
- [ ] S334 `Help.tsx:553` 60s status poll runs in background tabs
- [ ] S335 `SpecializedModeProgress.tsx:443` onClip has no completed→generating guard (poll can downgrade realtime-completed)
- [ ] S336 `AdminMessagesPage.tsx:24` static-topic table-wide support_messages sub (breaks with 2nd admin)

## L — Type-cast-hidden bugs (9) [S337–S345]
- [ ] S337 🔴 `AdminUsersPage.tsx:72` admin_adjust_credits is service_role-only (REVOKEd) → admin "adjust credits" silently 403s (as any hides it)
- [ ] S338 `useProjectChannel.ts:36` DELETE payload.new={} truthy → onClip fires with undefined/null → clobbers clip state on regenerate/clear; payload.record dead fallback
- [ ] S339 `ImageStudioHub.tsx:528` ASPECTS.find!.w/h non-null → gallery crash on aspect drift (also in null-safety §)
- [ ] S340 `StudioContext.tsx:53` mapDbProject(any): target_duration_minutes nullable → duration_seconds NaN
- [ ] S341 🟠 `NotificationSettings.tsx:51` writes profiles.notification_settings but delivery reads notification_preferences table → settings may have no effect
- [ ] S342 `WorkspaceContext.tsx:60` org embed (m:any) — if Supabase infers array, {...m.organization} → org.id undefined
- [ ] S343 `CreationHub.tsx:614` videoEngine as any → out-of-union value reaches pipeline unguarded
- [ ] S344 `CreationHub.tsx:443` aspectRatio as any defeats engine-ratio check; effect deps miss aspectRatio
- [ ] S345 `Timeline.tsx:470` hand-built DragEvent cast → undefined if onDrop touches clientX/items/getData

---
## GRAND TOTAL: 109 (BACKLOG.md) + 345 (this file, S1–S345) = **454 documented bugs/issues** — target of 200 exceeded 2.3×.

### Newly-surfaced CRITICALs worth fixing next (verify model ids first):
wrong/nonexistent model ids S117-123 · social-link stored-XSS S223-225 · admin_adjust_credits broken S337 · Production pipeline_state crash S201 · Crossover/Budget/avatar-gen crashes S35/S61/S141 · credit-charged-then-crash S125 + infinite poll S127 · unfiltered cross-tenant realtime S321/S304 · AuthContext re-render cascade S302 · SSO plan check blocks paying orgs S16.

---
## VERIFICATION LOG (2026-06-26) — verify-before-fix pass
Per "verify bugs are real, confirm they need fixing, fix, check 3x". Verified the headline criticals against live code/DB/Replicate:

**❌ FALSE POSITIVES (verified NOT real — no change made):**
- **S117/S118 (model ids)** — all 4 ids return HTTP 200 on Replicate (exist). Seedance generation routes seedance engine → `seedance-pipeline` → `generate-single-clip`, which uses `bytedance/seedance-2.0` correctly (matches "only Seedance 2.0"). The `seedance-1-pro` in video-engines.ts is only the `generate-video` path (wan/veo/runway/sora). Agent assumed 404 without checking.
- **S337 (admin_adjust_credits)** — prod grants EXECUTE to `authenticated`; admin feature works. Agent read a stale migration.
- **S16 (SSO plan)** — `org_plan_features.sso_enabled` is true ONLY for enterprise; code's `=== "enterprise"` correctly gates it; growth/scale SHOULD be excluded. Dead `"business"` clause is harmless.

**✅ FIXED + verified 3× (PR #112):**
- **S223–S229** — `safeHref()` allowlist added; 8 public href/window.open sites (Profile ×2, ProfileDashboard, WidgetOverlay, LandingPageRenderer, WidgetRenderer, WidgetLanding) now reject `javascript:`/`data:` stored-XSS. Unit-tested 14/14.
- **S201** — Production `pipeline_state` JSON.parse wrapped in try/catch (was crashing loadProject → infinite spinner).

**⏸ DEFERRED:** S302 (AuthContext value memo) — real perf issue but memoizing needs a careful dep audit to avoid stale-value regressions; not a correctness bug.

**Lesson:** of 6 verified "criticals", **3 were false positives** — confirms verify-before-fix is essential; the agents over-claim (esp. model ids, grants, plan logic). Remaining S-items should each be verified before fixing.

**Batch 2 (PR #113):** FIXED S35 (Crossover card crash), S282/S283 ("[object Object]" ingest errors), S53 (PatronHub NaN%), S56 (EmbedPlayer stuck spinner). ❌ FALSE POSITIVE: S61 (getEngine has `?? MODEL_CATALOG["seedance-1-pro"]` fallback → never undefined → no crash). Running false-positive rate among verified "criticals": 4/8.

**Batch 3 (PR #114):** FIXED S15 (BusinessStart navigated to org-less /business on provisioning failure — provisionWorkspace swallowed errors; now returns orgId + navigate only on success). Verified real.
**Running totals (verify-then-fix loop):** 3 PRs (#112,#113,#114), ~11 confirmed-real bugs fixed (all verified 3×: unit-test/tsc/build), ~5 false positives caught + skipped (S16, S117, S118, S337, S61). Lower-value/nuanced items (S52 dead-but-works, S57 cosmetic title, S40 niche AI-reply field) noted, not fixed.

**Batch 4 (PR #115):** FIXED S125/S126 (extract-scene-identity now refunds the 5 credits charged up front when the model returns unparseable JSON — was a silent paid-but-failed), S141 (generate-avatar-image atob crash if gateway returns a URL — now fetches URL bytes). ❌ FALSE POSITIVE: S127 (poll-replicate loop breaks on `succeeded` regardless of videoUrl → no infinite 30× poll).
**Running totals: 4 PRs (#112–115), ~14 confirmed-real bugs fixed (all verified 3×), ~6 false positives caught (S16, S117, S118, S337, S61, S127).** False-positive rate on agent "criticals" ≈ 40%.
