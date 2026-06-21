/**
 * BusinessIntegrations — /business/integrations
 *
 * Re-skin of WorkspaceIntegrations in the cover-hero BusinessPage language.
 * Reuses the exact same data/logic: org webhook RPCs (Slack/Zapier), the
 * workspace_integrations OAuth rows (Google Drive/Notion), connect/disconnect
 * handlers, and the OAuth callback toast bounce. Admin-gated as the original.
 * Premium connector cards with a KPI row, status badges, and relative sync time.
 */
import { useEffect, useState, useCallback } from "react";
import { Slack, Zap, Cloud, Database, Check, Send, ExternalLink, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { confirmAsync } from "@/components/ui/global-confirm";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead, StatCard, Badge } from "@/components/business/BusinessPage";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import { toast } from "sonner";

type OAuthProvider = "google_drive" | "notion";

interface OAuthRow {
  id: string;
  provider: OAuthProvider;
  display_name: string | null;
  external_account_id: string | null;
  status: "active" | "revoked" | "expired" | "error";
  connected_at: string;
  last_synced_at: string | null;
}

type Kind = "slack" | "zapier";

/** Compact "2h ago" style relative time. */
function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function CardShell({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.015] p-5 transition-colors hover:ring-white/[0.12] hover:bg-white/[0.025]">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl ring-1 ring-white/[0.07] bg-gradient-to-br from-white/[0.06] to-white/[0.015] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[hsl(215,100%,72%)]" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-full px-4 h-9 bg-[hsl(215,90%,55%)] text-white text-[12px] font-medium hover:bg-[hsl(215,90%,60%)] transition-colors disabled:opacity-40 disabled:pointer-events-none";
const BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded-full px-4 h-9 ring-1 ring-white/[0.08] text-white/70 text-[12px] hover:text-white hover:ring-white/15 transition-colors disabled:opacity-40 disabled:pointer-events-none";

function WebhookIntegration({
  kind, icon: Icon, name, blurb, placeholder, currentUrl, canEdit, onSaved,
}: {
  kind: Kind; icon: LucideIcon; name: string; blurb: string; placeholder: string;
  currentUrl: string | null; canEdit: boolean; onSaved: () => void;
}) {
  const { currentOrg } = useWorkspace();
  const [url, setUrl] = useState(currentUrl ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setUrl(currentUrl ?? ""); }, [currentUrl]);
  const connected = !!currentUrl;

  const save = async (next: string | null) => {
    if (!currentOrg) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_org_integration_webhook", {
      p_org: currentOrg.id, p_kind: kind, p_url: next,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(next ? `${name} connected` : `${name} disconnected`);
    onSaved();
  };

  const test = async () => {
    if (!currentOrg) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("notify-org-event", {
      body: { kind, event: "test", message: `Test ping from ${name} integration on Small Bridges.` },
    });
    setBusy(false);
    const dataErr = (data as { error?: string } | null)?.error;
    if (error || dataErr) toast.error(dataErr || error?.message || "Test failed");
    else toast.success("Test sent");
  };

  return (
    <CardShell icon={Icon}>
      <div className="flex items-center gap-2">
        <div className="text-[14px] text-white/95 font-display italic">{name}</div>
        {connected ? <Badge tone="good">CONNECTED</Badge> : <Badge tone="neutral">NOT CONNECTED</Badge>}
      </div>
      <p className="text-[12px] text-white/45 mt-1 font-light">{blurb}</p>
      <div className="mt-3">
        <div className={cn(TYPE_META, "text-white/40 mb-1.5")}>Webhook URL</div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholder}
          disabled={!canEdit}
          className="w-full h-10 px-3.5 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[13px] text-white placeholder:text-white/30 outline-none transition disabled:opacity-50"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={BTN_PRIMARY} disabled={!canEdit || busy || url === (currentUrl ?? "")} onClick={() => save(url.trim() || null)}>
          <Check className="w-3 h-3" /> {connected ? "Update" : "Connect"}
        </button>
        {connected && (
          <>
            <button type="button" className={BTN_GHOST} disabled={busy} onClick={test}>
              <Send className="w-3 h-3" /> Send test
            </button>
            <button type="button" className={BTN_GHOST} disabled={!canEdit || busy} onClick={() => save(null)}>Disconnect</button>
          </>
        )}
      </div>
    </CardShell>
  );
}

