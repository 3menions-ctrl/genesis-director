/**
 * BusinessPermissions — /business/permissions
 *
 * The role × capability matrix for the workspace, reusing the exact data
 * from WorkspacePermissions, re-skinned into the borderless cover-hero
 * BusinessPage language. Admin-gated; roles are assigned on the Team page.
 */
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { useWorkspace, type OrgRole } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead, EmptyState, Badge } from "@/components/business/BusinessPage";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";

const ROLES = ['owner', 'admin', 'producer', 'reviewer', 'viewer'] as const;

const MATRIX: { capability: string; allowed: typeof ROLES[number][] }[] = [
  { capability: 'View workspace',       allowed: ['owner','admin','producer','reviewer','viewer'] },
  { capability: 'Create projects',      allowed: ['owner','admin','producer'] },
  { capability: 'Spend org credits',    allowed: ['owner','admin','producer'] },
  { capability: 'Approve / publish',    allowed: ['owner','admin','reviewer'] },
  { capability: 'Edit brand kit',       allowed: ['owner','admin','producer'] },
  { capability: 'Manage assets',        allowed: ['owner','admin','producer'] },
  { capability: 'Invite members',       allowed: ['owner','admin'] },
  { capability: 'Change roles',         allowed: ['owner','admin'] },
  { capability: 'Manage billing',       allowed: ['owner','admin'] },
  { capability: 'Delete workspace',     allowed: ['owner'] },
];

export function PermissionsContent() {
  const { currentOrg, hasPermission } = useWorkspace();
  const canManage = hasPermission("admin");
  const [roleCounts, setRoleCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let active = true;
    if (!currentOrg || !canManage) { setRoleCounts(null); return; }
    void (async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", currentOrg.id);
      if (!active) return;
      if (error || !data) { setRoleCounts(null); return; }
      const counts: Record<string, number> = {};
      for (const m of data) counts[m.role as OrgRole] = (counts[m.role as OrgRole] ?? 0) + 1;
      setRoleCounts(counts);
    })();
    return () => { active = false; };
  }, [currentOrg, canManage]);

  return (
    <>
      {!canManage ? (
        <EmptyState
          icon={Lock}
          title="Admin access required."
          description="Only workspace admins and owners can view the permissions matrix."
        />
      ) : (
        <>
          <SectionHead label="Capability matrix" count={`${MATRIX.length} capabilities`} />
          <div className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.015] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className={cn(TYPE_META, "px-5 py-3.5 text-white/45")}>Capability</th>
                    {ROLES.map((r) => (
                      <th key={r} className={cn(TYPE_META, "px-3 py-3.5 text-white/45 text-center")}>
                        <div className="flex flex-col items-center gap-1.5">
                          <span>{r}</span>
                          {roleCounts && (
                            <Badge tone={roleCounts[r] ? "accent" : "neutral"}>
                              {roleCounts[r] ?? 0} {roleCounts[r] === 1 ? "member" : "members"}
                            </Badge>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {MATRIX.map((row) => (
                    <tr key={row.capability} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 text-[13px] text-white/85">{row.capability}</td>
                      {ROLES.map((r) => (
                        <td key={r} className="px-3 py-3.5 text-center">
                          {row.allowed.includes(r)
                            ? <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(215,100%,72%)]" />
                            : <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/10" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3.5 border-t border-white/[0.06] flex items-center gap-2.5 flex-wrap">
              <Badge tone="warn">Read-only</Badge>
              <span className="text-[12px] text-white/45 font-light">Custom role policies coming with the Enterprise tier.</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function BusinessPermissions() {
  usePageMeta({ title: "Permissions — Business" });
  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Govern</span><span className="text-white/20">·</span><span>Role matrix</span></>}
      title="Permissions."
      subtitle="The capability matrix for every role inside the workspace. Roles are assigned on the Team page."
    >
      <PermissionsContent />
    </BusinessPage>
  );
}
