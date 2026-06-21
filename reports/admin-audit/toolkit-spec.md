# Admin Toolkit, Analytics & CRM — Comprehensive Spec

_Companion to `audit.md`. This is the target: the full admin tool surface, deep user analytics + CRM, the best open-source stack, and the premium design system the rebuilt admin must hit. Tags: **[have]** exists today · **[wire]** built but unreachable · **[gap]** build new · **[OSS]** use an open-source tool._

> Goal: a **mission-control admin** that measures everything, is deeply connected to the data, and looks more premium than the user account. Borderless, slick, single-accent, data-dense.

---

## PART 1 — The full admin toolkit (by domain)

### A. Command & situational awareness (global)
- Global command palette (Cmd+K) **[have]** · global entity search (`admin_search_entities`) **[have]**
- **Mission Control dashboard** — live: signups today, active renders, queue depth, error rate, revenue today, online users, credit burn, provider spend **[gap — expand `admin_dashboard_pulse`]**
- Real-time event stream / "live feed" of everything happening **[gap, OSS]**
- Alerting center — threshold + anomaly alerts, routed to email/Slack **[gap]**
- Saved views, pinned metrics, personalized operator home **[gap]**
- Audit log on every action (`admin_audit_log`) **[have]**
- Impersonation w/ persistent banner (`admin_create_impersonation_token`) **[wire]**
- Maintenance mode + announcement broadcaster (`system_config`) **[have]**

### B. People · Identity · Users  → see Part 2 for the deep analytics
- **User 360** profile (full field set in Part 2) **[wire — `admin_get_user_detail` exists, page orphaned]**
- Advanced user list: filters, saved segments, bulk select **[have, extend]**
- Account lifecycle: suspend/unsuspend, force tier, change account type, force-logout **[wire — RPCs exist]**
- Roles & scopes mgmt; multi-admin + server-enforced scopes **[gap — single-admin lock today]**
- GDPR export/delete/consent **[have]** · Abuse/fraud/velocity signals **[have, extend]**
- Sessions & devices, security version revocation **[have]**

### C. CRM · Lifecycle · Relationships  → see Part 2
- Contact & lead pipeline (`enterprise_leads` + all signups) with stages, owner, tasks **[gap]**
- B2B: company/org 360 (`admin_get_org_detail`) + deals/opportunities **[wire + gap]**
- Activity timeline per contact (events + manual notes/calls/emails) **[gap]**
- Notes, tags, tasks/reminders, SLAs on any entity **[gap]**
- Lifecycle campaigns / sequences + segment targeting **[gap, OSS]**
- Surveys / NPS / CSAT **[gap, OSS]** · Referral program **[have]**

### D. Money · Finance · Revenue
- Revenue cockpit: MRR/ARR, ARPU, gross & net churn $, expansion, NRR, payback **[gap — extend finance]**
- Cohort revenue & LTV curves **[gap]**
- Subscriptions **[have]** · Refunds/disputes **[have]** · Coupons **[have]** · Invoices **[have]**
- Credit ledger + grant/adjust **[have]** · Credit-package CRUD **[wire]**
- Stripe↔internal reconciliation **[have]** · COGS/margin per engine **[have]**
- **Creator payouts** (`creator_earnings_ledger`, `creator_payout_accounts`, patron) **[gap]**
- Dunning / failed-payment recovery · tax/region reporting · forecasting **[gap]**

### E. Production · Content · Media
- Render queue, status, retries, failed-render triage **[have]**
- Provider health & cost (Wan/Kling/Seedance/Veo/Sora) **[have]**
- Project browser **[have]** + project 360 detail **[wire]**
- Storage inventory & cost **[have]** · Gallery curation **[have]**
- Avatar catalog **[have]** · Template/blueprint curation **[have]** · **Environment catalog [gap]**

### F. Trust & Safety · Moderation
- Unified moderation queue: reels, **comments, DMs [gap]**, avatars, templates
- Content-safety rules engine **[have]** · report/flag triage **[gap]**
- Ban / suspend / shadowban · DMCA / takedowns **[gap]** · appeals **[gap]**

### G. Growth · Product · Experimentation
- A/B experiments **[have]** · feature flags **[have]** · cohorts **[have]**
- Product analytics dashboards **[have, rebuild]** · onboarding funnel **[have]**
- Acquisition & attribution (sources, campaigns, UTM) **[gap]**
- SEO/AEO monitoring (tie to the AEO/SEO blog work) **[gap]**
- Announcements / changelog **[have]**

