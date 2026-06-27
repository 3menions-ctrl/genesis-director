-- ============================================================================
-- Admin Dashboard Phase 1 — command-center RPCs: live-ops snapshot, activity
-- feed, SLA/health, trending content. All SECURITY DEFINER, is_admin-gated.
-- ============================================================================

-- "Right now" snapshot.
create or replace function public.admin_live_ops()
returns table(active_visitors_5m bigint, live_rooms bigint, renders_in_flight bigint, signups_1h bigint, published_1h bigint)
language sql stable security definer set search_path to 'public' as $fn$
  select
    (select count(distinct coalesce(user_id::text, anonymous_id)) from public.analytics_events
       where public.is_admin(auth.uid()) and name='$pageview' and occurred_at > now()-interval '5 minutes'
         and public.analytics_is_human(context))::bigint,
    (select count(*) from public.live_rooms where public.is_admin(auth.uid()) and status='live')::bigint,
    (select count(*) from public.movie_projects where public.is_admin(auth.uid()) and status not in ('failed','completed','draft'))::bigint,
    (select count(*) from public.profiles where public.is_admin(auth.uid()) and created_at > now()-interval '1 hour')::bigint,
    (select count(*) from public.published_reels where public.is_admin(auth.uid()) and created_at > now()-interval '1 hour')::bigint;
$fn$;

-- Unified recent-activity feed (signups · publishes · failed renders · go-lives).
create or replace function public.admin_activity_feed(_limit int default 24)
returns table(kind text, label text, ref_id text, occurred_at timestamptz)
language sql stable security definer set search_path to 'public' as $fn$
  with src as (
    select 'signup'::text as kind, coalesce(nullif(p.display_name,''),'New user') as label, p.id::text as ref_id, p.created_at as occurred_at
      from public.profiles p where public.is_admin(auth.uid())
    union all
    select 'publish', coalesce(nullif(r.title,''),'Untitled reel'), r.id::text, r.created_at
      from public.published_reels r where public.is_admin(auth.uid()) and not coalesce(r.is_taken_down,false)
    union all
    select 'render_failed', coalesce(nullif(m.title,''),'Untitled project'), m.id::text, m.updated_at
      from public.movie_projects m where public.is_admin(auth.uid()) and m.status='failed'
    union all
    select 'live', coalesce(nullif(l.title,''),'Live room'), l.id::text, l.started_at
      from public.live_rooms l where public.is_admin(auth.uid()) and l.started_at is not null
  )
  select kind, label, ref_id, occurred_at from src where occurred_at is not null order by occurred_at desc limit _limit;
$fn$;

-- SLA / health timers.
create or replace function public.admin_sla()
returns table(oldest_ticket_min numeric, oldest_render_min numeric, failed_rate_24h numeric, stuck_renders bigint)
language sql stable security definer set search_path to 'public' as $fn$
  select
    (select round(extract(epoch from (now()-min(created_at)))/60) from public.support_messages
       where public.is_admin(auth.uid()) and status='open'),
    (select round(extract(epoch from (now()-min(created_at)))/60) from public.movie_projects
       where public.is_admin(auth.uid()) and status not in ('failed','completed','draft')),
    (select round(100.0*count(*) filter (where status='failed')/greatest(count(*),1),1) from public.movie_projects
       where public.is_admin(auth.uid()) and created_at > now()-interval '24 hours'),
    (select count(*) from public.movie_projects
       where public.is_admin(auth.uid()) and status not in ('failed','completed','draft') and created_at < now()-interval '30 minutes')::bigint;
$fn$;

-- Trending content (top reels by plays/likes/tips).
create or replace function public.admin_trending(_limit int default 6)
returns table(reel_id text, title text, creator text, plays bigint, likes bigint, tips bigint)
language sql stable security definer set search_path to 'public' as $fn$
  select r.id::text, coalesce(nullif(r.title,''),'Untitled'), coalesce(pr.display_name,'—'),
         coalesce(r.play_count,0)::bigint, coalesce(r.like_count,0)::bigint, coalesce(r.tip_credits,0)::bigint
  from public.published_reels r
  left join public.profiles_public pr on pr.id=r.creator_id
  where public.is_admin(auth.uid()) and not coalesce(r.is_taken_down,false)
  order by coalesce(r.play_count,0) desc, coalesce(r.like_count,0) desc
  limit _limit;
$fn$;

grant execute on function
  public.admin_live_ops(), public.admin_activity_feed(int), public.admin_sla(), public.admin_trending(int)
to authenticated;
