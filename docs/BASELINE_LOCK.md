# BASELINE LOCK — Genesis Director

> Last updated: 2026-02-22
> This document captures the "working state" baseline. Any change MUST preserve everything listed here.

---

## Core Routes (Must Always Load Without Errors)

| Route | Auth Required | Purpose |
|---|---|---|
| `/` | No | Landing page with immersive video, hero, pricing stats |
| `/auth` | No | Login/signup with email+password and Google OAuth |
| `/auth/callback` | No | OAuth redirect handler |
| `/forgot-password` | No | Password reset request |
| `/reset-password` | No | Password reset form |
| `/onboarding` | Yes | New user setup wizard |
| `/projects` | Yes | User's project dashboard |
| `/create` | Yes | Creation hub (mode selection, script gen) |
| `/script-review` | Yes | Script review/editing |
| `/production` `/production/:projectId` | Yes | Production pipeline monitor |
| `/editor` | Yes | Video editor with timeline |
| `/avatars` | Yes | Avatar template browser |
| `/gallery` | No | Public video gallery |
| `/pricing` | No | Credit packages |
| `/creators` | No | Creator directory |
| `/user/:userId` | No | Public user profile |
| `/video/:videoId` | No | Video detail/playback |
| `/profile` | Yes | Own profile view/edit |
| `/settings` | Yes | User settings |
| `/chat` | Yes | Real-time world chat |
| `/templates` | Yes | Template gallery |
| `/training-video` | Yes | Training content creation |
| `/environments` | Yes | Environment browser |
| `/help` `/blog` `/press` `/terms` `/privacy` `/contact` | No | Static/info pages |
| `/how-it-works` | No | Explainer page |
| `/admin/*` | Yes (admin) | Admin panel (Refine) |
| `/w/:slug` `/widget/:publicKey` | No | Widget pages |
| `*` | No | 404 Not Found |

## Legacy Redirects (Must Not Break)

- `/discover` → `/creators`
- `/studio` → `/create`
- `/clips` → `/editor`
- `/universes/*` → `/projects`
- `/long-video` `/pipeline/*` `/scenes` `/design-picker` → `/create`
- `/social` → `/creators`
- `/extract-thumbnails` → `/projects`

## Critical Flows (Do Not Break List)

1. **Auth Flow**: Sign up → email verification → sign in → profile fetch → redirect
2. **Creation Flow**: `/create` → mode select → prompt → script gen → `/script-review` → approve → `/production/:id`
3. **Production Pipeline**: Clips generate → poll status → stitch → video_url populated → playback
4. **Editor Export**: Open editor → add clips → export → multi-clip MP4 merge (mp4box.js) → download
5. **Credit Purchase**: Select package → Stripe checkout → credits added to balance
6. **Gallery**: Public videos load with thumbnails, playable
7. **Social**: Follow/unfollow, comments, likes, DMs

## Environment Variables (Required)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_DIAGNOSTICS_MODE` (optional)

## Storage Keys (Do Not Remove)

- `app_security_version` — session security stamp
- `genesis_create_draft` — draft persistence
- `login_lockout_{email}` — rate limiting
- `safe_mode_auto_enabled` (sessionStorage) — crash loop protection

## Database Invariants

- Admin role locked to UUID `d600868d-651a-46f6-a621-a727b240ac7c` via trigger
- All tables have RLS enabled
- `pipeline_stage` rejects 'pending' and 'cancelled' values
- `movie_projects.status` is the authority for lifecycle state
- Credit transactions are immutable (append-only)

## Security Invariants

- Edge functions use `_shared/auth-guard.ts` with JWT validation
- Admin authorization checks `user_roles` table (not profile metadata)
- Login rate-limited to 10 attempts per 15 minutes
- Security version stamps force re-auth on admin action
- Error logs sanitized to prevent info leakage

## Provider Nesting Order (App.tsx)

```
GlobalStabilityBoundary
  → ErrorBoundary
    → QueryClientProvider
      → TooltipProvider
        → BrowserRouter
          → NavigationLoadingProvider
            → NavigationGuardProvider
              → NavigationBridge
                → AuthProvider
                  → StudioProvider
                    → Routes
```

Do NOT reorder these providers.
