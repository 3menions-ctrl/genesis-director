# 05 — Settings, Account & Profile Editing (READ-ONLY QA Audit)

Surface: SETTINGS, ACCOUNT & PROFILE EDITING. Method: each control → handler → supabase
write/RPC/edge fn → table/column (verified vs migrations; **types.ts is drifted/stale per
CLAUDE.md, so columns were checked against `supabase/migrations`, not types.ts**).

## TWO PARALLEL SETTINGS SURFACES (both live & routed)
1. **`/settings`** → `src/pages/Settings.tsx` → `src/components/settings/*`
   (AccountSettings, BillingSettings, SecuritySettings, PreferencesSettings,
   NotificationSettings, ReferralsSettings). **Older, buggier surface.**
2. **`/account?tab=settings`** → `src/pages/account/SettingsDashboard.tsx` (the big,
   newer, mostly-correct panel). **`/account?tab=profile`** → `ProfileDashboard.tsx`.
3. A THIRD notification surface: **`/account/notifications`** → `src/pages/account/NotificationSettings.tsx`
   (in-app bell categories, separate `notification_preferences` table).

`/settings/deactivate|support|workspace` are `<Navigate>` redirects (App.tsx 543-545).

---

## INVENTORY

| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| handleSave (profile fields) | components/settings/AccountSettings.tsx:166 | Save display_name/full_name/company/role/use_case | `profiles.update(...)` eq id | OK |
| handleAvatarUpload | AccountSettings.tsx:120 | Avatar upload | storage `avatars` `{uid}/{ts}.ext` → `profiles.avatar_url` | OK |
| handleEmailChange | AccountSettings.tsx:195 | Change email | invoke `update-user-email` body `{newEmail}` only | **BROKEN — no password** |
| handlePrivacyToggle | AccountSettings.tsx:95 | Opt-out activity tracking | `user_gamification.update({tracking_opted_out})` | **BROKEN — wrong table** |
| Deactivate button | AccountSettings.tsx:559 | Deactivate account | `navigate('/settings/deactivate')` → redirect | **BROKEN — dead-end** |
| handleSave (prefs) | components/settings/PreferencesSettings.tsx:90 | Quality/genre/theme/playback | `profiles.update({preferences})` | OK |
| handleSave (notif) | components/settings/NotificationSettings.tsx:67 | Email cadence toggles | `profiles.update({notification_settings})` | OK |
| handlePasswordChange | components/settings/SecuritySettings.tsx:46 | Change password | `auth.updateUser({password})` | OK (no current-pw check) |
| handleSignOutAllDevices | SecuritySettings.tsx:76 | Sign out everywhere | `auth.signOut({scope:'global'})` | OK |
| Active Sessions list | SecuritySettings.tsx:300-314 | Show devices | hardcoded single "Current Device" | **FAKE — cosmetic** |
| handleExportData | SecuritySettings.tsx:88 | GDPR export | invoke `export-user-data` | OK |
| handleDeleteAccount | SecuritySettings.tsx:124 | Delete account | invoke `delete-user-account` (no body) | **BROKEN — no body** |
| ReferralsSettings | components/settings/ReferralsSettings.tsx:14 | Invite code/link/stats | `referral_codes` get-or-create + `referral_redemptions` | OK |
| Profile field auto-save (×~12) | account/ProfileDashboard.tsx:1138-1163,3027,6071 | name/tagline/bio/location/links/etc on blur | `profiles.update({...})` | OK |
| Avatar/Cover upload | ProfileDashboard.tsx:5245,6497 | image upload | storage `avatars`(5MB)/`profile-covers`(10MB) → `avatar_url`/`cover_url` | OK |
| Pronouns/Accent/playback prefs | ProfileDashboard.tsx:6098-6131 | preferences JSONB | `setPrefs(...)` → `profiles.preferences` | OK |
| Featured reel / pinned highlights | ProfileDashboard.tsx:3711,1018 | trailer / pins | `profiles.featured_reel_id`, RPC `toggle_pin_reel` | OK |
| Identity/appearance/notif/privacy/playback/billing fields (×~50) | account/SettingsDashboard.tsx:726-1950 | autosave settings | `profiles.update(...)` / `preferences` / `notification_settings` | OK |
| Browser-push toggles (×5) | SettingsDashboard.tsx:1248-1252 | push prefs | `push_preferences` upsert | **WEAK — no toast/error handling** |
| Patron tier inline edits | SettingsDashboard.tsx:1762-1768 (updateTier ~1521) | edit tier fields | `patron_tiers.update(...)` | **WEAK — no toast/error handling** |
| Change email (account) | SettingsDashboard.tsx:2006 | change email | invoke `update-user-email` body `{newEmail,password}` | OK |
| Change password (account) | SettingsDashboard.tsx:2341 | change pw | `auth.updateUser({password})` | OK |
| 2FA enroll/disable | SettingsDashboard.tsx:2273-2291,2052 | MFA | `auth.mfa.*`; confirmAsync on disable | OK |
| Sign out others/global | SettingsDashboard.tsx:2186,2198 | sessions | `auth.signOut({scope})` | OK (no per-session list) |
| Link/unlink identity | SettingsDashboard.tsx:2068,2075 | OAuth links | `auth.unlinkIdentity/linkIdentity`; confirmAsync on unlink | OK |
| Download my data | SettingsDashboard.tsx:2404 | export | invoke `export-user-data` | OK |
| Deactivate (account) | SettingsDashboard.tsx:2418 | deactivate | `profiles.update({deactivated_at})`; confirmAsync | OK |
| Delete account forever | SettingsDashboard.tsx:2508 | delete | invoke `delete-user-account` (no body) | **BROKEN — no body** |
| NotificationSettings (bell) save | account/NotificationSettings.tsx:152 | in-app categories | `notification_preferences` upsert (untyped table) | OK (table exists) |
| SessionsCard (real) | components/security/SessionsCard.tsx:63 | list/revoke sessions | invoke `manage-sessions` | OK, but only mounted in Profile.tsx:984; missing `glassCard` prop |
| edge: update-user-email | functions/update-user-email/index.ts | re-auth email change | requires password | OK |
| edge: delete-user-account | functions/delete-user-account/index.ts | full delete | requires password OR confirm phrase | OK (clients don't send it) |
| edge: export-user-data | functions/export-user-data/index.ts | GDPR export | service-role, JWT-scoped | OK (was previously broken, fixed) |
| edge: manage-sessions | functions/manage-sessions/index.ts | list/revoke (IDOR-fixed) | GoTrue admin API | OK |
| edge: newsletter-subscribe | functions/newsletter-subscribe/index.ts | public signup | rate-limited upsert + Resend | OK |
| edge: handle-email-unsubscribe | functions/handle-email-unsubscribe/index.ts | token unsubscribe (Unsubscribe.tsx) | — | OK (not deep-traced) |
| edge: handle-email-suppression | functions/handle-email-suppression/index.ts | Resend bounce/complaint webhook | config.toml only, no UI | OK (webhook, out of UI scope) |
| edge: export-workspace-report | functions/export-workspace-report/index.ts | business report (BusinessReports.tsx) | — | business surface, out of personal scope |

---

## BROKEN

### Delete Account — CRITICAL
- **Symptom:** Account deletion fails for every user on BOTH settings surfaces.
- **Repro:** Settings → Security → Delete Account → type `DELETE` → confirm. (Also
  `/account?tab=settings` → Delete account forever → type `DELETE`.) Toast: "Account
  deletion failed" / "Could not delete."
- **Root cause:** Both clients call the edge fn with NO request body:
  `SecuritySettings.tsx:138` `supabase.functions.invoke('delete-user-account')` and
  `SettingsDashboard.tsx:2508` `supabase.functions.invoke("delete-user-account")`.
  The edge fn `delete-user-account/index.ts:62-89` REQUIRES `body.password` (password
  accounts) or `body.confirm === 'DELETE MY ACCOUNT'` (passwordless) → returns 400
  otherwise. The typed "DELETE" string lives only in local React state and is never
  transmitted. (SettingsDashboard delete dialog `DeleteAccountDialog.submit` at 2504-2515;
  SecuritySettings `handleDeleteAccount` at 124-155.)
- **Fix:** Add a password input (password accounts) / send `{ confirm: 'DELETE MY ACCOUNT' }`
  (passwordless) and pass it in the invoke body. Note the UI confirm string ("DELETE") also
  doesn't match the server's required phrase ("DELETE MY ACCOUNT").
- **Confidence:** Code-contract certain. Live prod result UNVERIFIED (no backend run).

### Change Email on /settings — HIGH
- **Symptom:** Email change always fails on `/settings`; works on `/account?tab=settings`.
- **Repro:** `/settings` → Account → Email → Change → enter new email → Send Confirmation.
  Toast: "Couldn't change email. Please try again."
- **Root cause:** `AccountSettings.tsx:217` invokes `update-user-email` with
  `body: { newEmail }` and the dialog (lines 592-610) has NO password field. The edge fn
  `update-user-email/index.ts:52-57` requires `password` → 400. The newer SettingsDashboard
  dialog correctly sends `{ newEmail, password }` (SettingsDashboard.tsx:2007).
- **Fix:** Add a current-password field to the AccountSettings email dialog and include
  `password` in the invoke body (mirror SettingsDashboard).

### "Opt out of activity tracking" on /settings is a no-op — HIGH (privacy/compliance)
- **Symptom:** Toggling opt-out on `/settings` reports success but analytics keep recording.
- **Repro:** `/settings` → Account → Privacy → enable "Opt out of activity tracking".
- **Root cause:** `AccountSettings.tsx:95-114` reads/writes `tracking_opted_out` on
  **`user_gamification`**, but the gate `track_event` RPC reads
  **`profiles.tracking_opted_out`** (migration `20260613230000_settings_consumers.sql:317-318`).
  No trigger syncs `tracking_opted_out` between the two tables (the only sync is
  `hide_from_leaderboard` profiles→user_gamification, same migration L327-350). So the
  canonical column read by tracking stays `false`. The `/account` surface writes the correct
  `profiles.tracking_opted_out` (SettingsDashboard privacy module).
- **Fix:** Point AccountSettings privacy read/write at `profiles.tracking_opted_out` (or add
  a sync trigger). Same applies to its `hide_from_leaderboard` read (user_gamification) which
  is the non-canonical side.

### Deactivate Account button on /settings is a dead-end — HIGH
- **Symptom:** "Deactivate Account" navigates away to the other settings page; nothing happens.
- **Repro:** `/settings` → Account → Deactivate Account.
- **Root cause:** `AccountSettings.tsx:559` `navigate('/settings/deactivate')`, and
  `App.tsx:543` redirects `/settings/deactivate` → `/account?tab=settings`. No deactivation
  occurs, no deactivation UI is focused. (Real deactivation only exists in
  `SettingsDashboard.deactivate:2418`.)
- **Fix:** Either implement deactivation inline in AccountSettings, or deep-link to the
  account settings deactivate card, or remove the button.

### /settings "Active Sessions" is fake — MEDIUM
- **Symptom:** Sessions list always shows a single hardcoded "Current Device / Last active:
  Now / Active"; no real devices, no per-session revoke.
- **Repro:** `/settings` → Security → Active Sessions.
- **Root cause:** `SecuritySettings.tsx:300-314` renders static markup; it never calls
  `manage-sessions`. The working `SessionsCard` (backed by `manage-sessions`, IDOR-fixed) is
  only mounted in `Profile.tsx:984`, not in either settings surface. "Sign Out All" uses
  `auth.signOut({scope:'global'})` directly.
- **Fix:** Render `SessionsCard` in the settings security section.

### Browser-push toggles swallow errors / give no feedback — MEDIUM
- **Symptom:** A failed push-preference save looks successful, then reverts on reload.
- **Root cause:** `SettingsDashboard.tsx` `setPushPref` (~1213-1216) upserts to
  `push_preferences` with no try/catch and no toast; toggles at 1248-1252 set optimistic
  local state regardless of outcome.
- **Fix:** await + check error, toast on failure, roll back optimistic state.

### Patron tier inline edits swallow errors / no feedback — MEDIUM
- **Symptom:** Failed tier-field edits silently persist in the UI.
- **Root cause:** `SettingsDashboard.tsx` `updateTier` (~1521-1524) updates local state and
  `patron_tiers` with no error handling / success toast. Fields at 1762-1768.
- **Fix:** try/catch + toast + rollback. (Creator surface — lower user impact.)

### SessionsCard rendered without required prop — LOW (cosmetic)
- **Symptom:** Sessions card loses its glass styling.
- **Root cause:** `SessionsCard` requires `{ glassCard: string }` (SessionsCard.tsx:63) but
  `Profile.tsx:984` renders `<SessionsCard />` (prop undefined → `cn('p-6', undefined)`; no
  crash, just no card class). Flagged for the Profile auditor.

---

## NOTES / NON-BUGS

- **No `window.confirm` anywhere** in this surface. Destructive actions use `confirmAsync`
  (2FA disable, unlink identity, remove tier, deactivate, sign-out-everywhere) or a typed
  "DELETE" custom Dialog. Compliant.
- **Three fragmented notification stores with overlap** (LOW): `profiles.notification_settings`
  (email cadence; `/settings` + `/account?tab=settings`), `push_preferences` (browser push;
  `/account?tab=settings`), and the `notification_preferences` table (in-app bell categories
  incl. `ch_email`; `/account/notifications`). `ch_email` vs `emailNotifications` overlap with
  no cross-sync — a user can set conflicting email prefs across pages. `notification_preferences`
  is UNTYPED in types.ts but the table exists (migration `20260625000000_notifications.sql:88`).
- **Email gating verified consistent:** `should_send_email_to`
  (`20260613230000_settings_consumers.sql:248-292`) reads the same JSONB keys the UI writes
  (emailNotifications, videoComplete, weeklyDigest, productUpdates, tips, marketing,
  quietHours*). billing/security/password_reset are critical and bypass opt-out. No dead toggles.
- **Two live settings surfaces** is itself a maintenance/reliability risk; `/settings`
  carries all four broken flows above. Recommend redirecting `/settings` → `/account?tab=settings`
  (the sub-routes already redirect; the main route does not).
- **types.ts drift confirmed (not a runtime bug):** `username, interests, is_discoverable,
  hide_from_leaderboard, tracking_opted_out, featured_reel_id` columns and
  `push_preferences/patron_tiers/patron_goals/notification_preferences` tables + several RPCs
  (`toggle_block, accept/reject_follow_request, get_my_profile, list_follow_requests`) are
  absent from types.ts but present in migrations. Writes work.
- **export-user-data & manage-sessions** carry comments documenting prior breakage now fixed
  (undeclared `claimsData`/`supabase` in export; IDOR in session revoke). Both read OK now.
- Account-type mutual exclusivity: no personal-surface setting was found writing business
  fields; separation intact.