### H. Communications
- Email templates **[have]** · email log **[have]** · notifications center **[have]**
- Support macros **[have]** · broadcast / targeted in-app messaging **[gap]**

### I. Support · Helpdesk
- Ticket triage (`support_messages`) **[have]** · macros **[have]**
- SLA tracking, CSAT, assignment **[gap]** · KB management **[gap]** · **[OSS option]**

### J. System · Infra · Observability · Security
- Service status/uptime **[have]** · edge logs **[have]** · DB health **[have]**
- Crash forensics **[have]** · render observability **[have]** · backups **[have]**
- API keys **[have]** · webhooks **[have]** · secrets **[have]** · sessions **[have]**
- Error tracking **[gap, OSS]** · infra metrics/logs **[gap, OSS]** · rate-limit/WAF view **[gap]**
- Security: RBAC + scopes, anomaly detection, impersonation audit **[partial]**
- Compliance: SOC2 evidence, data-retention policy, audit export **[gap]**

### K. Data · BI · Reporting
- Self-serve BI on a read replica **[gap, OSS — Metabase/Superset]**
- Custom report builder + scheduled exports **[gap]**
- Read-only SQL console for admins **[gap]**
- Event warehouse (ClickHouse) for high-volume analytics **[gap, OSS]**

---

## PART 2 — Deep user analytics & CRM (the core ask)

### User 360 (single screen, everything about one user)
Identity & account (type, tier, status, created, last seen, country, devices) · Credits (balance, lifetime granted/spent, burn rate) · Billing (subscription, MRR, LTV, invoices, refunds, payment health) · Activity (projects, renders, publishes, social: followers/follows/reactions/comments) · **Engagement score** & **churn-risk score** · Funnel position (signup→onboard→first render→publish→pay) · Session history + **session replay** · Support tickets · Referrals (sent/converted) · Feature flags applied · Full audit trail · Notes & tags (CRM) · Actions rail: grant credits, suspend, force tier, impersonate, message, force-logout.

### Metrics catalog (define once, use everywhere)
DAU/WAU/MAU & stickiness (DAU/MAU) · Activation rate (to "aha": first finished film) · N-day & weekly **retention** curves · **Churn** (logo + revenue) & dormancy · **LTV / ARPU / payback** · K-factor / virality · NPS/CSAT · Engagement score (composite) · Conversion by step.

### Analysis tools
- **Segmentation builder** (attributes + behavior) → saved segments reused in CRM/campaigns/flags
- **Cohorts** (signup week, plan, source, behavior) with retention/revenue overlays
- **Funnels** (configurable steps, drop-off, time-to-convert)
- **Path/journey** analysis (what users actually do)
- **Event explorer** + live stream + event taxonomy (instrument every meaningful action)
- **Session replay** (watch real sessions; jump from a user/ticket to their replays)
- **Power users / leaderboard**, **at-risk list**, **new-and-active**
- Predictive (phase 2, ML): churn-risk, LTV prediction, lead scoring

### CRM data model (build on our own data, CRM-grade UX)
`contacts` (every user + lead) · `companies` (orgs) · `deals` (enterprise/business opportunities, stages, value) · `activities` (auto events + manual notes/calls/emails) · `tasks` (assignee, due, SLA) · `tags`, `notes`, `owners`. Pipeline (kanban), contact timeline, company 360, task inbox, segment→campaign hand-off.

---

## PART 3 — Best open-source stack

