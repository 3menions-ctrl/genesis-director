/**
 * BusinessApi — /business/api
 *
 * Org-scoped API keys and webhook endpoints for programmatic access to
 * workspace productions. Reuses the exact data logic from WorkspaceApi
 * (org_api_keys, webhook_endpoints, workspace_audit_events, the
 * webhook-dispatch edge function), re-skinned into the borderless
 * cover-hero BusinessPage language with a data-rich KPI row, richer key
 * rows, and delivery-health webhook cards.
 */
import { useEffect, useState, useCallback } from "react";
import { KeyRound, Webhook, Plus, Trash2, Copy, Check, Send, Loader2 } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { confirmAsync } from "@/components/ui/global-confirm";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, StatCard, SectionHead, EmptyState, SkeletonRows, Badge } from "@/components/business/BusinessPage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface WebhookRow {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  secret: string;
  active: boolean;
  last_delivered_at: string | null;
  failure_count: number;
  created_at: string;
}

const WEBHOOK_EVENTS = [
  { value: "project.created", label: "Project created" },
  { value: "project.completed", label: "Project completed" },
  { value: "project.failed", label: "Project failed" },
  { value: "credits.low", label: "Credit balance low" },
  { value: "member.joined", label: "Member joined workspace" },
  { value: "member.removed", label: "Member removed" },
] as const;

const inputCls =
  "h-11 px-4 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white placeholder:text-white/35 outline-none transition";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[hsl(215,90%,55%)] text-white text-[13px] font-medium hover:bg-[hsl(215,90%,60%)] disabled:opacity-50 transition-colors";
const ghostBtn =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg ring-1 ring-white/[0.08] text-[12px] text-white/65 hover:text-white hover:ring-white/15 transition-colors";

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

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(len = 36) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(36)).join("").slice(0, len);
}

