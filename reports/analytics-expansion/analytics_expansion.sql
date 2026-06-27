-- ============================================================================
-- Analytics expansion — human/bot filter + new dimensions (channels,
-- new-vs-returning, hour×dow heatmap, acquisition funnel, period KPI deltas).
-- All read public.analytics_events, gated by is_admin(auth.uid()), humans only.
-- ============================================================================

-- 1) Human filter: exclude the admin's own browsing + headless/automation UAs
--    (this is what made the old numbers "false" — bots + QA heartbeats).
create or replace function public.analytics_is_human(_ctx jsonb)
returns boolean language sql immutable parallel safe as $$
  select coalesce(_ctx->>'is_admin','') <> 'true'
     and coalesce(_ctx->>'ua','') !~* '(headless|playwright|puppeteer|selenium|phantom|bot|crawl|spider|curl|wget|python-requests|node-fetch|lighthouse|pingdom|uptime|monitor|gtmetrix|axios|insomnia)';
$$;

-- 2) Upgrade existing RPCs → humans only -------------------------------------
create or replace function public.analytics_traffic(_since timestamptz default now()-interval '30 days')
returns table(visitors bigint, sessions bigint, pageviews bigint, bounce_rate numeric, avg_session_seconds numeric, pages_per_session numeric)
language sql stable security definer set search_path to 'public' as $fn$
  with pv as (
    select coalesce(user_id::text, anonymous_id) as actor, session_id, occurred_at
    from public.analytics_events
    where public.is_admin(auth.uid()) and name='$pageview' and occurred_at>=_since and session_id is not null
      and public.analytics_is_human(context)
  ), sess as (
    select session_id, count(*) as views, extract(epoch from (max(occurred_at)-min(occurred_at)))::numeric as secs
    from pv group by session_id
  )
  select (select count(distinct actor) from pv)::bigint, count(*)::bigint, (select count(*) from pv)::bigint,
         round(100.0*count(*) filter (where views=1)/greatest(count(*),1),1),
         round(coalesce(avg(secs),0),1),
         round((select count(*) from pv)::numeric/greatest(count(*),1),2)
  from sess;
$fn$;

create or replace function public.analytics_visitors_daily(_since timestamptz default now()-interval '30 days')
returns table(day date, visitors bigint, sessions bigint, pageviews bigint)
language sql stable security definer set search_path to 'public' as $fn$
  with pv as (
    select coalesce(user_id::text, anonymous_id) as actor, session_id, occurred_at::date as d
    from public.analytics_events
    where public.is_admin(auth.uid()) and name='$pageview' and occurred_at>=_since and public.analytics_is_human(context)
  )
  select d, count(distinct actor)::bigint, count(distinct session_id)::bigint, count(*)::bigint
  from pv group by d order by d;
$fn$;

create or replace function public.analytics_top_pages(_since timestamptz default now()-interval '30 days', _limit int default 20)
returns table(path text, views bigint, visitors bigint, avg_seconds numeric)
language sql stable security definer set search_path to 'public' as $fn$
  with pv as (
    select coalesce(user_id::text, anonymous_id) as actor, path, occurred_at,
           lead(occurred_at) over (partition by session_id order by occurred_at) as nxt
    from public.analytics_events
    where public.is_admin(auth.uid()) and name='$pageview' and occurred_at>=_since and public.analytics_is_human(context)
  )
  select path, count(*)::bigint, count(distinct actor)::bigint,
         round(coalesce(avg(extract(epoch from (nxt-occurred_at))) filter (where nxt is not null and (nxt-occurred_at)<interval '30 minutes'),0)::numeric,1)
  from pv group by path order by count(*) desc limit _limit;
$fn$;

create or replace function public.analytics_segment(_dim text, _since timestamptz default now()-interval '30 days', _limit int default 12)
returns table(key text, sessions bigint, visitors bigint)
language sql stable security definer set search_path to 'public' as $fn$
  select context->>_dim, count(distinct session_id)::bigint, count(distinct coalesce(user_id::text, anonymous_id))::bigint
  from public.analytics_events
  where public.is_admin(auth.uid()) and occurred_at>=_since and context->>_dim is not null and context->>_dim<>'' and public.analytics_is_human(context)
  group by context->>_dim order by count(distinct session_id) desc limit _limit;
$fn$;

create or replace function public.analytics_top_searches(_since timestamptz default now()-interval '30 days', _limit int default 25)
returns table(query text, searches bigint, actors bigint, avg_results numeric)
language sql stable security definer set search_path to 'public' as $fn$
  select payload->>'query', count(*)::bigint, count(distinct coalesce(user_id::text, anonymous_id))::bigint,
         round(avg((coalesce(payload->>'reels','0'))::numeric+(coalesce(payload->>'creators','0'))::numeric),1)
  from public.analytics_events
  where public.is_admin(auth.uid()) and name='search' and occurred_at>=_since and payload->>'query' is not null and public.analytics_is_human(context)
  group by payload->>'query' order by count(*) desc limit _limit;
$fn$;

-- 3) NEW RPCs ----------------------------------------------------------------