### Tier 1 — integrate into the app now (frontend libs; power the "slick" rebuild)
- **Tremor** — Tailwind-native dashboard + chart components (KPI cards, area/bar/donut, spark). The fastest path to premium analytics UI; matches our single-accent system. ([guide](https://www.pkgpulse.com/guides/recharts-v3-vs-tremor-vs-nivo-react-charting-2026))
- **Recharts v3** — the default React charting lib (composable, SVG) for custom charts Tremor doesn't cover. ([logrocket](https://blog.logrocket.com/best-react-chart-libraries-2026/))
- **TanStack Table** — headless data grid for the dense admin tables (sort/filter/paginate/virtualize), styled borderless to our system.
- **Nivo / visx** — advanced/bespoke viz (cohort heatmaps, journey/sankey, funnels) when needed.
- Already in repo: **Refine** (admin framework), **TanStack Query**, **cmdk** (palette), framer-motion.

### Tier 2 — adopt as services (self-host or SaaS), same Supabase backend
- **PostHog** — the analytics backbone: product analytics + **session replay** + funnels + retention + feature flags + experiments + surveys in one. Replaces several home-grown pieces. (Self-host needs ClickHouse/Kafka; or PostHog Cloud.) ([userpilot](https://userpilot.com/blog/posthog-alternatives/), [openpanel survey](https://openpanel.dev/articles/open-source-web-analytics)) · lighter alts: **OpenPanel**, **Matomo**, **Umami**.
- **Metabase** (or **Apache Superset**) — self-serve BI / SQL console / scheduled reports on a Postgres read replica. ([estuary](https://estuary.dev/blog/open-source-data-analytics-tools/))
- **Sentry** (or **GlitchTip**) — error tracking & crash forensics (front + edge functions).
- **Grafana + Prometheus + Loki** — infra metrics, logs, uptime dashboards (or lean on Supabase logs first).
- **Meilisearch / Typesense** — fast admin/global search over users/projects/orgs.
- **Listmonk** — lifecycle/marketing email campaigns from segments.
- **Chatwoot** (or **Zammad**) — full support inbox/helpdesk if we outgrow `support_messages`.
- **CRM**: **Twenty** (modern, React/Node, self-host) is the 2026 front-runner; **EspoCRM**/**Frappe CRM** if we want batteries-included. Recommendation: **build CRM-lite on our own tables** (tight integration with users/credits/renders) and optionally sync to Twenty later. ([nutshell](https://www.nutshell.com/blog/best-open-source-crms), [crm.org](https://crm.org/crmland/open-source-crm))
- **Unleash / GrowthBook** — flags/experiments if not using PostHog's.
- **BullMQ + Bull Board** — render-queue/job monitoring.

**Recommended backbone:** PostHog (analytics + replay + flags + surveys + experiments) + Metabase (ad-hoc BI/SQL) + Sentry (errors). Frontend: **Tremor + Recharts + TanStack Table**. This covers ~80% of "measure everything" with minimal custom build, and embeds cleanly into our admin.

---

## PART 4 — Premium design system for the rebuild (match + outmatch the user account)

**Match the Foundation/cinema language** (landing, Studio, Pricing): deep dark (`#06070a`/`#070809`), **single blue accent** `hsl(214 90% 62%)`, **Fraunces** (`font-display`) headings, mono for data/labels, **borderless** glass surfaces (translucent fills `white/[0.03–0.07]`, soft shadows + a 1px top specular highlight — **no ring outlines**), soft accent glows, generous spacing, **white primary CTAs**, accent-underline link hovers.

**Add a "data-dense premium" layer** (admin needs more density than marketing):
- **KPI stat tiles** (big Fraunces number + mono label + sparkline + delta) — like the footer stats, elevated.
- **ChartCard** — Tremor charts themed to the accent on glass, borderless.
- **DataTable** — TanStack Table styled borderless: no gridlines, subtle zebra via `bg-white/[0.015]`, generous row height, sticky header, hover glow, inline actions.
- **InspectorSlideOver** — right-side drawer for entity 360 (user/project/org) without leaving the list.
- **FilterBar** (sticky, borderless chips) · **StatusPill** · **Timeline** · **EmptyState** · **Toolbar/BulkActionBar**.
- **AdminShell** — restyled sidebar + topbar + command palette to the cinema language; live "studio online" + global search + operator card.

**Components to build (the rebuild foundation):** `AdminShell`, `KpiTile`, `ChartCard`, `DataTable`, `FilterBar`, `InspectorSlideOver`, `StatusPill`, `Timeline`, `EmptyState`, `PageHeader`, `SectionCard`. Every one of the ~50 pages is then re-expressed on these primitives.

---

## PART 5 — Execution plan
- **Phase 0 — Foundation:** add Tremor/Recharts/TanStack Table; build the admin design tokens + the 11 primitives above; restyle `AdminShell`.
- **Phase 1 — Flagship pages (set the bar):** Mission-Control Dashboard, User 360, Money cockpit, Production. Approve the look.
- **Phase 2 — Fan-out rebuild:** the remaining ~40 pages onto the primitives (parallelizable — one agent per page).
- **Phase 3 — Wire + new capability pages:** orphans (user/project/org detail, packages) + creator payouts, leads CRM, environment catalog, comment/DM moderation.
- **Phase 4 — Adopt OSS services:** PostHog + Metabase + Sentry; embed dashboards/replays into the relevant admin pages.

_All admin work stays inside the env-gated module (dev/internal build only), against the server-enforced Supabase backend._