export default function BusinessApi() {
  usePageMeta({ title: "API & hooks — Business" });

  const { currentOrg, hasPermission } = useWorkspace();
  const { user } = useAuth();
  const canManage = hasPermission("admin");
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ id: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Webhooks are lifted here so the KPI row can report endpoint + failure totals.
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [hooksLoading, setHooksLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from("org_api_keys")
      .select("id, name, prefix, scopes, last_used_at, revoked_at, created_at")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false });
    setKeys((data ?? []) as KeyRow[]);
    setLoading(false);
  }, [currentOrg?.id]);

  const loadHooks = useCallback(async () => {
    if (!currentOrg) return;
    setHooksLoading(true);
    const { data } = await supabase
      .from("webhook_endpoints")
      .select("id, url, description, events, secret, active, last_delivered_at, failure_count, created_at")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false });
    setHooks((data ?? []) as WebhookRow[]);
    setHooksLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadHooks(); }, [loadHooks]);

  const generateKey = async () => {
    if (!currentOrg || !user || !name.trim()) return;
    setCreating(true);
    try {
      const secret = randomToken(40);
      const prefix = `apx_${randomToken(8)}`;
      const fullToken = `${prefix}_${secret}`;
      const key_hash = await sha256Hex(fullToken);
      const { data, error } = await supabase
        .from("org_api_keys")
        .insert({
          organization_id: currentOrg.id,
          created_by: user.id,
          name: name.trim(),
          prefix,
          key_hash,
          scopes: ["read", "generate"],
        })
        .select("id")
        .single();
      if (error) throw error;
      setRevealed({ id: data.id, token: fullToken });
      setName("");
      await supabase.from("workspace_audit_events").insert({
        organization_id: currentOrg.id,
        actor_id: user.id,
        category: "api",
        action: "apikey.created",
        target_kind: "api_key",
        target_id: data.id,
        metadata: { name: name.trim(), prefix },
      });
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate key");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (row: KeyRow) => {
    if (!(await confirmAsync(`Revoke key "${row.name}"? Any service using it will immediately stop working.`))) return;
    const { error } = await supabase
      .from("org_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Key revoked");
    if (currentOrg && user) {
      await supabase.from("workspace_audit_events").insert({
        organization_id: currentOrg.id, actor_id: user.id,
        category: "api", action: "apikey.revoked",
        target_kind: "api_key", target_id: row.id,
        metadata: { prefix: row.prefix },
      });
    }
    void load();
  };

  const copyToken = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const activeKeys = keys.filter((k) => !k.revoked_at).length;
  const failedDeliveries = hooks.reduce((t, h) => t + (h.failure_count || 0), 0);

  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Extend</span><span className="text-white/20">·</span><span>Programmatic access</span></>}
      title="API & hooks."
      subtitle="Org-scoped API keys and webhook endpoints for programmatic access to workspace productions. Keys inherit the org credit pool; deliveries are signed per endpoint."
    >
      {/* KPI row — keys · active · endpoints · delivery health */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="API keys" value={keys.length} accent loading={loading} hint={canManage ? "You can manage keys" : "Read-only access"} />
        <StatCard label="Active keys" value={activeKeys} loading={loading} hint={`${keys.length - activeKeys} revoked`} />
        <StatCard label="Webhook endpoints" value={hooks.length} loading={hooksLoading} hint={`${hooks.filter((h) => h.active).length} active`} />
        <StatCard label="Failed deliveries" value={failedDeliveries} loading={hooksLoading} hint={failedDeliveries > 0 ? "Across all endpoints" : "All healthy"} />
      </div>

      {/* ── API KEYS ───────────────────────────────────────────────── */}
      <SectionHead label="API keys" count={loading ? undefined : `${keys.length}`} />

      {revealed && (
        <div className="mb-4 rounded-2xl ring-1 ring-amber-400/30 bg-amber-400/[0.06] p-4">
          <div className={cn(TYPE_META, "text-amber-200/90 mb-2")}>
            Copy this key now — it will not be shown again.
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-xl bg-black/40 ring-1 ring-white/[0.08] font-mono text-[12px] text-white/95 break-all">
              {revealed.token}
            </code>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void copyToken()} className={ghostBtn}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" onClick={() => setRevealed(null)} className={ghostBtn}>Done</button>
            </div>
          </div>
        </div>
      )}

      {canManage && (
        <div className="rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5 mb-4">
          <input
            type="text"
            placeholder="Key name (e.g. Production backend)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void generateKey(); }}
            disabled={creating}
            className={inputCls}
          />
          <button type="button" onClick={() => void generateKey()} disabled={creating || !name.trim()} className={primaryBtn}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? "Generating…" : "Generate key"}
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={3} />
      ) : keys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No keys yet."
          description="Generate a workspace-scoped API key to call generation endpoints from your backend. Keys inherit the org credit pool."
        />
      ) : (
      <div className="rounded-2xl overflow-hidden divide-y divide-white/[0.05]">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
            <span className="w-9 h-9 rounded-full bg-white/[0.06] ring-1 ring-white/10 flex items-center justify-center shrink-0"><KeyRound className="w-4 h-4 text-[hsl(215,100%,72%)]" strokeWidth={1.5} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] text-white/90 truncate">{k.name}</span>
                <code className="font-mono text-[11px] text-white/45">{k.prefix}…</code>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {(k.scopes ?? []).map((s) => (
                  <Badge key={s} tone="neutral">{s}</Badge>
                ))}
                <span className="text-[11px] text-white/40">
                  {k.last_used_at ? `Used ${relativeTime(k.last_used_at)}` : "Never used"}
                </span>
              </div>
            </div>
            <Badge tone={k.revoked_at ? "bad" : "good"} className="shrink-0">{k.revoked_at ? "Revoked" : "Active"}</Badge>
            {canManage && !k.revoked_at && (
              <button onClick={() => void revokeKey(k)} className="p-2 rounded-full hover:bg-rose-500/15 text-rose-300/80 shrink-0" title="Revoke key" aria-label="Revoke">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      )}

      <WebhooksSection canManage={canManage} hooks={hooks} loading={hooksLoading} reload={loadHooks} />
    </BusinessPage>
  );
}

