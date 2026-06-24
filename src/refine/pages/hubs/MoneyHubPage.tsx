/**
 * MoneyHubPage — /admin/money
 *
 * Absorbs: Finance · Credits ledger · Subscriptions · Refunds · Coupons ·
 *          Invoices · Reconcile.
 */
import { lazy, Suspense } from "react";
import { AdminHubShell, HubTab } from "../../components/AdminHubShell";
import { Spinner } from "@/components/ui/Spinner";

const Overview      = lazy(() => import("./decks/MoneyOverview"));
const Finance       = lazy(() => import("../AdminFinancePage"));
const Pnl           = lazy(() => import("../ops/AdminPnlPage"));
const StorageBilling = lazy(() => import("../ops/AdminStorageBillingPage"));
const Credits       = lazy(() => import("../AdminCreditsPage"));
const Subscriptions = lazy(() => import("../ops/AdminSubscriptionsPage"));
const Refunds       = lazy(() => import("../ops/AdminRefundsPage"));
const Coupons       = lazy(() => import("../ops/AdminCouponsPage"));
const Invoices      = lazy(() => import("../ops/AdminInvoicesPage"));
const Reconcile     = lazy(() => import("../ops/AdminReconcilePage"));

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

export default function MoneyHubPage() {
  const tabs: HubTab[] = [
    { id: "overview",      label: "Overview",      suggested: true, render: () => wrap(Overview) },
    { id: "finance",       label: "Treasury",      render: () => wrap(Finance) },
    { id: "pnl",           label: "P&L",           render: () => wrap(Pnl) },
    { id: "storage",       label: "Storage",       render: () => wrap(StorageBilling) },
    { id: "credits",       label: "Ledger",        render: () => wrap(Credits) },
    { id: "subscriptions", label: "Subscriptions", render: () => wrap(Subscriptions) },
    { id: "refunds",       label: "Refunds",       render: () => wrap(Refunds) },
    { id: "coupons",       label: "Coupons",       render: () => wrap(Coupons) },
    { id: "invoices",      label: "Invoices",      render: () => wrap(Invoices) },
    { id: "reconcile",     label: "Reconcile",     render: () => wrap(Reconcile) },
  ];

  return (
    <AdminHubShell
      eyebrow="03 // MONEY"
      code="HUB"
      title="Money"
      italic="Hub."
      description="Treasury, ledger, billing — every dollar in and out of the membrane in one place."
      tabs={tabs}
      defaultTab="overview"
    />
  );
}
