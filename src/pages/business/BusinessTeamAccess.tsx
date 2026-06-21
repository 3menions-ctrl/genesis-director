/**
 * BusinessTeamAccess — /business/team
 *
 * Consolidated people + access-control hub. Folds the former standalone Team,
 * Permissions, and Approvals pages into one cover-hero surface with tabs. Each
 * tab renders the corresponding page's exported Content component (same data
 * paths, same logic). Deep-linkable via ?tab=. Legacy /business/{permissions,
 * approvals} redirect here.
 */
import { useSearchParams } from "react-router-dom";
import { Users, ShieldCheck, CheckCircle2 } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, BusinessTabs, type BusinessTab } from "@/components/business/BusinessPage";
import { TeamContent } from "./BusinessTeam";
import { PermissionsContent } from "./BusinessPermissions";
import { ApprovalsContent } from "./BusinessApprovals";

const TABS: BusinessTab[] = [
  { key: "members", label: "Members", icon: Users },
  { key: "permissions", label: "Permissions", icon: ShieldCheck },
  { key: "approvals", label: "Approvals", icon: CheckCircle2 },
];

export default function BusinessTeamAccess() {
  usePageMeta({ title: "Team & Access — Business" });
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const active = TABS.some((t) => t.key === requested) ? (requested as string) : "members";

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
          <span className="text-[hsl(215,100%,72%)]">Govern</span>
          <span className="text-white/20">·</span>
          <span>People &amp; access</span>
        </>
      }
      title="Team & Access."
      subtitle="Your roster and invites, the role permission matrix, and the production approval queue — together."
    >
      <BusinessTabs tabs={TABS} active={active} onChange={setTab} />
      {active === "members" && <TeamContent />}
      {active === "permissions" && <PermissionsContent />}
      {active === "approvals" && <ApprovalsContent />}
    </BusinessPage>
  );
}
