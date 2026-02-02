# PROCESS CATALOG

Complete inventory of all processes in the application. Each process represents a testable user flow, API operation, or state transition.

## Summary
- **Total Processes**: 78
- **UI Flows**: 32
- **API/Edge Functions**: 42
- **Background Jobs**: 4

---

## UI FLOWS (32 Processes)

| ID | Name | Type | Entry Point | Preconditions | Risk |
|----|------|------|-------------|---------------|------|
| P001 | Landing Page Load | UI Flow | `/` | None | P2 |
| P002 | User Sign Up | Auth | `/auth` | None | P0 |
| P003 | User Sign In | Auth | `/auth` | Existing account | P0 |
| P004 | Password Reset Request | Auth | `/forgot-password` | Existing account | P1 |
| P005 | Password Reset Complete | Auth | `/reset-password` | Valid token | P1 |
| P006 | User Onboarding | UI Flow | `/onboarding` | Authenticated, !onboarding_completed | P1 |
| P007 | Project List View | UI Flow | `/projects` | Authenticated | P0 |
| P008 | Create New Project | UI Flow | `/create` | Authenticated, credits > 0 | P0 |
| P009 | Text-to-Video Creation | UI Flow | `/create` | Authenticated, prompt | P0 |
| P010 | Avatar Video Creation | UI Flow | `/avatars` | Authenticated, avatar selected | P0 |
| P011 | Production Monitor | UI Flow | `/production/:id` | Valid project ID | P0 |
| P012 | Script Review | UI Flow | `/script-review` | Project in awaiting_approval | P1 |
| P013 | Clips Gallery View | UI Flow | `/clips` | Authenticated | P2 |
| P014 | Universe List | UI Flow | `/universes` | Authenticated | P1 |
| P015 | Universe Detail | UI Flow | `/universes/:id` | Valid universe ID | P1 |
| P016 | User Profile View | UI Flow | `/profile` | Authenticated | P1 |
| P017 | User Settings | UI Flow | `/settings` | Authenticated | P1 |
| P018 | Credit Purchase | Payment | `/settings?tab=billing` | Authenticated | P0 |
| P019 | Admin Dashboard | UI Flow | `/admin` | Admin role | P0 |
| P020 | Template Gallery | UI Flow | `/templates` | Authenticated | P2 |
| P021 | Environment Selection | UI Flow | `/environments` | Authenticated | P2 |
| P022 | Discover Feed | UI Flow | `/discover` | Authenticated | P2 |
| P023 | Gallery Showcase | UI Flow | `/gallery` | None | P2 |
| P024 | Help Center | UI Flow | `/help` | None | P2 |
| P025 | Pricing Page | UI Flow | `/pricing` | None | P2 |
| P026 | Terms Page | UI Flow | `/terms` | None | P2 |
| P027 | Privacy Page | UI Flow | `/privacy` | None | P2 |
| P028 | Contact Page | UI Flow | `/contact` | None | P2 |
| P029 | Blog Page | UI Flow | `/blog` | None | P2 |
| P030 | Press Page | UI Flow | `/press` | None | P2 |
| P031 | Training Video Mode | UI Flow | `/training-video` | Authenticated | P2 |
| P032 | Sign Out | Auth | Any page | Authenticated | P1 |

---

## API/EDGE FUNCTIONS (42 Processes)

