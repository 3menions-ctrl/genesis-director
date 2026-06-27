# 10 — Remediation Fix Log

> Work landed on branch `fix/audit-remediation` (uncommitted). Every fix was verified against actual code before editing; several audit findings were corrected or found already-fixed during that verification (noted inline). Typecheck green; edge-fn edits brace/paren-balanced vs HEAD; **migrations NOT applied** (need staging + sign-off).

## Fixed (19 code files + 2 migrations)

### Money correctness
- **zombie-cleanup double-refund** (3 sites) → canonical org-aware idempotent `refund_credits`; also fixed non-org-awareness + a missing clip-path idempotency guard. `zombie-cleanup/index.ts`
- **check-specialized-status refund-on-fail** — motion-transfer/stylize/etc. were charged up front and never refunded on failure. Now refunds the EXACT amount charged (read from the `mode-router:<projectId>` ledger row), idempotent + org-aware. `check-specialized-status/index.ts`
- **Billing → Polar (Batch 3c)** — added a reversible `STRIPE_BILLING_LOCKED` kill-switch in the payments abstraction + flipped the default provider to `polar`. Routes all checkout CTAs to `polar-checkout` (which funds the org pool); Stripe Connect payouts unaffected. `src/lib/payments/index.ts`

### Authorization / IDOR (9 edge fns)
Ownership guards (service-role bypass) added to: `continue-production`, `seamless-stitcher` (also had NO in-code auth — added `validateAuth`), `final-assembly`, `auto-stitch-trigger`, `seedance-pipeline`, `mode-router`, `hollywood-pipeline`, `generate-voice`, `retry-failed-clip` (non-admin path).

### Abuse / cost control
- **log-widget-event** — replaced attacker-controllable in-memory throttle with DB-backed `rate_limit_hit` keyed on client IP + a per-`(widget,IP)` cap on the credit-bearing `view` event (stops owner-credit drain). `log-widget-event/index.ts`
- **newsletter-subscribe** — added per-IP DB-backed rate limit (email-bomb / Resend-cost protection). `newsletter-subscribe/index.ts`
- **Ungated OpenAI fns** — ~~credit gates added inline (`deduct_credits`)~~ **SUPERSEDED**: when merging `main` into the branch, `main` was found to already gate all 4 (`generate-script`, `generate-ad-studio`, `generate-ad-variants`, `script-assistant`) via a proper shared `_shared/ai-credit-gate.ts` module (rate-limit + preflight + charge + daily caps) — strictly better than the inline approach. The merge took **main's version** of these 4 files; my inline gating was dropped. Net: the gap is closed, by main's implementation.

### Data loss
- **clip-lost-on-import** — `upload-ingest.ts` now rethrows on `video_clips` insert failure instead of swallowing + faking a success toast (callers already surface the error).

### Migrations (drafted, NOT applied)
- `20260706000000_audit_remediation_money_rls.sql` — `tip_in_thread` + `pledge_patron` lock+idempotency hardening; `organizations.plan` self-upgrade lockdown (trigger); drop `patron_subscriptions` self-manage FOR ALL policy.
- `20260706000100_restore_api_key_scopes.sql` — restore `scopes` in `find_api_key_owner` return (a later migration dropped it → org API keys defaulted to full access).

## Corrected during verification (audit was wrong / already fixed)
- **`seamless-stitcher` was NOT a CRITICAL anon-unauth** — `verify_jwt=true` (gateway blocks anon); it's a HIGH authenticated IDOR. Fixed as such.
- **`check-video-status` + `retry-failed-clip` (admin path)** already had ownership checks — not touched.
- **`notifications` forge already fixed** — permissive INSERT policy dropped in `20260213025841`; excluded from the migration.
- **"6 ungated OpenAI fns" was really 4** — `generate-story` and `regenerate-audio` have zero callers (dead code); not gated.

## Deferred (good-judgment calls — NOT blindly patched)
- **Ghost "completed" projects (auto-stitch-trigger)** — the two `'completed'`-on-failure paths are a deliberate *clips-only fallback* (preserves paid, successful clips when only the final stitch fails). Flipping to `'failed'` would be worse. The real fix is player-side handling of clips-only projects (R10) — needs design, not a status flip.
- **Editor "Approve & Render"** — `installJobRunner()` is never called because the render `Runner` was never implemented; the CTA is intentionally disabled ("coming soon"). This is a *missing feature to build*, not a bug to patch — risky to wire blind.
- **OAuth tokens plaintext**, **mint-project-share** (unwired), **admin Refunds/Coupons** (need real Polar integration), **org-seat enforcement**, **email-queue cron + bounce-suppression**, **types.ts regen** — larger/feature-scoped or need external config; left for dedicated work.

## Held (explicit user instruction / external dependency)
- **Bucket privatization** — held by user (touches every playback path).
- **Applying the migrations** + **committing/enabling crons** — need staging + Supabase-dashboard confirmation of what's already scheduled.

## Verification state
- `npm run typecheck` → exit 0, 0 errors.
- Edge-fn edits: brace/paren deltas match HEAD (no syntax drift). Deno not installed here → no `deno check`.
- Migrations: dollar-quote balanced; **not executed** (no DB access from this worktree).
- Not committed.
