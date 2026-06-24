/**
 * SystemHubPage — /admin/system
 *
 * Absorbs: Config · Audit · API Keys · Webhooks · Secrets · Emails ·
 *          Moderation. The "engine room" hub.
 */
import { lazy, Suspense } from "react";
import { AdminHubShell, HubTab } from "../../components/AdminHubShell";
import { Spinner } from "@/components/ui/Spinner";

const Config        = lazy(() => import("../AdminConfigPage"));
const DbDiagnostics = lazy(() => import("../ops/AdminDbDiagnosticsPage"));
const Audit         = lazy(() => import("../ops/AdminAuditLogPage"));
const ApiKeys       = lazy(() => import("../ops/AdminApiKeysPage"));
const Webhooks      = lazy(() => import("../ops/AdminWebhooksPage"));
const Secrets       = lazy(() => import("../ops/AdminSecretsPage"));
const Emails        = lazy(() => import("../AdminEmailsPage"));
const Moderation    = lazy(() => import("../AdminModerationPage"));

const wrap = (Comp: React.ComponentType) => (
  <Suspense fallback={
    <div className="flex items-center justify-center py-24 gap-3 text-[#5d6a82]">
      <Spinner size="md" tone="muted" />
      <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading section…</span>
    </div>
  }>
    <Comp />
  </Suspense>
);

export default function SystemHubPage() {
  const tabs: HubTab[] = [
    { id: "config",      label: "Config",      suggested: true, render: () => wrap(Config) },
    { id: "diagnostics", label: "Diagnostics", render: () => wrap(DbDiagnostics) },
    { id: "audit",       label: "Audit",       render: () => wrap(Audit) },
    { id: "api-keys",   label: "API Keys",   render: () => wrap(ApiKeys) },
    { id: "webhooks",   label: "Webhooks",   render: () => wrap(Webhooks) },
    { id: "secrets",    label: "Secrets",    render: () => wrap(Secrets) },
    { id: "emails",     label: "Emails",     render: () => wrap(Emails) },
    { id: "moderation", label: "Moderation", render: () => wrap(Moderation) },
  ];

  return (
    <AdminHubShell
      eyebrow="09 // SYSTEM"
      code="HUB"
      title="System"
      italic="Hub."
      description="Engine room. Config, security, integrations, raw audit trail — the bedrock."
      tabs={tabs}
      defaultTab="config"
    />
  );
}
