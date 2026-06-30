# DEFERRED — needs prod-DB reconciliation / deploy / live verification

These were intentionally NOT modified. Reason (per your instructions): prod is
~32 migrations behind repo and carries out-of-band state, so fixing against repo
assumptions risks "fixing" a reality prod doesn't share. Each entry lists what it
needs before it can be safely done.

## Gated batch — explicit DO-NOT-TOUCH

### 1. Business API-key auth (P2-11)
- **What's wrong (repo):** UI writes `org_api_keys`; `api-v1` resolves via
  `find_api_key_owner`, whose org-UNION + `scopes` return live only in late
  migrations (`20260705010300`, `20260706000100`). If unapplied in prod: 401s, or
  scope silently falls back to full `['read','generate']`.
- **Needs:** confirm against prod (`ywcwaumozoejierlfkgj`) that `find_api_key_owner`
  returns 3 columns and UNIONs `org_api_keys`; regenerate `types.ts`. Only then
  decide if any code change is required.

### 2. Business onboarding RLS (P1-20)
- **What's wrong (repo):** `onboarding_intents` INSERT policy `WITH CHECK`
  references a non-existent `email` column → every insert rejected → business
  signup fully blocked.
- **Needs:** verify the LIVE policy matches the repo (it may already differ in
  prod). Fix is a DB migration (point the check at `contact_email`), which must be
  reconciled against prod's migration history before `db push` — exactly the
  drift the instructions warn about. Migration-only; no app code.

### 3. Admin RPCs (various, P2-18 + INFO)
- **What's wrong (repo):** all admin RPCs exist in repo migrations, but prod may
  be missing newer ones (`admin_bulk_*`, `admin_get_user_detail`, `analytics_*`,
  `ledger_*`); most admin pages lack a graceful fallback and would error-toast.
  Also the `admin-stuck-jobs-watchdog` `verify_jwt` config/comment mismatch.
- **Needs:** a live prod-DB audit of which admin RPCs exist; verify the deployed
  `verify_jwt` setting + cron invocation shape. Code/config change only after that.

### 4. Anything UNVERIFIED pending a prod check
- Meta IG publish 2-step flow (P2-14), distribution OAuth redirect env (P3),
  `find_api_key_owner` prod state, and any "WORKS in repo / UNVERIFIED live"
  verdict in the partials. Each needs a live exercise before touching.

## Recovery (P1-8) — sub-items deferred (the double-refund code bug WAS fixed)

### 5. Cron scheduling of `pipeline-watchdog` + `zombie-cleanup`
- **What's wrong (repo):** neither is scheduled in repo migrations (the only cron
  migration *unschedules* the watchdog).
- **Needs:** confirm whether a dashboard/Mgmt-API `pg_cron` job already runs them
  in prod (audit marks this UNVERIFIED). Adding a schedule migration blindly could
  double-schedule. Reconcile against the live cron list first, then add a guarded
  schedule.

### 6. `WATCHDOG_RESUME_ENABLED` default
- **What's wrong (repo):** the watchdog auto-resume is off unless the secret is
  `'true'`. With the double-refund now fixed, enabling is safer — but flipping a
  production safety gate is a deploy/ops decision.
- **Needs:** your sign-off to set the secret on the deployed function (and a
  dev/staging soak first). No repo code change required to enable.

### 7. `resume-avatar-pipeline` async-model rewrite
- **What's wrong (repo):** only understands the legacy single
  `pipeline_state.predictionId`; throws for the modern
  `pending_video_tasks.predictions[]` async model → can't recover current avatar
  jobs.
- **Needs:** a live stalled avatar job (modern async shape) on dev/staging to
  validate the rewrite end-to-end. Pure code, but unverifiable without a real
  multi-prediction avatar job; deferred to avoid shipping an untested recovery
  path that money depends on.