| ID | Name | Type | Entry Point | Preconditions | Risk |
|----|------|------|-------------|---------------|------|
| P033 | Mode Router | API | `mode-router` | Auth, valid mode | P0 |
| P034 | Generate Script | API | `generate-script` | Auth, prompt | P0 |
| P035 | Generate Video | API | `generate-video` | Auth, script | P0 |
| P036 | Generate Single Clip | API | `generate-single-clip` | Auth, shot data | P0 |
| P037 | Generate Voice | API | `generate-voice` | Auth, text | P1 |
| P038 | Generate Music | API | `generate-music` | Auth, mood | P1 |
| P039 | Generate Avatar | API | `generate-avatar` | Auth, config | P0 |
| P040 | Generate Avatar Direct | API | `generate-avatar-direct` | Auth, avatar ID | P0 |
| P041 | Generate Avatar Batch | API | `generate-avatar-batch` | Auth, batch config | P1 |
| P042 | Generate Avatar Image | API | `generate-avatar-image` | Auth, face URL | P1 |
| P043 | Generate Avatar Scene | API | `generate-avatar-scene` | Auth, scene data | P1 |
| P044 | Simple Stitch | API | `simple-stitch` | Auth, clip URLs | P0 |
| P045 | Check Video Status | API | `check-video-status` | Auth, prediction ID | P0 |
| P046 | Check Specialized Status | API | `check-specialized-status` | Auth, project ID | P1 |
| P047 | Retry Failed Clip | API | `retry-failed-clip` | Auth, clip ID | P1 |
| P048 | Resume Pipeline | API | `resume-pipeline` | Auth, project ID | P1 |
| P049 | Resume Avatar Pipeline | API | `resume-avatar-pipeline` | Auth, project ID | P1 |
| P050 | Cancel Project | API | `cancel-project` | Auth, project ID | P1 |
| P051 | Continue Production | API | `continue-production` | Auth, project ID | P1 |
| P052 | Hollywood Pipeline | API | `hollywood-pipeline` | Auth, config | P1 |
| P053 | Stripe Webhook | Webhook | `stripe-webhook` | Valid signature | P0 |
| P054 | Create Credit Checkout | API | `create-credit-checkout` | Auth, package ID | P0 |
| P055 | Gamification Event | API | `gamification-event` | Auth, event type | P2 |
| P056 | Export User Data | API | `export-user-data` | Auth | P1 |
| P057 | Delete User Account | API | `delete-user-account` | Auth | P0 |
| P058 | Update User Email | API | `update-user-email` | Auth | P1 |
| P059 | Extract Video Frame | API | `extract-video-frame` | video URL | P2 |
| P060 | Extract First Frame | API | `extract-first-frame` | video URL | P2 |
| P061 | Extract Last Frame | API | `extract-last-frame` | video URL | P2 |
| P062 | Generate Thumbnail | API | `generate-thumbnail` | video URL | P2 |
| P063 | Generate Project Thumbnail | API | `generate-project-thumbnail` | project ID | P2 |
| P064 | Generate Upload URL | API | `generate-upload-url` | Auth, project ID | P1 |
| P065 | Analyze Reference Image | API | `analyze-reference-image` | image URL | P2 |
| P066 | Motion Transfer | API | `motion-transfer` | source/target URLs | P1 |
| P067 | Stylize Video | API | `stylize-video` | video URL, style | P1 |
| P068 | Script Assistant | API | `script-assistant` | Auth, context | P2 |
| P069 | Smart Script Generator | API | `smart-script-generator` | Auth, params | P1 |
| P070 | Composite Character | API | `composite-character` | images | P2 |
| P071 | Generate Story | API | `generate-story` | Auth, prompt | P1 |
| P072 | Generate Trailer | API | `generate-trailer` | Auth, project | P2 |
| P073 | Seed Avatar Library | API | `seed-avatar-library` | Admin | P2 |
| P074 | Regenerate Stock Avatars | API | `regenerate-stock-avatars` | Admin | P2 |

---

## BACKGROUND JOBS (4 Processes)

| ID | Name | Type | Entry Point | Preconditions | Risk |
|----|------|------|-------------|---------------|------|
| P075 | Auto Stitch Trigger | Background | `auto-stitch-trigger` | All clips complete | P1 |
| P076 | Pipeline Watchdog | Background | `pipeline-watchdog` | Active pipelines | P1 |
| P077 | Zombie Cleanup | Background | `zombie-cleanup` | Stale processes | P2 |
| P078 | Job Queue Processor | Background | `job-queue` | Queued jobs | P1 |

---

## TRACE MAP

### P002 - User Sign Up
```
src/pages/Auth.tsx
  └── src/contexts/AuthContext.tsx (signUp)
      └── supabase.auth.signUp()
          └── DB: profiles (trigger creates profile)
```

### P008 - Create New Project
```
src/pages/Create.tsx
  └── src/components/studio/CreationHub.tsx
      └── supabase.functions.invoke('mode-router')
          └── supabase/functions/mode-router/index.ts
              └── DB: movie_projects (INSERT)
              └── DB: video_clips (INSERT)
```

### P011 - Production Monitor
```
src/pages/Production.tsx
  └── src/hooks/useClipRecovery.ts
  └── DB: movie_projects (SELECT, realtime)
  └── DB: video_clips (SELECT, realtime)
```

### P018 - Credit Purchase
```
src/pages/Settings.tsx
  └── src/components/settings/BillingSection.tsx
      └── supabase.functions.invoke('create-credit-checkout')
          └── Stripe API → stripe-webhook
              └── DB: profiles (UPDATE credits)
              └── DB: credit_transactions (INSERT)
```
