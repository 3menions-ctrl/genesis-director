-- Newsletter / email-subscribe list. Public landing form inserts via the
-- newsletter-subscribe edge function (service role); no direct client access.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'subscribed' check (status in ('subscribed','unsubscribed')),
  source text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
-- No policies: only the service role (edge function) reads/writes. RLS on +
-- zero policies = locked to anon/authenticated, open to service role.
create index if not exists idx_newsletter_subscribers_email on public.newsletter_subscribers (lower(email));
