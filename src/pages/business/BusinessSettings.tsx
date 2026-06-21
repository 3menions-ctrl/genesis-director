/**
 * BusinessSettings — /business/settings
 *
 * Consolidated workspace settings hub. Folds the former standalone General,
 * Security, Notifications, and Danger pages into one cover-hero surface with
 * tabs. Each tab renders the corresponding page's exported Content component
 * (same data paths, same logic) under a single shared hero. Deep-linkable via
 * ?tab=. Legacy /business/{general,security,notifications,danger} redirect here.
 */
import { useSearchParams } from "react-router-dom";
import { Settings as SettingsIcon, Shield, Bell, AlertOctagon } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, BusinessTabs, type BusinessTab } from "@/components/business/BusinessPage";
import { GeneralSettingsContent } from "./BusinessGeneral";
import { SecurityContent } from "./BusinessSecurity";
import { NotificationsContent } from "./BusinessNotifications";
import { DangerContent } from "./BusinessDanger";

const TABS: BusinessTab[] = [
  { key: "general", label: "General", icon: SettingsIcon },
  { key: "security", label: "Security", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "danger", label: "Danger", icon: AlertOctagon },
];

export default function BusinessSettings() {
  usePageMeta({ title: "Settings — Business" });
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const active = TABS.some((t) => t.key === requested) ? (requested as string) : "general";

  const setTab = (key: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", key);
        return next;
      },
      { replace: true },
    );

  return (
    <BusinessPage
      eyebrow={
        <>
          <span className="text-[hsl(215,100%,72%)]">Settings</span>
          <span className="text-white/20">·</span>
          <span>Workspace controls</span>
        </>
      }
      title="Settings."
      subtitle="Workspace identity, security posture, notification routing, and destructive actions — all in one place."
    >
      <BusinessTabs tabs={TABS} active={active} onChange={setTab} />
      {active === "general" && <GeneralSettingsContent />}
      {active === "security" && <SecurityContent />}
      {active === "notifications" && <NotificationsContent />}
      {active === "danger" && <DangerContent />}
    </BusinessPage>
  );
}
