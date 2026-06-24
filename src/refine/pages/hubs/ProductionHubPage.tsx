/**
 * ProductionHubPage — /admin/production-hub
 *
 * Absorbs: Projects · Production · Queue · Providers · Edge Logs · Status ·
 *          Crash Forensics · DB Health · Storage · Backups.
 *
 * The split between "Projects" (content registry) and "Production"
 * (pipeline pressure / failures) was confusing in the old shell — both
 * live here now as adjacent tabs.
 */
import { lazy, Suspense } from "react";
import { AdminHubShell, HubTab } from "../../components/AdminHubShell";
import { Spinner } from "@/components/ui/Spinner";

const Overview       = lazy(() => import("./decks/ProductionOverview"));
const Projects       = lazy(() => import("../AdminProjectsPage"));
const Production     = lazy(() => import("../AdminProductionPage"));
const Queue          = lazy(() => import("../ops/AdminQueuePage"));
const Providers      = lazy(() => import("../ops/AdminProvidersPage"));
const EdgeLogs       = lazy(() => import("../ops/AdminEdgeLogsPage"));
const Status         = lazy(() => import("../ops/AdminStatusPage"));
const CrashForensics = lazy(() => import("../ops/AdminCrashForensicsPage"));
const DbHealth       = lazy(() => import("../ops/AdminDbHealthPage"));
const Storage        = lazy(() => import("../ops/AdminStoragePage"));
const Backups        = lazy(() => import("../ops/AdminBackupsPage"));

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

export default function ProductionHubPage() {
  const tabs: HubTab[] = [
    { id: "overview",   label: "Overview",   suggested: true, render: () => wrap(Overview) },
    { id: "projects",   label: "Projects",   render: () => wrap(Projects) },
    { id: "production", label: "Production", render: () => wrap(Production) },
    { id: "queue",      label: "Queue",      render: () => wrap(Queue) },
    { id: "providers",  label: "Providers",  render: () => wrap(Providers) },
    { id: "edge-logs",  label: "Edge logs",  render: () => wrap(EdgeLogs) },
    { id: "status",     label: "Status",     render: () => wrap(Status) },
    { id: "crash",      label: "Crash",      render: () => wrap(CrashForensics) },
    { id: "db-health",  label: "DB health",  render: () => wrap(DbHealth) },
    { id: "storage",    label: "Storage",    render: () => wrap(Storage) },
    { id: "backups",    label: "Backups",    render: () => wrap(Backups) },
  ];

  return (
    <AdminHubShell
      eyebrow="04 // CONTENT"
      code="HUB"
      title="Production"
      italic="Hub."
      description="Everything that moves video through the pipeline — content, queues, providers, telemetry, recovery."
      tabs={tabs}
      defaultTab="overview"
    />
  );
}
