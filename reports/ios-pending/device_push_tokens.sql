-- device_push_tokens — APNs/device token store for native push.
--
-- STAGED, NOT APPLIED. This lives under reports/ios-pending/ (NOT supabase/
-- migrations/) on purpose: DB pushes are gated (a prod frozen-balance bug + other
-- pending migrations make `supabase db push` a footgun until staging + signoff).
-- When ready: move this into supabase/migrations/<timestamp>_device_push_tokens.sql
-- and push deliberately.
--
-- Why it's needed: src/lib/native/push.ts upserts the APNs device token here
-- (onConflict: 'token'). Without the table the upsert silently fails (push.ts
-- swallows it), so the backend has no device to target — push never sends.

create table if not exists public.device_push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null default 'ios' check (platform in ('ios','android','web')),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_device_push_tokens_user
  on public.device_push_tokens(user_id);

alter table public.device_push_tokens enable row level security;

-- A user can only see/insert/update/delete their own device tokens.
drop policy if exists "own device tokens" on public.device_push_tokens;
create policy "own device tokens" on public.device_push_tokens
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The push SENDER (an edge function) reads tokens with the service role, which
-- bypasses RLS — no extra policy needed for that path.

-- ── Still required to actually send pushes (user/backend tasks, see IOS_SETUP.md §6) ──
--   1. Apple: generate an APNs Auth Key (.p8) + note Key ID + Team ID.
--   2. An edge function that, on a notification event, reads device_push_tokens
--      for the target user and POSTs to APNs (api.push.apple.com) with a JWT
--      signed by the .p8. The existing send-push-notification function is Web
--      Push (webpush lib) — needs an APNs variant.
--   3. Xcode: add the Push Notifications capability to the App target.