// ── Webhooks ────────────────────────────────────────────────────────────

function WebhooksSection({ canManage, hooks, loading, reload }: {
  canManage: boolean;
  hooks: WebhookRow[];
  loading: boolean;
  reload: () => void;
}) {
  const { currentOrg } = useWorkspace();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const remove = async (row: WebhookRow) => {
    if (!(await confirmAsync(`Delete webhook for ${row.url}? Future events will not be delivered to this endpoint.`))) return;
    const { error } = await supabase.from("webhook_endpoints").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Webhook deleted");
    if (currentOrg && user) {
      await supabase.from("workspace_audit_events").insert({
        organization_id: currentOrg.id, actor_id: user.id,
        category: "api", action: "webhook.deleted",
        target_kind: "webhook", target_id: row.id,
        metadata: { url: row.url },
      });
    }
    reload();
  };

  const toggleActive = async (row: WebhookRow) => {
    const { error } = await supabase
      .from("webhook_endpoints")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success(row.active ? "Webhook paused" : "Webhook resumed");
    reload();
  };

  const testFire = async (row: WebhookRow) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Sign in required"); return; }
    toast.loading("Sending test event…", { id: "wh-test" });
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-dispatch`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            endpointId: row.id,
            event: "webhook.test",
            payload: { hello: "world", sentAt: new Date().toISOString() },
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      toast.dismiss("wh-test");
      if (!res.ok || !body.success) {
        toast.error(`Test failed: ${body.error ?? res.statusText}`);
      } else {
        toast.success(`Test delivered (HTTP ${body.deliveryStatus ?? "OK"})`);
      }
      reload();
    } catch (e) {
      toast.dismiss("wh-test");
      toast.error(e instanceof Error ? e.message : "Test failed");
    }
  };

  const copySecret = async () => {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <SectionHead
        label="Webhooks"
        count={loading ? undefined : `${hooks.length}`}
        action={canManage && !showCreate ? (
          <button type="button" onClick={() => setShowCreate(true)} className={ghostBtn}>
            <Plus className="w-3.5 h-3.5" /> Add endpoint
          </button>
        ) : undefined}
      />

      {revealedSecret && (
        <div className="mb-4 rounded-2xl ring-1 ring-amber-400/30 bg-amber-400/[0.06] p-4">
          <div className={cn(TYPE_META, "text-amber-200/90 mb-2")}>
            Copy this signing secret — use it to verify the signature header on incoming events.
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-xl bg-black/40 ring-1 ring-white/[0.08] font-mono text-[12px] text-white/95 break-all">
              {revealedSecret.secret}
            </code>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void copySecret()} className={ghostBtn}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" onClick={() => setRevealedSecret(null)} className={ghostBtn}>Done</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateWebhookForm
          onCancel={() => setShowCreate(false)}
          busy={creating}
          onSubmit={async ({ url, description, events }) => {
            if (!currentOrg || !user) return;
            setCreating(true);
            try {
              try { new URL(url); } catch { throw new Error("Enter a valid URL including https://"); }
              if (events.length === 0) throw new Error("Select at least one event");
              const { data, error } = await supabase
                .from("webhook_endpoints")
                .insert({
                  organization_id: currentOrg.id,
                  url,
                  description: description || null,
                  events,
                  created_by: user.id,
                })
                .select("id, secret")
                .single();
              if (error) throw error;
              setRevealedSecret({ id: data.id, secret: data.secret });
              setShowCreate(false);
              await supabase.from("workspace_audit_events").insert({
                organization_id: currentOrg.id, actor_id: user.id,
                category: "api", action: "webhook.created",
                target_kind: "webhook", target_id: data.id,
                metadata: { url, events },
              });
              reload();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed to create webhook");
            } finally {
              setCreating(false);
            }
          }}
        />
      )}

      {loading ? (
        <SkeletonRows rows={3} />
      ) : hooks.length === 0 && !showCreate ? (
        <EmptyState
          icon={Webhook}
          title="No webhooks yet."
          description="Add an endpoint to receive workspace events. Every delivery is signed with a per-webhook secret you verify on your server."
        />
      ) : hooks.length > 0 ? (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {hooks.map((h) => {
          const health = h.failure_count === 0
            ? { tone: "good" as const, dot: "bg-emerald-400", text: "text-emerald-300/90", label: "Healthy" }
            : h.failure_count <= 2
              ? { tone: "warn" as const, dot: "bg-amber-400", text: "text-amber-300/90", label: `${h.failure_count} recent failure${h.failure_count === 1 ? "" : "s"}` }
              : { tone: "bad" as const, dot: "bg-rose-400", text: "text-rose-300/90", label: `${h.failure_count} failures` };
          return (
            <div key={h.id} className="rounded-2xl p-4 transition-colors flex flex-col">
              <div className="flex items-start gap-2.5">
                <span className="relative flex w-2.5 h-2.5 mt-1.5 shrink-0">
                  <span className={cn("absolute inline-flex w-full h-full rounded-full opacity-60", health.dot)} />
                  <span className={cn("relative inline-flex w-2.5 h-2.5 rounded-full", health.dot)} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] text-white/90 font-mono truncate" title={h.url}>{h.url}</div>
                  {h.description && <div className="text-[11px] text-white/45 mt-1">{h.description}</div>}
                </div>
                <Badge tone={h.active ? "good" : "neutral"} className="shrink-0">{h.active ? "Active" : "Paused"}</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {h.events.map((e) => (
                  <Badge key={e} tone="neutral">{e}</Badge>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono">
                <span className={cn("inline-flex items-center gap-1.5", health.text)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", health.dot)} />{health.label}
                </span>
                <span className="text-white/40">
                  {h.last_delivered_at ? `Delivered ${relativeTime(h.last_delivered_at)}` : "Never delivered"}
                </span>
              </div>

              {canManage && (
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2">
                  <button
                    onClick={() => void testFire(h)}
                    className={ghostBtn}
                    title="Send test event"
                  >
                    <Send className="w-3.5 h-3.5" /> Test
                  </button>
                  <button
                    onClick={() => void toggleActive(h)}
                    className={ghostBtn}
                  >
                    {h.active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => void remove(h)}
                    className="ml-auto p-2 rounded-full hover:bg-rose-500/15 text-rose-300/80"
                    title="Delete webhook"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      ) : null}
    </>
  );
}

function CreateWebhookForm({
  onSubmit,
  onCancel,
  busy,
}: {
  onSubmit: (v: { url: string; description: string; events: string[] }) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<string[]>([WEBHOOK_EVENTS[0].value, WEBHOOK_EVENTS[1].value]);

  const toggleEvent = (v: string) =>
    setEvents((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  return (
    <div className="mb-4 rounded-2xl p-5 space-y-4">
      <div>
        <div className={cn(TYPE_META, "text-white/45 mb-2")}>Endpoint URL</div>
        <input
          type="text"
          placeholder="https://api.example.com/webhooks/genesis"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
          className={cn(inputCls, "w-full")}
        />
      </div>
      <div>
        <div className={cn(TYPE_META, "text-white/45 mb-2")}>Description (optional)</div>
        <input
          type="text"
          placeholder="Production order pipeline"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
          className={cn(inputCls, "w-full")}
        />
      </div>
      <div>
        <div className={cn(TYPE_META, "text-white/45 mb-2")}>Events</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {WEBHOOK_EVENTS.map((e) => (
            <label key={e.value} className="flex items-center gap-2 cursor-pointer text-white/75 hover:text-white">
              <input
                type="checkbox"
                checked={events.includes(e.value)}
                onChange={() => toggleEvent(e.value)}
                className="accent-[hsl(215,90%,55%)]"
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.16em]">{e.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className={ghostBtn}>Cancel</button>
        <button type="button" onClick={() => onSubmit({ url, description, events })} disabled={busy || !url.trim()} className={primaryBtn}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {busy ? "Saving…" : "Save endpoint"}
        </button>
      </div>
    </div>
  );
}
