# Genesis Director — Complete App Inventory

> Last updated: 2026-02-22
> This document catalogs every page, backend function, component, hook, database table, and integration in the Genesis Director application.

---

## Table of Contents

1. [Pages & Routes](#1-pages--routes)
2. [Backend Functions (Edge Functions)](#2-backend-functions-edge-functions)
3. [Shared Backend Utilities](#3-shared-backend-utilities)
4. [Frontend Components](#4-frontend-components)
5. [Custom Hooks](#5-custom-hooks)
6. [Database Tables](#6-database-tables)
7. [Third-Party Integrations](#7-third-party-integrations)
8. [Environment Variables](#8-environment-variables)
9. [Storage Buckets](#9-storage-buckets)
10. [Local Storage Keys](#10-local-storage-keys)

---

## 1. Pages & Routes

### Public Pages (No Auth Required)

| Route | Page File | Purpose |
|---|---|---|
| `/` | `Landing.tsx` | Homepage — immersive video hero, features showcase, pricing, social proof, FAQ, CTA |
| `/auth` | `Auth.tsx` | Login and signup with email+password and Google OAuth |
| `/auth/callback` | `AuthCallback.tsx` | OAuth redirect handler |
| `/forgot-password` | `ForgotPassword.tsx` | Password reset request form |
| `/reset-password` | `ResetPassword.tsx` | Password reset completion form |
| `/gallery` | `Gallery.tsx` | Public video gallery with fullscreen player, category navigation |
| `/pricing` | `Pricing.tsx` | Credit packages with Stripe checkout integration |
| `/creators` | `Creators.tsx` | Public creator directory and discovery |
| `/user/:userId` | `UserProfile.tsx` | Public user profile with videos, stats, social |
| `/video/:videoId` | `VideoDetail.tsx` | Video detail/playback page with comments and reactions |
| `/how-it-works` | `HowItWorks.tsx` | Platform explainer page |
| `/help` | `HelpCenter.tsx` | Help center / FAQ |
| `/blog` | `Blog.tsx` | Blog page |
| `/press` | `Press.tsx` | Press/media page |
| `/terms` | `Terms.tsx` | Terms of service |
| `/privacy` | `Privacy.tsx` | Privacy policy |
| `/contact` | `Contact.tsx` | Contact form |
| `/w/:slug` | `WidgetLanding.tsx` | Widget landing pages |
| `/widget/:publicKey` | `WidgetEmbed.tsx` | Embeddable widget view |
| `*` | `NotFound.tsx` | 404 Not Found |

### Authenticated Pages (Auth Required)

| Route | Page File | Purpose |
|---|---|---|
| `/onboarding` | `Onboarding.tsx` | New user setup wizard |
| `/projects` | `Projects.tsx` | User's project dashboard with filters, categories, thumbnails |
| `/create` | `Create.tsx` | Creation hub — mode selection, prompt input, script generation |
| `/script-review` | `ScriptReview.tsx` | Script review and editing before production |
| `/production` | `Production.tsx` | Production pipeline monitor (per project) |
| `/production/:projectId` | `Production.tsx` | Production pipeline for specific project |
| `/editor` | `VideoEditor.tsx` | Multi-track video editor with timeline |
| `/avatars` | `Avatars.tsx` | Avatar template browser with filters and preview |
| `/profile` | `Profile.tsx` | Own profile — stats, achievements, gamification |
| `/settings` | `Settings.tsx` | User settings — account, billing, notifications, security, preferences |
| `/chat` | `WorldChat.tsx` | Real-time world chat room |
| `/templates` | `Templates.tsx` | Template gallery |
| `/training-video` | `TrainingVideo.tsx` | Training content creation |
| `/environments` | `Environments.tsx` | Environment/location browser |

### Admin Pages (Admin Auth Required)

| Route | Page File | Purpose |
|---|---|---|
| `/admin/*` | `Admin.tsx` | Admin panel with sidebar navigation |

### Legacy Redirects

| Old Route | Redirects To |
|---|---|
| `/discover` | `/creators` |
| `/studio` | `/create` |
| `/clips` | `/editor` |
| `/universes/*` | `/projects` |
| `/long-video` | `/create` |
| `/pipeline/*` | `/create` |
| `/scenes` | `/create` |
| `/design-picker` | `/create` |
| `/social` | `/creators` |
| `/extract-thumbnails` | `/projects` |

---

## 2. Backend Functions (Edge Functions)

### 2.1 Core Video Pipeline

| Function | Purpose | Key Dependencies |
|---|---|---|
| `generate-script` | AI script generation from user prompt | OpenAI/Gemini |
| `generate-story` | Story/narrative generation | AI models |
| `smart-script-generator` | Enhanced smart script generation | AI models |
| `script-assistant` | Interactive script editing AI assistant | AI models |
| `mode-router` | Routes creation request to correct generation mode | — |
| `generate-video` | Main video clip generation | Replicate, Kling |
| `generate-single-clip` | Single clip generation (isolated) | Replicate, Kling |
| `generate-scene-images` | Scene image generation | Replicate |
| `hollywood-pipeline` | Full Hollywood-mode pipeline orchestration | Multiple AI services |
| `check-video-status` | Polls clip generation status | Replicate |
| `check-specialized-status` | Checks specialized mode generation status | Replicate |
| `simple-stitch` | Stitches individual clips into final video | FFmpeg/Replicate |
| `auto-stitch-trigger` | Auto-triggers stitching when all clips are ready | — |
| `render-video` | Renders/exports final video from editor | — |
| `final-assembly` | Genesis final assembly of clips | — |
| `continue-production` | Resumes halted production pipeline | — |
| `resume-pipeline` | Resumes pipeline from last checkpoint | — |
| `retry-failed-clip` | Retries generation of a single failed clip | Replicate, Kling |
| `cancel-project` | Cancels an active production project | — |
| `delete-project` | Permanently deletes project and associated assets | Storage |
| `delete-clip` | Deletes an individual clip | Storage |

### 2.2 Pipeline Operations & Monitoring

| Function | Purpose |
|---|---|
| `pipeline-watchdog` | Monitors pipeline health, detects stalls |
| `zombie-cleanup` | Cleans stuck/zombie pipeline jobs |
| `job-queue` | Background job queue processor |
| `production-audit` | Audits production pipeline integrity |
| `cleanup-stale-drafts` | Cleans abandoned draft projects |

### 2.3 Avatar & Character System

| Function | Purpose |
|---|---|
| `generate-avatar` | Generate a single avatar |
| `generate-avatar-direct` | Direct avatar generation (bypasses queue) |
| `generate-avatar-image` | Avatar image generation |
| `generate-avatar-scene` | Avatar placed in scene generation |
| `generate-single-avatar` | Single avatar variant generation |
| `generate-avatars-batch` | Batch avatar generation |
| `batch-avatar-generator` | Batch avatar generator v2 |
| `generate-avatar-batch` | Another batch generation variant |
| `seed-avatar-library` | Seeds the avatar template library |
| `seed-avatar-batch-v2` | Avatar batch seeder v2 |
| `regenerate-animated-avatars` | Regenerates animated avatar variants |
| `regenerate-stock-avatars` | Regenerates stock avatar images |
| `resume-avatar-pipeline` | Resumes interrupted avatar pipeline |
| `composite-character` | Composites character reference images |
| `generate-character-for-scene` | Generates character for specific scene context |
| `scene-character-analyzer` | Analyzes which characters appear in scenes |

### 2.4 Voice & Audio

| Function | Purpose | Provider |
|---|---|---|
| `generate-voice` | Text-to-speech voice generation | ElevenLabs |
| `editor-tts` | Editor text-to-speech panel | ElevenLabs |
| `editor-transcribe` | Audio transcription (speech-to-text) | AI models |
| `editor-generate-from-audio` | Generate video from uploaded audio | AI models |
| `elevenlabs-music` | AI music generation | ElevenLabs |
| `elevenlabs-sfx` | Sound effects generation | ElevenLabs |
| `generate-music` | Music track generation | AI models |
| `regenerate-audio` | Regenerate project voice audio | ElevenLabs |
| `scene-music-analyzer` | Analyzes and suggests music for scenes | AI models |
| `sync-music-to-scenes` | Syncs music timing to scene cuts | — |
| `fix-manifest-audio` | Fixes manifest audio config (utility) | — |

### 2.5 Image & Video Processing

| Function | Purpose | Provider |
|---|---|---|
| `extract-video-frame` | Extracts a frame from video | Replicate |
| `extract-first-frame` | Extracts first frame of a video | Replicate |
| `extract-last-frame` | Extracts last frame of a video | Replicate |
| `extract-video-thumbnails` | Batch thumbnail extraction for videos | External service |
| `extract-scene-identity` | Extracts scene identity/visual style | AI models |
| `analyze-reference-image` | Analyzes uploaded reference image | AI models |
| `generate-thumbnail` | Generates thumbnail for a project | AI models |
| `generate-project-thumbnail` | Project thumbnail generation | AI models |
| `generate-video-thumbnails` | Video thumbnail generation | — |
| `generate-missing-thumbnails` | Fills in missing thumbnails for existing videos | — |
| `generate-hls-playlist` | Generates HLS streaming playlist (.m3u8) | — |
| `generate-trailer` | Generates project trailer | AI models |
| `stylize-video` | Applies style transfer to video clip | Replicate |
| `motion-transfer` | Transfers motion between video clips | Replicate |
| `edit-photo` | AI photo editing | AI models |
| `generate-upload-url` | Generates signed upload URL for storage | Storage |

### 2.6 Validation & Quality Assurance

| Function | Purpose |
|---|---|
| `comprehensive-clip-validator` | Validates clip quality and integrity |
| `comprehensive-validation-orchestrator` | Orchestrates multi-step validation |
| `approve-clip-one` | Approves the first clip to start pipeline |
| `kling-v3-audit-test` | Kling v3 API audit/testing |
| `replicate-audit` | Replicate API audit/testing |
| `poll-replicate-prediction` | Polls Replicate prediction status |
| `replicate-webhook` | Replicate webhook handler for async results |

### 2.7 Auth, Billing & User Management

| Function | Purpose | Provider |
|---|---|---|
| `create-credit-checkout` | Creates Stripe checkout session | Stripe |
| `stripe-webhook` | Handles Stripe payment webhooks | Stripe |
| `gamification-event` | Processes XP awards and achievement events | — |
| `track-signup` | Tracks new user signups | — |
| `update-user-email` | Updates user email address | Auth |
| `delete-user-account` | Permanently deletes user account + data | Auth, Storage |
| `export-user-data` | GDPR data export for user | — |
| `admin-delete-auth-user` | Admin-level user deletion | Auth |
| `revoke-demo-sessions` | Revokes demo/trial sessions | — |

### 2.8 AI Agent & Widgets

| Function | Purpose |
|---|---|
| `agent-chat` | AI assistant chat (Hoppy agent) |
| `generate-widget-config` | Generates widget configuration |
| `get-widget-config` | Retrieves widget configuration |
| `log-widget-event` | Logs widget analytics events |

---

## 3. Shared Backend Utilities

Located in `supabase/functions/_shared/`:

| File | Purpose |
|---|---|
| `auth-guard.ts` | JWT authentication guard — validates bearer tokens, extracts user ID |
| `prompt-builder.ts` | Constructs AI prompts from scene/script data |
| `golden-prompt-reference-v1.ts` | Golden prompt style reference for consistent generation |
| `world-class-cinematography.ts` | Cinematography-focused prompt engineering guide |
| `GOLDEN_PROMPT_STYLE_GUIDE.md` | Documentation for prompt style standards |
| `content-safety.ts` | Content moderation and safety filtering |
| `rate-limiter.ts` | API rate limiting logic |
| `network-resilience.ts` | Retry logic, timeouts, exponential backoff |
| `pipeline-failsafes.ts` | Pipeline safety checks and recovery |
| `pipeline-guard-rails.ts` | Pipeline constraints and limits |
| `pipeline-notifications.ts` | Pipeline status notification dispatch |
| `anchor-failsafes.ts` | Continuity anchor safeguards |
| `batch-processor.ts` | Batch job processing utilities |
| `generation-mutex.ts` | Concurrency lock for generation jobs |
| `replicate-recovery.ts` | Replicate API failure recovery |
| `video-persistence.ts` | Video URL storage and persistence |
| `gcp-auth.ts` | Google Cloud Platform authentication |
| `script-utils.ts` | Script parsing and manipulation utilities |
| `avatar-screenplay-generator.ts` | Avatar-specific screenplay generation |

---

## 4. Frontend Components

### 4.1 Landing Page (15 components)

| Component | Purpose |
|---|---|
| `HeroSection` | Main hero with animated title and CTA |
| `HeroTitle` | Animated hero title typography |
| `AbstractBackground` | Animated background effects |
| `CinematicTransition` | Transition animations between sections |
| `FeaturesShowcase` | Feature cards/grid showcase |
| `PromptResultShowcase` | Before/after prompt demonstration |
| `ExamplesGallery` | Example video gallery |
| `HowItWorksSection` | Step-by-step explainer |
| `PricingSection` | Pricing tiers with immersive video |
| `AvatarCTASection` | Avatar feature call-to-action |
| `SocialProofTicker` | Social proof/testimonials ticker |
| `FAQSection` | Frequently asked questions |
| `FinalCTASection` | Final call-to-action section |
| `LandingNav` | Landing page navigation bar |
| `Footer` | Site footer |

### 4.2 Video Editor (27 components)

| Component | Purpose |
|---|---|
| `EditorTimeline` | Multi-track timeline with drag/drop |
| `EditorPreview` | Video preview player |
| `EditorToolbar` | Tool selection toolbar |
| `EditorSidebar` | Side panel with tools |
| `EditorMediaBrowser` | Media asset browser |
| `ExportDialog` | Export settings and progress dialog |
| `AudioUploadPanel` | Upload custom audio |
| `AudioWaveform` | Audio waveform visualization |
| `RealAudioWaveform` | Real-time audio waveform |
| `AudioFadePanel` | Audio fade in/out controls |
| `BeatSyncPanel` | Beat synchronization tool |
| `MusicLibraryPanel` | AI music generation library |
| `CaptionsPanel` | Caption/subtitle generation |
| `ChromaKeyPanel` | Green screen / chroma key tool |
| `ColorGradingPanel` | Color grading controls |
| `CropRotatePanel` | Crop and rotation tool |
| `FiltersPanel` | Video filter presets |
| `KeyframeEditor` | Keyframe animation editor |
| `PipPanel` | Picture-in-picture tool |
| `SpeedControlPanel` | Playback speed controls |
| `StickersPanel` | Sticker/overlay library |
| `TemplatesPanel` | Editor template presets |
| `TextAnimationPanel` | Text animation effects |
| `TextToVideoPanel` | Text-to-video generation in editor |
| `TrendingEffectsPanel` | Trending video effects |
| `useGaplessPlayback` | Gapless multi-clip playback hook |
| `types.ts` | Editor type definitions |

### 4.3 Studio / Creation Hub (23 components)

| Component | Purpose |
|---|---|
| `CreationHub` | Main creation mode selector |
| `CreationModeCard` | Individual creation mode card |
| `WorkspaceModeToggle` | Toggle between creation modes |
| `ScriptReviewPanel` | Script review and editing panel |
| `StoryApprovalPanel` | Story approval before generation |
| `StickyGenerateBar` | Sticky bottom generate action bar |
| `CostConfirmationDialog` | Credit cost confirmation before generation |
| `CreditsDisplay` | Current credit balance display |
| `LowCreditsWarningBanner` | Low credits warning |
| `AvatarTemplateSelector` | Avatar template picker in creation flow |
| `TemplateAvatarSelector` | Template-based avatar selector |
| `TemplatePreviewPanel` | Template preview before selection |
| `ReferenceImageUpload` | Reference image upload for consistency |
| `CharacterIdentityStatus` | Character identity lock status |
| `ConsistencyDashboard` | Visual consistency monitoring |
| `ConsistencyScoreCard` | Consistency score display |
| `SceneDNAPanel` | Scene DNA / identity panel |
| `AudioMixerPanel` | Audio mixing controls |
| `MSEVideoPlayer` | MediaSource Extensions video player |
| `ActiveProjectBanner` | Banner showing active project |
| `DegradationBanner` | Service degradation warning |
| `FailedClipsPanel` | Failed clips recovery panel |
| `HolographicBubblesProgress` | Holographic progress animation |

### 4.4 Production Monitor (8 components)

| Component | Purpose |
|---|---|
| `ProductionDashboard` | Main production overview |
| `ProductionFinalVideo` | Final video display and download |
| `ProductionSidebar` | Production status sidebar |
| `CinematicPipelineProgress` | Cinematic pipeline progress visualization |
| `CinematicWaveVisualizer` | Audio wave visualization during production |
| `SpecializedModeProgress` | Specialized mode progress tracker |
| `PipelineBackground` | Production page background |
| `PipelineErrorBanner` | Pipeline error alert banner |

### 4.5 Admin Panel (14 components)

| Component | Purpose |
|---|---|
| `AdminSidebar` | Admin navigation sidebar |
| `AdminProjectsBrowser` | Browse all user projects |
| `AdminPipelineMonitor` | Monitor all active pipelines |
| `AdminFailedClipsQueue` | Queue of failed clips for review |
| `AdminGalleryManager` | Manage gallery showcase videos |
| `AdminContentModeration` | Content moderation tools |
| `AdminMessageCenter` | Admin messaging to users |
| `AdminCreditPackagesManager` | Manage credit packages |
| `AdminPricingConfigEditor` | Edit pricing configuration |
| `AdminTierLimitsEditor` | Edit tier limits |
| `AdminSystemConfig` | System configuration panel |
| `AdminAvatarSeeder` | Avatar library seeder tool |
| `AdminAvatarBatchV2` | Avatar batch generation v2 |
| `CostAnalysisDashboard` | API cost analysis dashboard |

### 4.6 Social Features (8 components)

| Component | Purpose |
|---|---|
| `VideoCommentsSection` | Video comments with replies |
| `VideoReactionsBar` | Video reaction buttons (like, etc.) |
| `DirectMessagePanel` | Direct messaging panel |
| `MessagesInbox` | DM inbox list |
| `NotificationBell` | Notification bell with badge |
| `WorldChatButton` | World chat quick-access button |
| `UserStatsBar` | User statistics bar |

### 4.7 Gallery (7 components)

| Component | Purpose |
|---|---|
| `GalleryHeroSection` | Gallery page hero |
| `PremiumVideoCard` | Video card with hover preview |
| `PremiumCategoryNav` | Category navigation tabs |
| `PremiumCarouselControls` | Carousel prev/next controls |
| `PremiumFullscreenPlayer` | Fullscreen video player |
| `PremiumGalleryBackground` | Gallery page background |
| `FamousAvatarsShowcase` | Featured avatars showcase |

### 4.8 Avatar Browser (11 components)

| Component | Purpose |
|---|---|
| `AvatarsHero` | Avatars page hero section |
| `AvatarsCategoryTabs` | Category tab navigation |
| `AvatarsFilters` | Filter controls (gender, style, etc.) |
| `AvatarsConfigPanel` | Avatar configuration panel |
| `AvatarPreviewModal` | Full avatar preview modal |
| `Avatar3DViewer` | 3D avatar viewer |
| `PremiumAvatarGallery` | Premium avatar gallery grid |
| `VirtualAvatarGallery` | Virtualized avatar gallery (performance) |
| `OptimizedAvatarImage` | Optimized avatar image with lazy loading |
| `AvatarsBackground` | Avatars page background |

### 4.9 Video Players (5 components)

| Component | Purpose |
|---|---|
| `UniversalVideoPlayer` | Primary video player with format detection |
| `UniversalHLSPlayer` | HLS streaming player with fallback |
| `HLSNativePlayer` | Native HLS player |
| `SimpleVideoPlayer` | Simple MP4 video player |

### 4.10 Auth Components (3)

| Component | Purpose |
|---|---|
| `ProtectedRoute` | Route guard requiring authentication |
| `SignOutDialog` | Sign out confirmation dialog |
| `WelcomeBackDialog` | Welcome back dialog for returning users |

### 4.11 AI Agent (5 components)

| Component | Purpose |
|---|---|
| `AgentPanel` | AI assistant chat panel |
| `AgentTrigger` | Floating trigger button for agent |
| `AgentFace` | Animated agent face/avatar |
| `CommandPalette` | Command palette (⌘K) |
| `HoppyRichBlocks` | Rich content blocks in agent responses |

### 4.12 Photo Editor (4 components)

| Component | Purpose |
|---|---|
| `PhotoEditorHub` | Photo editor main hub |
| `PhotoEditCanvas` | Photo editing canvas |
| `PhotoBulkPanel` | Bulk photo operations |
| `PhotoTemplateGrid` | Photo template selection grid |

### 4.13 Widget System (6 components)

| Component | Purpose |
|---|---|
| `ScenesHub` | Widget scenes management hub |
| `WidgetBuilderForm` | Widget configuration builder |
| `WidgetRenderer` | Widget display renderer |
| `WidgetOverlay` | Widget overlay layer |
| `WidgetAnalytics` | Widget analytics dashboard |
| `AIWidgetAssist` | AI-assisted widget creation |
| `LandingPageRenderer` | Landing page widget renderer |

### 4.14 Projects Dashboard (6 components)

| Component | Purpose |
|---|---|
| `ProjectCard` | Individual project card |
| `ProjectFilters` | Project filter controls |
| `ProjectsCategoryTabs` | Project category tabs |
| `ProjectsHero` | Projects page hero |
| `ProjectsBackground` | Projects page background |
| `MergeDownloadDialog` | Multi-clip merge and download dialog |

### 4.15 Profile & Gamification (5 components)

| Component | Purpose |
|---|---|
| `GamificationStatsCard` | XP, level, streak stats |
| `AchievementsPreviewCard` | Achievement badges preview |
| `DailyChallengesCard` | Daily challenge progress |
| `QuickStatsCard` | Quick stats summary |
| `ProfileBackground` | Profile page background |

### 4.16 Settings (5 components)

| Component | Purpose |
|---|---|
| `AccountSettings` | Account management (email, delete, export) |
| `BillingSettings` | Billing and credit history |
| `NotificationSettings` | Notification preferences |
| `PreferencesSettings` | App preferences |
| `SecuritySettings` | Security settings (password, sessions) |

### 4.17 Credits (1 component)

| Component | Purpose |
|---|---|
| `BuyCreditsModal` | Credit purchase modal with Stripe |

### 4.18 Welcome (2 components)

| Component | Purpose |
|---|---|
| `WelcomeOfferModal` | Welcome offer/promotion modal |
| `WelcomeVideoModal` | Welcome video tutorial modal |

### 4.19 Diagnostics (5 components)

| Component | Purpose |
|---|---|
| `HealthCheckDashboard` | System health check dashboard |
| `DebugOverlay` | Debug information overlay |
| `AdminOnlyDiagnostics` | Admin-only diagnostic tools |
| `DiagnosticsSettings` | Diagnostics configuration |
| `CrashForensicsOverlay` | Crash forensics analysis overlay |

### 4.20 Stability & Safe Mode (5 components)

| Component | Purpose |
|---|---|
| `GlobalStabilityBoundary` | Top-level error boundary |
| `StabilityBoundary` | Component-level error boundary |
| `SafeComponent` | Safe-render wrapper |
| `SafeModeBanner` | Safe mode notification banner |
| `SafeModeVideoPlaceholder` | Video placeholder in safe mode |

### 4.21 Navigation & Layout (4 components)

| Component | Purpose |
|---|---|
| `AppHeader` | Main app header/navbar |
| `RouteContainer` | Page layout container |
| `NavigationLink` | Navigation link component |
| `GlobalLoadingOverlay` | Global page loading overlay |
| `NavLink` | Nav link component |

### 4.22 Other Components

| Component | Location | Purpose |
|---|---|---|
| `SafeMarkdownRenderer` | `content/` | Sanitized markdown rendering |
| `ClipsBackground` | `clips/` | Clips page background |
| `CreatorsHero` | `creators/` | Creators page hero |
| `CreatorsBackground` | `creators/` | Creators page background |
| `TemplatesBackground` | `templates/` | Templates page background |
| `TrainingBackground` | `training/` | Training page background |
| `RealAnalyticsCards` | `analytics/` | Real analytics display cards |

---

## 5. Custom Hooks (43 hooks)

### Auth & Security

| Hook | Purpose |
|---|---|
| `useAdminAccess` | Checks if current user has admin role |
| `useSecurityGuard` | Manages security version stamps, forces re-auth |
| `useGatekeeperLoading` | Auth gatekeeper loading state |

### Data Fetching & State

| Hook | Purpose |
|---|---|
| `useAvatarTemplatesQuery` | Fetches avatar templates with caching |
| `useAvatarVoices` | Fetches available avatar voices |
| `useChunkedAvatars` | Paginated/chunked avatar loading |
| `useGalleryShowcase` | Fetches gallery showcase data |
| `usePaginatedProjects` | Paginated project list with filters |
| `useProjectThumbnails` | Loads project thumbnails |
| `usePublicProfile` | Fetches public user profile data |
| `useTemplateEnvironment` | Fetches template environment data |

### Social & Communication

| Hook | Purpose |
|---|---|
| `useChat` | Chat messaging logic |
| `useConversations` | DM conversation management |
| `useNotifications` | Notification system |
| `useSocial` | Follow/unfollow, likes, social actions |
| `useVideoReactions` | Video reaction handling |
| `useWorldChat` | Real-time world chat |
| `useSmartMessages` | Smart message formatting |

### Production & Pipeline

| Hook | Purpose |
|---|---|
| `useClipRecovery` | Failed clip recovery logic |
| `usePredictivePipeline` | Pipeline progress prediction |
| `useRetryStitch` | Retry video stitching |
| `useZombieWatcher` | Detects zombie/stuck pipelines |

### Editor

| Hook | Purpose |
|---|---|
| `useEditorHistory` | Undo/redo history stack |
| `useMultiTrackAudio` | Multi-track audio management |
| `useMSEPlayback` | MediaSource Extensions playback |
| `useFileUpload` | File upload handling |

### Billing & Gamification

| Hook | Purpose |
|---|---|
| `useCreditBilling` | Credit purchase flow |
| `useGamification` | XP, achievements, streaks |
| `useTierLimits` | Usage tier limit checks |

### UI & UX

| Hook | Purpose |
|---|---|
| `use-mobile` | Mobile viewport detection |
| `use-toast` | Toast notification system |
| `useImagePreloader` | Preloads images for smooth UX |
| `usePageMeta` | Dynamic SEO meta tags |
| `useScrollReveal` | Scroll-triggered reveal animations |
| `useVirtualScroll` | Virtual scrolling for large lists |
| `useOptimistic` | Optimistic UI updates |

### System & Diagnostics

| Hook | Purpose |
|---|---|
| `useRealAnalytics` | Analytics event tracking |
| `useSelfDiagnostic` | Self-diagnostic health checks |
| `useStableAsync` | Stable async operation wrapper |
| `useStablePageMount` | Stable page mounting guard |

### Agent & Widget

| Hook | Purpose |
|---|---|
| `useAgentChat` | AI agent chat interaction logic |
| `useWidgetBehaviorEngine` | Widget behavior/interaction engine |

---

## 6. Database Tables (40+)

### Core Application

| Table | Purpose |
|---|---|
| `profiles` | User profiles (display name, avatar, bio, credits) |
| `movie_projects` | Video projects (script, status, pipeline state, video URLs) |
| `edit_sessions` | Editor sessions (timeline data, render state) |
| `gallery_showcase` | Curated gallery videos |

### Avatar & Character System

| Table | Purpose |
|---|---|
| `avatar_templates` | Pre-built avatar templates |
| `characters` | User-created characters |
| `character_voice_assignments` | Character-to-voice mappings |
| `character_loans` | Character lending between users |

### Social & Communication

| Table | Purpose |
|---|---|
| `conversations` | Chat conversations |
| `conversation_members` | Conversation membership |
| `chat_messages` | Chat messages |
| `chat_message_reactions` | Chat message reactions |
| `direct_messages` | Direct messages between users |
| `project_comments` | Video/project comments |
| `comment_likes` | Comment likes |
| `comment_reactions` | Comment emoji reactions |

### Billing & Credits

| Table | Purpose |
|---|---|
| `credit_packages` | Available credit packages |
| `credit_transactions` | Credit transaction history (immutable) |
| `api_cost_logs` | API cost tracking per operation |

### Gamification

| Table | Purpose |
|---|---|
| `achievements` | Achievement definitions |
| `daily_challenges` | Daily challenge definitions |

### Genesis Worldbuilding Engine

| Table | Purpose |
|---|---|
| `genesis_eras` | Historical eras in the universe |
| `genesis_locations` | World locations/places |
| `genesis_location_requests` | User-requested locations |
| `genesis_lore` | Lore entries (canon/community) |
| `genesis_environment_templates` | Environment visual templates |
| `genesis_continuity_anchors` | Continuity anchor points |
| `genesis_preset_characters` | Preset screenplay characters |
| `genesis_character_castings` | Character casting submissions |
| `genesis_character_appearances` | Character appearances in videos |
| `genesis_character_interactions` | Character interaction records |
| `genesis_scene_characters` | Characters assigned to scenes |
| `genesis_scene_clips` | Scene clip submissions |
| `genesis_screenplay` | Full screenplays |
| `genesis_final_assembly` | Final assembly records |
| `genesis_videos` | Genesis universe videos |

### AI Agent

| Table | Purpose |
|---|---|
| `agent_conversations` | Agent chat conversations |
| `agent_messages` | Agent chat messages |
| `agent_preferences` | User agent preferences |
| `agent_query_analytics` | Agent usage analytics |

### Admin & Security

| Table | Purpose |
|---|---|
| `admin_audit_log` | Admin action audit trail |
| `banned_accounts` | Banned user accounts |
| `user_roles` | User role assignments |

### Views (Read-only)

| View | Purpose |
|---|---|
| `movie_projects_public` | Public-safe project data |
| `profiles_public` | Public-safe profile data |

---

## 7. Third-Party Integrations

| Service | Purpose | Credential |
|---|---|---|
| **Stripe** | Credit purchases, checkout, webhooks | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Replicate** | Video generation, frame extraction, style transfer | `REPLICATE_API_KEY` |
| **ElevenLabs** | TTS voices, music generation, sound effects | `ELEVENLABS_API_KEY` |
| **Kling** | Video generation (alternative provider) | `KLING_ACCESS_KEY`, `KLING_SECRET_KEY` |
| **Google Cloud** | AI models (Gemini), authentication | `GCP_SERVICE_ACCOUNT_KEY` |
| **OpenAI** | Script generation, AI assistant | `OPENAI_API_KEY` |
| **Google OAuth** | Social sign-in | Configured in Auth |

---

## 8. Environment Variables

### Frontend (Vite)

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Backend API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Backend public/anon key |
| `VITE_SUPABASE_PROJECT_ID` | Backend project identifier |
| `VITE_DIAGNOSTICS_MODE` | Enable diagnostics overlay (optional) |

### Backend (Edge Function Secrets)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Backend URL (auto-injected) |
| `SUPABASE_ANON_KEY` | Anon key (auto-injected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (auto-injected) |
| `REPLICATE_API_KEY` | Replicate API |
| `ELEVENLABS_API_KEY` | ElevenLabs API |
| `OPENAI_API_KEY` | OpenAI API |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `KLING_ACCESS_KEY` | Kling video API |
| `KLING_SECRET_KEY` | Kling video API |
| `GCP_SERVICE_ACCOUNT_KEY` | Google Cloud Platform |

---

## 9. Storage Buckets

| Bucket | Purpose |
|---|---|
| `video-clips` | Individual generated video clips |
| `final-videos` | Stitched final videos |
| `temp-frames` | Temporary frame extractions and manifests |
| `video-thumbnails` | Video thumbnail images |
| `avatars` | Avatar images |
| `chat-media` | Chat media attachments |
| `reference-images` | User-uploaded reference images |

---

## 10. Local Storage Keys

| Key | Purpose |
|---|---|
| `app_security_version` | Session security stamp (forces re-auth on admin actions) |
| `genesis_create_draft` | Draft creation state persistence |
| `login_lockout_{email}` | Login rate limiting (10 attempts / 15 min) |
| `safe_mode_auto_enabled` | (sessionStorage) Crash loop safe mode flag |

---

## Summary Totals

| Category | Count |
|---|---|
| Pages / Routes | 34 |
| Legacy Redirects | 10 |
| Edge Functions | 91 |
| Shared Backend Utilities | 19 |
| Frontend Components | ~155 |
| Custom Hooks | 43 |
| Database Tables | 40+ |
| Database Views | 2 |
| Third-Party Integrations | 6 |
| Frontend Env Variables | 4 |
| Backend Secrets | 10+ |
| Storage Buckets | 7+ |
| Local Storage Keys | 4 |
