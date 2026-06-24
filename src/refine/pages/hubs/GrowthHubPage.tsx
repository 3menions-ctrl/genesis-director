/**
 * GrowthHubPage — /admin/growth
 *
 * Absorbs: Analytics · Onboarding analytics · Experiments · Cohorts ·
 *          Feature flags · Announcements · Macros · Email templates ·
 *          Notifications · Changelog · Avatar catalog · Gallery curation ·
 *          Templates · Content safety.
 *
 * "Growth" here is the broad sense — anything that shapes what users see,
 * what they get prompted with, what content the gallery surfaces.
 */
import { lazy, Suspense } from "react";
import { AdminHubShell, HubTab } from "../../components/AdminHubShell";
import { Spinner } from "@/components/ui/Spinner";

const Overview              = lazy(() => import("./decks/GrowthOverview"));
const Events                = lazy(() => import("../ops/AdminEventsPage"));
const Traffic               = lazy(() => import("../ops/AdminTrafficPage"));
const Insights              = lazy(() => import("../ops/AdminInsightsPage"));
const Analytics             = lazy(() => import("../ops/AdminAnalyticsPage"));
const Projections           = lazy(() => import("../ops/AdminProjectionsPage"));
const OnboardingAnalytics   = lazy(() => import("../ops/AdminOnboardingAnalyticsPage"));
const Experiments           = lazy(() => import("../ops/AdminExperimentsPage"));
const Cohorts               = lazy(() => import("../ops/AdminCohortsPage"));
const FeatureFlags          = lazy(() => import("../ops/AdminFeatureFlagsPage"));
const Announcements         = lazy(() => import("../ops/AdminAnnouncementsPage"));
const Macros                = lazy(() => import("../ops/AdminMacrosPage"));
const EmailTemplates        = lazy(() => import("../ops/AdminEmailTemplatesPage"));
const Notifications         = lazy(() => import("../ops/AdminNotificationsPage"));
const Changelog             = lazy(() => import("../ops/AdminChangelogPage"));
const AvatarCatalog         = lazy(() => import("../ops/AdminAvatarCatalogPage"));
const GalleryCuration       = lazy(() => import("../ops/AdminGalleryCurationPage"));
const Templates             = lazy(() => import("../ops/AdminTemplatesAdminPage"));
const ContentSafety         = lazy(() => import("../ops/AdminContentSafetyPage"));
const Comments              = lazy(() => import("../ops/AdminCommentsPage"));

const wrap = (Comp: React.ComponentType) => (
  <Suspense fallback={
    <div className="flex items-center justify-center py-24 gap-3 text-white/55">
      <Spinner size="md" tone="muted" />
      <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading section…</span>
    </div>
  }>
    <Comp />
  </Suspense>
);

export default function GrowthHubPage() {
  const tabs: HubTab[] = [
    { id: "overview",        label: "Overview",        suggested: true, render: () => wrap(Overview) },
    { id: "events",          label: "Events",          render: () => wrap(Events) },
    { id: "traffic",         label: "Traffic",         render: () => wrap(Traffic) },
    { id: "insights",        label: "Insights",        render: () => wrap(Insights) },
    { id: "analytics",       label: "Analytics",       render: () => wrap(Analytics) },
    { id: "projections",     label: "Projections",     render: () => wrap(Projections) },
    { id: "onboarding",      label: "Onboarding",      render: () => wrap(OnboardingAnalytics) },
    { id: "experiments",     label: "A/B Tests",       render: () => wrap(Experiments) },
    { id: "cohorts",         label: "Cohorts",         render: () => wrap(Cohorts) },
    { id: "feature-flags",   label: "Flags",           render: () => wrap(FeatureFlags) },
    { id: "announcements",   label: "News",            render: () => wrap(Announcements) },
    { id: "macros",          label: "Macros",          render: () => wrap(Macros) },
    { id: "email-templates", label: "Email",           render: () => wrap(EmailTemplates) },
    { id: "notifications",   label: "Notify",          render: () => wrap(Notifications) },
    { id: "changelog",       label: "Changelog",       render: () => wrap(Changelog) },
    { id: "avatar-catalog",  label: "Avatars",         render: () => wrap(AvatarCatalog) },
    { id: "gallery",         label: "Gallery",         render: () => wrap(GalleryCuration) },
    { id: "templates",       label: "Templates",       render: () => wrap(Templates) },
    { id: "content-safety",  label: "Safety",          render: () => wrap(ContentSafety) },
    { id: "comments",        label: "Comments",        render: () => wrap(Comments) },
  ];

  return (
    <AdminHubShell
      eyebrow="07 // GROWTH"
      code="HUB"
      title="Growth"
      italic="Hub."
      description="Analytics, experiments, content curation, communication — every lever that shapes the user experience."
      tabs={tabs}
      defaultTab="overview"
    />
  );
}