function OAuthIntegration({
  provider, icon: Icon, name, blurb, scopes,
  connection, canEdit, onChanged,
}: {
  provider: OAuthProvider;
  icon: LucideIcon;
  name: string;
  blurb: string;
  scopes?: string;
  connection: OAuthRow | undefined;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { currentOrg } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const connected = !!connection && connection.status === "active";

  const connect = async () => {
    if (!currentOrg) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in required");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-authorize`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider,
            organizationId: currentOrg.id,
            returnUrl: window.location.origin + "/business/integrations",
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.authorizeUrl) {
        throw new Error(body.error || `Connect failed (${res.status})`);
      }
      // Redirect user to the provider's authorize page.
      window.location.href = body.authorizeUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start connect flow");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!connection) return;
    if (!await confirmAsync(`Disconnect ${name}? Future automations using this connection will stop.`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("workspace_integrations")
      .update({ status: "revoked" })
      .eq("id", connection.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${name} disconnected`);
    onChanged();
  };

  const errored = connection?.status === "error";

  return (
    <CardShell icon={Icon}>
      <div className="flex items-center gap-2">
        <div className="text-[14px] text-white/95 font-display italic">{name}</div>
        {connected
          ? <Badge tone="good">CONNECTED</Badge>
          : errored
            ? <Badge tone="bad">ERROR</Badge>
            : <Badge tone="neutral">NOT CONNECTED</Badge>}
      </div>
      <p className="text-[12px] text-white/45 mt-1 font-light">{blurb}</p>
      {connection && connected && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55 font-mono">
          {connection.display_name && <span className="text-white/70">{connection.display_name}</span>}
          <span>Connected {relativeTime(connection.connected_at)}</span>
          {connection.last_synced_at && <span className="text-white/40">· Synced {relativeTime(connection.last_synced_at)}</span>}
        </div>
      )}
      {errored && (
        <div className="mt-3 text-[11px] text-rose-300/80 font-mono">
          Connection errored — reconnect to resume syncing.
        </div>
      )}
      {scopes && !connected && (
        <div className="mt-3 text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">
          Scope · {scopes}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!connected ? (
          <button type="button" className={BTN_PRIMARY} disabled={!canEdit || busy} onClick={connect}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
            {errored ? `Reconnect ${name}` : `Connect ${name}`}
          </button>
        ) : (
          <button type="button" className={BTN_GHOST} disabled={!canEdit || busy} onClick={disconnect}>
            Disconnect
          </button>
        )}
      </div>
    </CardShell>
  );
}

export default function BusinessIntegrations() {
  usePageMeta({ title: "Integrations — Business" });

  const { currentOrg, hasPermission } = useWorkspace();
  const canEdit = hasPermission("admin");
  const [searchParams, setSearchParams] = useSearchParams();
  const [slack, setSlack] = useState<string | null>(null);
  const [zapier, setZapier] = useState<string | null>(null);
  const [oauth, setOauth] = useState<OAuthRow[]>([]);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const [{ data: orgRow }, { data: oauthRows }] = await Promise.all([
      supabase
        .from("organizations")
        .select("slack_webhook_url, zapier_webhook_url")
        .eq("id", currentOrg.id)
        .maybeSingle(),
      supabase
        .from("workspace_integrations")
        .select("id, provider, display_name, external_account_id, status, connected_at, last_synced_at")
        .eq("organization_id", currentOrg.id),
    ]);
    const org = orgRow as { slack_webhook_url?: string | null; zapier_webhook_url?: string | null } | null;
    setSlack(org?.slack_webhook_url ?? null);
    setZapier(org?.zapier_webhook_url ?? null);
    setOauth((oauthRows ?? []) as OAuthRow[]);
  }, [currentOrg?.id]);
  useEffect(() => { void load(); }, [load]);

  // Handle OAuth callback bounces — show a toast for ?integration=...&status=...
  useEffect(() => {
    const integration = searchParams.get("integration");
    const status = searchParams.get("status");
    if (!integration) return;
    if (status === "success") {
      toast.success(`${integration.replace("_", " ")} connected`);
      void load();
    } else if (status === "error") {
      toast.error(`${integration} connect failed: ${searchParams.get("reason") ?? "unknown"}`);
    }
    // Clear params so the toast doesn't fire again on re-render.
    const next = new URLSearchParams(searchParams);
    next.delete("integration");
    next.delete("status");
    next.delete("reason");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, load]);

  const drive = oauth.find((o) => o.provider === "google_drive");
  const notion = oauth.find((o) => o.provider === "notion");

  // ── KPI counts ─────────────────────────────────────────────────────────────
  const liveWebhooks = (slack ? 1 : 0) + (zapier ? 1 : 0);
  const oauthActive = oauth.filter((o) => o.status === "active").length;
  const connectedCount = liveWebhooks + oauthActive;

  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Extend</span><span className="text-white/20">·</span><span>Connections</span></>}
      title="Integrations."
      subtitle="Push productions, brand updates and credit alerts into the tools your team already uses."
    >
      {/* KPI row — connections at a glance */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Connected" value={connectedCount} accent hint="Active across all surfaces" />
        <StatCard label="Live webhooks" value={liveWebhooks} hint="Slack · Zapier" />
        <StatCard label="OAuth connections" value={oauthActive} hint="Drive · Notion" />
      </div>

      <SectionHead label="Live integrations" />
      <p className="-mt-1 mb-4 text-[13px] text-white/45 font-light">
        Send events to any HTTPS endpoint when productions complete or credits run low.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <WebhookIntegration
          kind="slack" icon={Slack} name="Slack"
          blurb="Post finished productions and low-balance alerts to a Slack channel."
          placeholder="https://hooks.slack.com/services/T.../B.../..."
          currentUrl={slack} canEdit={canEdit} onSaved={load}
        />
        <WebhookIntegration
          kind="zapier" icon={Zap} name="Zapier"
          blurb="Trigger 6,000+ automations on every production event."
          placeholder="https://hooks.zapier.com/hooks/catch/..."
          currentUrl={zapier} canEdit={canEdit} onSaved={load}
        />
      </div>

      <SectionHead label="OAuth connections" />
      <p className="-mt-1 mb-4 text-[13px] text-white/45 font-light">
        Authorize Small Bridges to push assets into your existing workspaces.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <OAuthIntegration
          provider="google_drive" icon={Cloud} name="Google Drive"
          blurb="Auto-upload final renders into a Drive folder per project."
          scopes="drive.file (single folder)"
          connection={drive} canEdit={canEdit} onChanged={load}
        />
        <OAuthIntegration
          provider="notion" icon={Database} name="Notion"
          blurb="Sync brand kit and project briefs into a Notion workspace."
          scopes="read_content, update_content"
          connection={notion} canEdit={canEdit} onChanged={load}
        />
      </div>
    </BusinessPage>
  );
}
