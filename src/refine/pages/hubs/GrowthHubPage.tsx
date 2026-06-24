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
import { ClusterTabs } from "../../components/ClusterTabs";
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
  // Consolidated from 19 flat tabs into 4 clusters + the overview. Each cluster
  // holds its member pages behind a second-level ClusterTabs strip, so the hub
  // tab bar stays short while every page remains one click away. The Overview
  // deck deep-links into these clusters.
  const tabs: HubTab[] = [
    { id: "overview", label: "Overview", suggested: true, render: () => wrap(Overview) },
    { id: "analytics", label: "Analytics", render: () => (
      <ClusterTabs tabs={[
        { id: "traffic",     label: "Traffic",     render: () => wrap(Traffic) },
        { id: "events",      label: "Events",      render: () => wrap(Events) },
        { id: "insights",    label: "Insights",    render: () => wrap(Insights) },
        { id: "analytics",   label: "Deep dive",   render: () => wrap(Analytics) },
        { id: "projections", label: "Projections", render: () => wrap(Projections) },
      ]} />
    ) },
    { id: "experiments", label: "Experiments", render: () => (
      <ClusterTabs tabs={[
        { id: "experiments", label: "A/B Tests",  render: () => wrap(Experiments) },
        { id: "cohorts",     label: "Cohorts",    render: () => wrap(Cohorts) },
        { id: "onboarding",  label: "Onboarding", render: () => wrap(OnboardingAnalytics) },
        { id: "flags",       label: "Flags",      render: () => wrap(FeatureFlags) },
      ]} />
    ) },
    { id: "content", label: "Content", render: () => (
      <ClusterTabs tabs={[
        { id: "gallery",   label: "Gallery",   render: () => wrap(GalleryCuration) },
        { id: "templates", label: "Templates", render: () => wrap(Templates) },
        { id: "avatars",   label: "Avatars",   render: () => wrap(AvatarCatalog) },
        { id: "safety",    label: "Safety",    render: () => wrap(ContentSafety) },
        { id: "comments",  label: "Comments",  render: () => wrap(Comments) },
      ]} />
    ) },
    { id: "comms", label: "Comms", render: () => (
      <ClusterTabs tabs={[
        { id: "announcements", label: "News",      render: () => wrap(Announcements) },
        { id: "changelog",     label: "Changelog", render: () => wrap(Changelog) },
        { id: "notifications", label: "Notify",    render: () => wrap(Notifications) },
        { id: "email",         label: "Email",     render: () => wrap(EmailTemplates) },
        { id: "macros",        label: "Macros",    render: () => wrap(Macros) },
      ]} />
    ) },
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
