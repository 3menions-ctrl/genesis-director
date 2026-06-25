/**
 * BusinessNotifications — /business/notifications
 *
 * Workspace-wide notification routing rules, org-scoped. Reuses the exact
 * org_notification_prefs query / upsert / audit-event logic from
 * WorkspaceNotifications, re-skinned in the cover-hero BusinessPage language
 * with borderless toggle rows. Admin-gated as the original.
 */
import { useEffect, useState, useCallback } from "react";
import { Save } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead, SkeletonRows } from "@/components/business/BusinessPage";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safeErrorMessage";

type ChannelKey = "email" | "in_app";

interface RouteSpec {
  key: string;
  event: string;
  to: string;
  channels: ChannelKey[];
  defaultEnabled: boolean;
}

const ROUTES: RouteSpec[] = [
  { key: "member_joined",      event: "Member joined",        to: "Owners + Admins", channels: ["email", "in_app"], defaultEnabled: true },
  { key: "role_changed",       event: "Role changed",         to: "Member affected", channels: ["email", "in_app"], defaultEnabled: true },
  { key: "credits_low",        event: "Credits low (<10%)",   to: "Owners + Admins", channels: ["email", "in_app"], defaultEnabled: true },
  { key: "production_failed",  event: "Production failed",    to: "Project owner",   channels: ["in_app"],          defaultEnabled: true },
  { key: "approval_requested", event: "Approval requested",   to: "Reviewers",       channels: ["in_app"],          defaultEnabled: true },
  { key: "invoice_ready",      event: "Invoice ready",        to: "Billing email",   channels: ["email"],           defaultEnabled: true },
];

type PrefsMap = Record<string, { enabled: boolean; channels: Record<ChannelKey, boolean> }>;

function defaultPrefs(): PrefsMap {
  const out: PrefsMap = {};
  for (const r of ROUTES) {
    const channels: Record<ChannelKey, boolean> = { email: false, in_app: false };
    for (const c of r.channels) channels[c] = true;
    out[r.key] = { enabled: r.defaultEnabled, channels };
  }
  return out;
}

export function NotificationsContent() {
  const { currentOrg, hasPermission } = useWorkspace();
  const { user } = useAuth();
  const canEdit = hasPermission("admin");
  const [prefs, setPrefs] = useState<PrefsMap>(defaultPrefs());
  const [original, setOriginal] = useState<PrefsMap>(defaultPrefs());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from("org_notification_prefs")
      .select("prefs")
      .eq("organization_id", currentOrg.id)
      .maybeSingle();
    const merged = defaultPrefs();
    const stored = (data?.prefs as PrefsMap | null) ?? null;
    if (stored) {
      for (const k of Object.keys(merged)) {
        if (stored[k]) merged[k] = { ...merged[k], ...stored[k], channels: { ...merged[k].channels, ...(stored[k].channels ?? {}) } };
      }
    }
    setPrefs(merged);
    setOriginal(merged);
    setLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => { load(); }, [load]);

  const dirty = JSON.stringify(prefs) !== JSON.stringify(original);

  const save = async () => {
    if (!currentOrg || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("org_notification_prefs")
      .upsert({ organization_id: currentOrg.id, prefs: prefs as unknown as Record<string, unknown>, updated_by: user.id }, { onConflict: "organization_id" });
    setSaving(false);
    if (error) { toast.error(safeErrorMessage(error, "Couldn't save notification settings.")); return; }
    toast.success("Notification routing saved");
    setOriginal(prefs);
    await supabase.from("workspace_audit_events").insert({
      organization_id: currentOrg.id, actor_id: user.id,
      category: "settings", action: "notifications.updated",
      target_kind: "org", target_id: currentOrg.id,
    });
  };

  const toggleEnabled = (key: string) => {
    setPrefs((p) => ({ ...p, [key]: { ...p[key], enabled: !p[key].enabled } }));
  };
  const toggleChannel = (key: string, ch: ChannelKey) => {
    setPrefs((p) => ({ ...p, [key]: { ...p[key], channels: { ...p[key].channels, [ch]: !p[key].channels[ch] } } }));
  };

  const saveAction = canEdit ? (
    <button
      type="button"
      disabled={!dirty || saving}
      onClick={save}
      className="inline-flex items-center gap-2 rounded-full px-4 h-9 bg-[hsl(215,90%,55%)] text-white text-[12px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors disabled:opacity-40 disabled:hover:bg-[hsl(215,90%,55%)]"
    >
      <Save className="w-3.5 h-3.5" strokeWidth={1.8} /> {saving ? "Saving…" : "Save changes"}
    </button>
  ) : (
    <span className={cn(TYPE_META, "inline-flex items-center h-7 px-3 rounded-full ring-1 ring-white/[0.07] text-white/45")}>Read only</span>
  );

  return (
    <>
      <SectionHead label="Event routing" count={loading ? undefined : ROUTES.length} action={saveAction} />
      <p className="-mt-1 mb-5 text-[13px] text-white/45">Defaults applied to every member of this workspace.</p>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="rounded-2xl divide-y divide-white/[0.05]">
          {ROUTES.map((r) => {
            const p = prefs[r.key];
            return (
              <div key={r.key} className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] text-white/90 font-light truncate">{r.event}</div>
                  <div className={cn(TYPE_META, "mt-1 text-white/35")}>{r.to}</div>
                </div>

                <div className="flex items-center gap-5">
                  <label className={cn("flex items-center gap-2 text-[12px] transition-colors", p.enabled ? "text-white/65" : "text-white/30")}>
                    <input
                      type="checkbox"
                      disabled={!canEdit || !p.enabled}
                      checked={p.channels.email}
                      onChange={() => toggleChannel(r.key, "email")}
                      className="accent-[hsl(215,100%,55%)] disabled:opacity-40"
                    />
                    Email
                  </label>
                  <label className={cn("flex items-center gap-2 text-[12px] transition-colors", p.enabled ? "text-white/65" : "text-white/30")}>
                    <input
                      type="checkbox"
                      disabled={!canEdit || !p.enabled}
                      checked={p.channels.in_app}
                      onChange={() => toggleChannel(r.key, "in_app")}
                      className="accent-[hsl(215,100%,55%)] disabled:opacity-40"
                    />
                    In-app
                  </label>

                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => toggleEnabled(r.key)}
                    className={cn(
                      "relative inline-flex h-5 w-9 rounded-full transition ring-1 disabled:opacity-50",
                      p.enabled ? "bg-[hsl(215,90%,45%)] ring-[hsl(215,100%,55%)]/50" : "bg-white/[0.05] ring-white/[0.08]",
                    )}
                    aria-pressed={p.enabled}
                    aria-label={`Toggle ${r.event}`}
                  >
                    <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", p.enabled ? "left-[18px]" : "left-0.5")} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function BusinessNotifications() {
  usePageMeta({ title: "Notifications — Business" });
  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Extend</span><span className="text-white/20">·</span><span>Routing rules</span></>}
      title="Notifications."
      subtitle="Workspace-wide notification routing rules. Members can additionally tune their personal preferences."
    >
      <NotificationsContent />
    </BusinessPage>
  );
}