-- Channel attribution from referrer.
create or replace function public.analytics_channels(_since timestamptz default now()-interval '30 days')
returns table(channel text, sessions bigint, visitors bigint, pageviews bigint)
language sql stable security definer set search_path to 'public' as $fn$
  with pv as (
    select coalesce(user_id::text, anonymous_id) as actor, session_id,
      case
        when referrer is null or referrer='' then 'Direct'
        when referrer ~* '(smallbridges|localhost|127\.0\.0\.1|loca\.lt)' then 'Internal'
        when referrer ~* '(google\.|bing\.|duckduckgo|yahoo\.|yandex|baidu|ecosia)' then 'Search'
        when referrer ~* '(facebook|instagram|twitter|t\.co|x\.com|linkedin|reddit|tiktok|youtube|pinterest|whatsapp|telegram|threads)' then 'Social'
        else 'Referral'
      end as channel
    from public.analytics_events
    where public.is_admin(auth.uid()) and name='$pageview' and occurred_at>=_since and public.analytics_is_human(context)
  )
  select channel, count(distinct session_id)::bigint, count(distinct actor)::bigint, count(*)::bigint
  from pv group by channel order by count(*) desc;
$fn$;

-- New vs returning visitors, daily.
create or replace function public.analytics_new_returning(_since timestamptz default now()-interval '30 days')
returns table(day date, new_visitors bigint, returning_visitors bigint)
language sql stable security definer set search_path to 'public' as $fn$
  with fs as (
    select coalesce(user_id::text, anonymous_id) as actor, min(occurred_at)::date as first_day
    from public.analytics_events
    where public.is_admin(auth.uid()) and name='$pageview' and public.analytics_is_human(context)
    group by 1
  ), pv as (
    select distinct coalesce(user_id::text, anonymous_id) as actor, occurred_at::date as d
    from public.analytics_events
    where public.is_admin(auth.uid()) and name='$pageview' and occurred_at>=_since and public.analytics_is_human(context)
  )
  select pv.d,
    count(*) filter (where fs.first_day=pv.d)::bigint,
    count(*) filter (where fs.first_day<pv.d)::bigint
  from pv join fs on fs.actor=pv.actor
  group by pv.d order by pv.d;
$fn$;

-- Hour-of-day × day-of-week heatmap, in each visitor's local time.
create or replace function public.analytics_heatmap(_since timestamptz default now()-interval '30 days')
returns table(dow int, hour int, pageviews bigint)
language sql stable security definer set search_path to 'public' as $fn$
  with pv as (
    select (occurred_at at time zone coalesce(nullif(context->>'tz',''),'UTC')) as lt
    from public.analytics_events
    where public.is_admin(auth.uid()) and name='$pageview' and occurred_at>=_since and public.analytics_is_human(context)
      and (context->>'tz' is null or context->>'tz' ~ '^[A-Za-z_]+/[A-Za-z_/+-]+$' or context->>'tz'='UTC')
  )
  select extract(dow from lt)::int, extract(hour from lt)::int, count(*)::bigint
  from pv group by 1,2;
$fn$;

-- Acquisition funnel.
create or replace function public.analytics_funnel(_since timestamptz default now()-interval '30 days')
returns table(step text, step_order int, actors bigint)
language sql stable security definer set search_path to 'public' as $fn$
  with base as (
    select coalesce(user_id::text, anonymous_id) as actor, name, path
    from public.analytics_events
    where public.is_admin(auth.uid()) and occurred_at>=_since and public.analytics_is_human(context)
  )
  select s.step, s.step_order, s.actors from (
    select 'Visited'::text as step, 1 as step_order, count(distinct actor)::bigint as actors from base where name='$pageview'
    union all select 'Viewed sign-up', 2, count(distinct actor)::bigint from base where name='$pageview' and path ~* '^/auth'
    union all select 'Signed in', 3, count(distinct actor)::bigint from base where name='signed_in'
    union all select 'Identified', 4, count(distinct actor)::bigint from base where name='$identify'
  ) s order by s.step_order;
$fn$;

-- Period-over-period KPI deltas (current window vs the prior equal window).
create or replace function public.analytics_kpis(_days int default 30)
returns table(metric text, current_value bigint, previous_value bigint, delta_pct numeric)
language sql stable security definer set search_path to 'public' as $fn$
  with cur as (
    select coalesce(user_id::text, anonymous_id) as actor, session_id, name
    from public.analytics_events
    where public.is_admin(auth.uid()) and occurred_at >= now()-(_days||' days')::interval and public.analytics_is_human(context)
  ), prv as (
    select coalesce(user_id::text, anonymous_id) as actor, session_id, name
    from public.analytics_events
    where public.is_admin(auth.uid()) and occurred_at >= now()-(2*_days||' days')::interval
      and occurred_at < now()-(_days||' days')::interval and public.analytics_is_human(context)
  ), m as (
    select 'Visitors' as metric,
      (select count(distinct actor) from cur where name='$pageview') as c,
      (select count(distinct actor) from prv where name='$pageview') as p
    union all select 'Pageviews', (select count(*) from cur where name='$pageview'), (select count(*) from prv where name='$pageview')
    union all select 'Sessions', (select count(distinct session_id) from cur where name='$pageview'), (select count(distinct session_id) from prv where name='$pageview')
  )
  select metric, c::bigint, p::bigint, case when p=0 then null else round(100.0*(c-p)/p,1) end from m;
$fn$;

grant execute on function
  public.analytics_is_human(jsonb), public.analytics_channels(timestamptz),
  public.analytics_new_returning(timestamptz), public.analytics_heatmap(timestamptz),
  public.analytics_funnel(timestamptz), public.analytics_kpis(int)
to authenticated;
