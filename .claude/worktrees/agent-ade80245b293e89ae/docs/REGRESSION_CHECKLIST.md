# REGRESSION CHECKLIST — Genesis Director

> Run this checklist after every code change. Mark PASS/FAIL for each item.

---

## P0 — App Must Not Crash

- [ ] Landing page (`/`) loads without console errors
- [ ] Immersive video plays fullscreen without boundaries
- [ ] Auth page (`/auth`) renders login/signup form
- [ ] Protected route (`/projects`) redirects to `/auth` when not logged in
- [ ] 404 page renders for unknown routes

## P0 — Auth Flow

- [ ] Email/password signup submits without error
- [ ] Email/password login redirects to `/projects` (or `/onboarding` for new users)
- [ ] Google OAuth initiates redirect
- [ ] Sign out clears session and redirects to `/`
- [ ] Rate limiting blocks after 10 failed attempts

## P1 — Creation Pipeline

- [ ] `/create` page loads with mode selection
- [ ] Mode selection (text-to-video) enables prompt input
- [ ] Script generation triggers edge function and shows result
- [ ] `/script-review` displays generated script
- [ ] Script approval navigates to `/production`

## P1 — Production Pipeline

- [ ] Production page shows clip generation progress
- [ ] Completed clips display thumbnails
- [ ] Stitch triggers when all clips complete
- [ ] Final video URL is populated on `movie_projects`
- [ ] Video plays back in player

## P1 — Video Editor

- [ ] Editor loads and restores last session
- [ ] Clips can be added to timeline
- [ ] Single-clip export downloads MP4
- [ ] Multi-clip export downloads as ZIP
- [ ] Ctrl+S saves session
- [ ] Back button navigates to `/projects`

## P1 — Credits & Billing

- [ ] `/pricing` displays credit packages from database
- [ ] Package selection initiates Stripe checkout
- [ ] Webhook processes payment and credits appear on profile
- [ ] Credit balance shows correctly in nav/profile

## P2 — Social Features

- [ ] `/creators` shows creator cards
- [ ] `/user/:userId` shows public profile with projects
- [ ] Follow/unfollow toggles correctly
- [ ] Comments can be posted on videos
- [ ] Likes increment/decrement correctly

## P2 — Gallery

- [ ] `/gallery` loads showcase items
- [ ] Video players render and play
- [ ] Categories filter correctly

## P2 — Chat

- [ ] `/chat` loads conversation list
- [ ] Messages send and appear in real-time
- [ ] DM creation works

## P3 — Admin Panel

- [ ] `/admin` loads dashboard with stats
- [ ] User list loads and is searchable
- [ ] Project list loads with clip counts
- [ ] Audit log displays actions

## P3 — Edge Cases

- [ ] Deep-linking to `/production/:projectId` works on page reload
- [ ] Legacy routes redirect correctly (see BASELINE_LOCK.md)
- [ ] Safe mode activates after crash loop
- [ ] Empty states render gracefully (no projects, no credits, etc.)

---

## How to Run

```bash
# Smoke test (when available)
npm run regression:smoke

# Manual: Open each route, verify no console errors, check CTAs work
```

## After Each Fix

1. Run the relevant checklist items above
2. Check browser console for new errors
3. Verify no visual regression on landing page
4. Confirm auth flow still works end-to-end
