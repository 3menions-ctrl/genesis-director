/**
 * PeopleHubPage — /admin/people
 *
 * Absorbs: Users · Inbox · Team · Roles · Sessions · GDPR · Abuse · Referrals.
 * Tabs render the existing premium pages in embedded mode, so this is a
 * pure consolidation — no functionality lost, but the operator no longer
 * needs to know that "Roles" and "Sessions" are two separate routes.
 */
import { lazy, Suspense } from "react";
import { AdminHubShell, HubTab } from "../../components/AdminHubShell";
import { Spinner } from "@/components/ui/Spinner";

const Users         = lazy(() => import("../AdminUsersPage"));
const Orgs          = lazy(() => import("../ops/AdminOrgsPage"));
const Messages      = lazy(() => import("../AdminMessagesPage"));
const Team          = lazy(() => import("../ops/AdminTeamPage"));
const Roles         = lazy(() => import("../ops/AdminRolesPage"));
const Sessions      = lazy(() => import("../ops/AdminSessionsPage"));
const Gdpr          = lazy(() => import("../ops/AdminGdprPage"));
const Abuse         = lazy(() => import("../ops/AdminAbusePage"));
const Referrals     = lazy(() => import("../ops/AdminReferralsPage"));

const wrap = (Comp: React.ComponentType) => (
  <Suspense fallback={<TabFallback />}>
    <Comp />
  </Suspense>
);

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-24 gap-3 text-white/55">
      <Spinner size="md" tone="muted" />
      <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading section…</span>
    </div>
  );
}

export default function PeopleHubPage() {
  const tabs: HubTab[] = [
    { id: "users",     label: "Users",     suggested: true, render: () => wrap(Users) },
    { id: "orgs",      label: "Orgs",      render: () => wrap(Orgs) },
    { id: "messages",  label: "Inbox",     render: () => wrap(Messages) },
    { id: "team",      label: "Team",      render: () => wrap(Team) },
    { id: "roles",     label: "Roles",     render: () => wrap(Roles) },
    { id: "sessions",  label: "Sessions",  render: () => wrap(Sessions) },
    { id: "gdpr",      label: "GDPR",      render: () => wrap(Gdpr) },
    { id: "abuse",     label: "Abuse",     render: () => wrap(Abuse) },
    { id: "referrals", label: "Referrals", render: () => wrap(Referrals) },
  ];

  return (
    <AdminHubShell
      eyebrow="02 // PEOPLE"
      code="HUB"
      title="People"
      italic="Hub."
      description="Every per-person operation in one place — identity, access, communication, compliance, safety."
      tabs={tabs}
      defaultTab="users"
    />
  );
}
