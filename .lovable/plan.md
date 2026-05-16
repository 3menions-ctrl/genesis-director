# Comprehensive Account/Permission Hardening Plan

## What's already correct ✅
- All **118 public tables have RLS enabled** (zero unprotected tables).
- Auth = mandatory OTP + Google OAuth, single‑project enforcement in place.
- `user_roles` + `has_role()` SECURITY DEFINER pattern is implemented.
- Most admin RPCs are wrapped behind `has_role(..., 'admin')` checks internally.

## What needs fixing — grouped into 5 bundles

### Bundle 1 — Critical write‑side RLS (highest risk)
Four policies use `USING (true)` / `WITH CHECK (true)` for INSERT/UPDATE/ALL. Anyone (anon or any logged‑in user) can write.

| Table | Policy | Fix |
|---|---|---|
| `org_credit_refills` | `org_credit_refills_service` (ALL) | Restrict to `auth.role() = 'service_role'` |
| `subscriptions` | `subscriptions_service_all` (ALL) | Restrict to `auth.role() = 'service_role'` |
| `onboarding_intents` | `Anyone can create onboarding intent` (INSERT) | Keep public but rate‑limit + add column constraints (this is pre‑signup, intentional) |
| `sales_inquiries` | `Anyone can submit a sales inquiry` (INSERT) | Keep public (lead form), but tighten WITH CHECK to require non‑empty email + length caps |

### Bundle 2 — Anon‑callable SECURITY DEFINER functions
~25 functions (mostly `admin_*`, plus `accept_organization_invite`, `add_org_creator_as_owner`, `add_org_domain`, `assign_org_seat`, `admin_force_tier`, `admin_change_account_type`, `admin_create_impersonation_token`, `admin_delete_org`, `admin_suspend_account`, `admin_unsuspend_account`, `admin_transfer_org_owner`, `admin_get_email_log`, `admin_bump_security_versions_except`, `admin_activate_enterprise_org`) currently grant EXECUTE to `anon`.

Internal `has_role(...)` guard means they reject anon at runtime, but defense‑in‑depth says: `REVOKE EXECUTE … FROM anon, public; GRANT EXECUTE … TO authenticated;`. Org‑invite functions stay callable by `authenticated` only.

### Bundle 3 — Storage buckets
All **16 buckets are public** with broad listing. Reclassify:

| Bucket | Decision |
|---|---|
| `final-videos`, `thumbnails`, `video-thumbnails`, `scene-images`, `genesis-castings` | Stay public read (showcase). Disallow listing — restrict SELECT to `name = requested object`. |
| `user-uploads`, `hoppy-uploads`, `brand-assets`, `enterprise-brand-kits`, `voice-tracks`, `character-references`, `photo-edits`, `temp-frames`, `avatars`, `video-clips`, `videos` | Convert to **private**, gate SELECT/INSERT/DELETE by `auth.uid()::text = (storage.foldername(name))[1]`. Use signed URLs in client where playback needs it. |

This is the single biggest exposure — today anyone with a bucket name can list every other user's uploaded reference images, voice tracks, and brand kits.

### Bundle 4 — Function search_path & duplicates
- 5 functions are missing `SET search_path = public`. Add it.
- Three duplicate signatures of `charge_preproduction_credits` / `charge_production_credits` exist. Drop the unused overloads to remove ambiguity.

### Bundle 5 — Client‑side account scoping
Sweep `src/` for queries that don't filter by `auth.uid()` (RLS protects us, but explicit scoping prevents accidental cross‑user cache hits in React Query and cuts payload size). Also:
- Verify every `useQuery` key includes `userId`/`session.user.id` so logout invalidates all caches.
- Ensure `supabase.auth.signOut()` is followed by `queryClient.clear()` everywhere (not just one path).
- Audit edge functions for any that accept `userId` from the request body instead of deriving it from `getClaims(token).sub` — those are privilege‑escalation vectors.

---

## Execution order
1. **Bundle 1** (4 policies) — single migration, instant lockdown of write paths.
2. **Bundle 3** (storage) — single migration, biggest user‑visible privacy win.
3. **Bundle 2** (REVOKE EXECUTE) — single migration, no behavior change for legit callers.
4. **Bundle 4** (search_path + dupes) — cleanup migration.
5. **Bundle 5** (client + edge sweep) — code‑only PR, no DB changes.

Each bundle = one migration + verification (rerun scanner). I'll pause between bundles so you can review.

## What I'm NOT touching
- The 24 `USING (true)` SELECT policies on showcase tables (achievements, tier_limits, world chat, public profiles, follows, etc.) — these are intentional public‑read and will be documented in `@security-memory`.
- The `extension in public` warning — moving pgcrypto/uuid out of public is breaking; accepting the risk and noting it.
