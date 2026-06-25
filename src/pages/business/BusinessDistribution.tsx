/**
 * BusinessDistribution — /business/distribution
 *
 * The publish layer: connect social ad channels (Meta, TikTok, YouTube,
 * LinkedIn) over OAuth, then push or schedule finished ads to them. All data
 * access is brokered by the distribution-manage edge function (service role),
 * so this page only ever calls supabase.functions.invoke — it never touches the
 * distribution tables directly.
 *
 * Connections activate per-platform the moment that platform's OAuth secret is
 * added to the project; until then a channel reports "Needs setup" and names
 * the exact secret required.
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Instagram, Youtube, Linkedin, Music2, Loader2, Plug, Link2, Unlink, Send,
  Clock, CheckCircle2, AlertTriangle, CircleSlash, Megaphone,
} from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead, Badge, EmptyState } from "@/components/business/BusinessPage";
import { cn } from "@/lib/utils";

const INPUT_CLS =
  "px-4 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white outline-none placeholder:text-white/30";

type ProviderId = "meta" | "tiktok" | "youtube" | "linkedin";

const PROVIDER_ICON: Record<ProviderId, typeof Instagram> = {
  meta: Instagram, tiktok: Music2, youtube: Youtube, linkedin: Linkedin,
};

interface Connection {
  id: string;
  status: "disconnected" | "pending" | "connected" | "error" | "pending_credentials";
  account_label: string | null;
  last_error: string | null;
  connected_at: string | null;
}
interface ProviderStatus {
  id: ProviderId;
  label: string;
  scopes: string;
  configured: boolean;
  envKeys: { id: string; secret: string };
  connection: Connection | null;
}
interface DistJob {
  id: string;
  provider: ProviderId;
  status: string;
  title: string | null;
  caption: string | null;
  asset_url: string | null;
  aspect_ratio: string | null;
  scheduled_at: string | null;
  posted_at: string | null;
  external_url: string | null;
  error: string | null;
  created_at: string;
}

const JOB_TONE: Record<string, "good" | "bad" | "warn" | "neutral" | "accent"> = {
  posted: "good", failed: "bad", scheduled: "accent", publishing: "accent",
  queued: "neutral", pending_credentials: "warn", canceled: "neutral",
};

// The provider set is static config — render the 4 cards immediately so the
// page is usable even before/without the backend (`distribution-manage`). When
// the status call succeeds it overlays real `configured`/connection state.
const FALLBACK_PROVIDERS: ProviderStatus[] = [
  { id: "meta", label: "Meta (Instagram + Facebook)", scopes: "", configured: false, envKeys: { id: "META_CLIENT_ID", secret: "META_CLIENT_SECRET" }, connection: null },
  { id: "tiktok", label: "TikTok", scopes: "", configured: false, envKeys: { id: "TIKTOK_CLIENT_KEY", secret: "TIKTOK_CLIENT_SECRET" }, connection: null },
  { id: "youtube", label: "YouTube", scopes: "", configured: false, envKeys: { id: "YOUTUBE_CLIENT_ID", secret: "YOUTUBE_CLIENT_SECRET" }, connection: null },
  { id: "linkedin", label: "LinkedIn", scopes: "", configured: false, envKeys: { id: "LINKEDIN_CLIENT_ID", secret: "LINKEDIN_CLIENT_SECRET" }, connection: null },
];

export default function BusinessDistribution() {
  usePageMeta({ title: "Distribution — Business" });
  const { currentOrg, hasPermission } = useWorkspace();
  const canEdit = hasPermission("producer");
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderStatus[]>(FALLBACK_PROVIDERS);
  const [jobs, setJobs] = useState<DistJob[]>([]);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  // Composer
  const [assetUrl, setAssetUrl] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [cta, setCta] = useState("");
  const [channels, setChannels] = useState<ProviderId[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("distribution-manage", {
        body: { action: "status", organizationId: currentOrg.id },
      });
      if (error) throw error;
      if (data?.error || !data?.success) throw new Error(data?.error || "Failed to load distribution status");
      // Keep the static cards if the backend returns nothing, so the page never goes empty.
      setProviders(Array.isArray(data.providers) && data.providers.length ? data.providers : FALLBACK_PROVIDERS);
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (e) {
      toast.error(safeErrorMessage(e, "Couldn't load distribution."));
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { void load(); }, [load]);

  // Surface OAuth callback results, then clean the URL.
  useEffect(() => {
    const connected = searchParams.get("dist_connected");
    const errored = searchParams.get("dist_error");
    if (connected || errored) {
      if (connected) toast.success(`${connected} connected.`);
      if (errored) toast.error(`Couldn't connect ${errored}. Try again.`);
      // Clear only our params, not the whole query string.
      const next = new URLSearchParams(searchParams);
      next.delete("dist_connected");
      next.delete("dist_error");
      setSearchParams(next, { replace: true });
      if (connected) void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const connect = useCallback(async (p: ProviderStatus) => {
    if (!currentOrg) return;
    if (!p.configured) {
      toast.error(`${p.label} needs setup: add the ${p.envKeys.id} and ${p.envKeys.secret} secrets, then reload.`);
      return;
    }
    setBusyProvider(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("distribution-manage", {
        body: { action: "authorize", organizationId: currentOrg.id, provider: p.id },
      });
      if (error) throw error;
      if (data?.status === "not_configured") {
        toast.error(`${p.label} needs setup: add ${(data.missing ?? []).join(" + ")}.`);
        return;
      }
      if (data?.authUrl) { window.location.href = data.authUrl; return; }
      throw new Error("No authorization URL returned");
    } catch (e) {
      toast.error(safeErrorMessage(e, "Couldn't start connection."));
    } finally {
      setBusyProvider(null);
    }
  }, [currentOrg]);

  const disconnect = useCallback(async (p: ProviderStatus) => {
    if (!currentOrg) return;
    setBusyProvider(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("distribution-manage", {
        body: { action: "disconnect", organizationId: currentOrg.id, provider: p.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${p.label} disconnected.`);
      void load();
    } catch (e) {
      toast.error(safeErrorMessage(e, "Couldn't disconnect."));
    } finally {
      setBusyProvider(null);
    }
  }, [currentOrg, load]);

  const toggleChannel = (id: ProviderId) =>
    setChannels((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const canPublish = canEdit && channels.length > 0 && (assetUrl.trim().length > 0 || caption.trim().length > 0) && !publishing;

  const publish = useCallback(async () => {
    if (!currentOrg || !canPublish) return;
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("distribution-manage", {
        body: {
          action: "publish",
          organizationId: currentOrg.id,
          assetUrl: assetUrl.trim() || undefined,
          title: title.trim() || undefined,
          caption: caption.trim() || undefined,
          hashtags: hashtags.trim() || undefined,
          cta: cta.trim() || undefined,
          channels,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        },
      });
      if (error) throw error;
      if (data?.error || !data?.success) throw new Error(data?.error || "Publish failed");
      const created = Array.isArray(data.jobs) ? data.jobs.length : 0;
      toast.success(`${created} distribution job${created === 1 ? "" : "s"} created.`);
      setAssetUrl(""); setTitle(""); setCaption(""); setHashtags(""); setCta(""); setChannels([]); setScheduledAt("");
      void load();
    } catch (e) {
      toast.error(safeErrorMessage(e, "Couldn't publish."));
    } finally {
      setPublishing(false);
    }
  }, [currentOrg, canPublish, assetUrl, title, caption, hashtags, cta, channels, scheduledAt, load]);

  const connectedCount = providers.filter((p) => p.connection?.status === "connected").length;

  return (
    <BusinessPage
      eyebrow={<><span className="text-[hsl(215,100%,72%)]">Extend</span><span className="text-white/20">·</span><span>Channels</span></>}
      title="Distribution."
      accent="Ship it everywhere."
      subtitle="Connect your ad channels once, then push or schedule finished productions to Meta, TikTok, YouTube and LinkedIn from one place."
    >
      {/* ── Channels ──────────────────────────────────────────────────────── */}
      <SectionHead label="Channels" count={loading ? undefined : `${connectedCount}/${providers.length || 4} connected`} />
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/[0.02] animate-pulse" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {providers.map((p) => (
            <ChannelCard key={p.id} provider={p} canEdit={canEdit} busy={busyProvider === p.id}
              onConnect={() => connect(p)} onDisconnect={() => disconnect(p)} />
          ))}
        </div>
      )}

      {/* ── Composer ──────────────────────────────────────────────────────── */}
      <SectionHead label="New distribution" />
      <div className="rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">Asset URL (rendered video)</span>
            <input value={assetUrl} disabled={!canEdit} onChange={(e) => setAssetUrl(e.target.value)}
              placeholder="https://…/your-ad.mp4" className={cn(INPUT_CLS, "h-11 disabled:opacity-50")} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">Title <span className="text-white/25 normal-case tracking-normal">· optional</span></span>
            <input value={title} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)}
              placeholder="Internal title / video title" className={cn(INPUT_CLS, "h-11 disabled:opacity-50")} />
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">Caption</span>
          <textarea value={caption} disabled={!canEdit} onChange={(e) => setCaption(e.target.value)} rows={3}
            placeholder="The caption / primary text for the post." className={cn(INPUT_CLS, "py-3 resize-y leading-relaxed disabled:opacity-50")} />
        </label>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">Hashtags <span className="text-white/25 normal-case tracking-normal">· optional</span></span>
            <input value={hashtags} disabled={!canEdit} onChange={(e) => setHashtags(e.target.value)}
              placeholder="#sleep #wellness" className={cn(INPUT_CLS, "h-11 disabled:opacity-50")} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">CTA <span className="text-white/25 normal-case tracking-normal">· optional</span></span>
            <input value={cta} disabled={!canEdit} onChange={(e) => setCta(e.target.value)}
              placeholder="Shop now" className={cn(INPUT_CLS, "h-11 disabled:opacity-50")} />
          </label>
        </div>

        {/* Channel picker */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5"><Megaphone className="w-3 h-3" /> Publish to</span>
          <div className="flex flex-wrap gap-2">
            {providers.map((p) => {
              const Icon = PROVIDER_ICON[p.id];
              const active = channels.includes(p.id);
              const connected = p.connection?.status === "connected";
              return (
                <button key={p.id} type="button" disabled={!canEdit} aria-pressed={active} onClick={() => toggleChannel(p.id)}
                  className={cn(
                    "inline-flex items-center gap-2 px-3.5 h-9 rounded-full text-[13px] font-light ring-1 transition-all",
                    active ? "ring-[hsl(215_90%_60%/0.45)] bg-[hsl(215_90%_55%/0.12)] text-[hsl(215,100%,82%)]"
                           : "ring-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white/90 hover:ring-white/15",
                    !canEdit && "opacity-50 cursor-not-allowed",
                  )}>
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.7} />
                  {p.label.replace(" (Instagram + Facebook)", "")}
                  {!connected && <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-amber-300/70">·setup</span>}
                </button>
              );
            })}
          </div>
          {channels.some((c) => providers.find((p) => p.id === c)?.connection?.status !== "connected") && (
            <p className="text-[12px] text-amber-300/70 font-light">Channels not yet connected will queue as “Needs setup” until you connect them.</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-1">
          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Schedule <span className="text-white/25 normal-case tracking-normal">· optional</span></span>
            <input type="datetime-local" value={scheduledAt} disabled={!canEdit} onChange={(e) => setScheduledAt(e.target.value)}
              className={cn(INPUT_CLS, "h-11 disabled:opacity-50 [color-scheme:dark]")} />
          </label>
          <button type="button" onClick={publish} disabled={!canPublish}
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 h-12 bg-[hsl(215,90%,55%)] text-white text-[14px] font-medium hover:bg-[hsl(215,90%,60%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" strokeWidth={1.8} />}
            {scheduledAt ? "Schedule" : "Publish"} to {channels.length || 0} channel{channels.length === 1 ? "" : "s"}
          </button>
        </div>
        {!canEdit && <p className="text-[12px] text-white/40">You need Producer access or higher to connect channels or publish.</p>}
      </div>

      {/* ── Jobs ──────────────────────────────────────────────────────────── */}
      <SectionHead label="Recent distributions" count={jobs.length || undefined} />
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-white/[0.02] animate-pulse" />)}</div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={Send} title="No distributions yet" description="Connect a channel and publish a finished ad — jobs and their status will appear here." />
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => <JobRow key={j.id} job={j} />)}
        </div>
      )}
    </BusinessPage>
  );
}

// ── ChannelCard ──────────────────────────────────────────────────────────────
function ChannelCard({ provider, canEdit, busy, onConnect, onDisconnect }: {
  provider: ProviderStatus; canEdit: boolean; busy: boolean; onConnect: () => void; onDisconnect: () => void;
}) {
  const Icon = PROVIDER_ICON[provider.id];
  const status = provider.connection?.status;
  const connected = status === "connected";
  const errored = status === "error";

  const statusBadge = !provider.configured
    ? <Badge tone="warn">Needs setup</Badge>
    : connected ? <Badge tone="good"><CheckCircle2 className="w-3 h-3" /> Connected</Badge>
    : errored ? <Badge tone="bad"><AlertTriangle className="w-3 h-3" /> Error</Badge>
    : status === "pending" ? <Badge tone="warn">Pending…</Badge>
    : <Badge tone="neutral">Not connected</Badge>;

  return (
    <div className="rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl ring-1 ring-white/[0.08] bg-white/[0.03] flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-white/70" strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] text-white font-medium truncate">{provider.label.replace(" (Instagram + Facebook)", "")}</div>
            <div className="text-[11px] text-white/40 truncate">{provider.connection?.account_label || (connected ? "Connected account" : provider.id === "meta" ? "Instagram + Facebook" : "Not connected")}</div>
          </div>
        </div>
        {statusBadge}
      </div>

      {!provider.configured && (
        <p className="mt-3 text-[11.5px] text-white/40 font-light">Add <span className="font-mono text-white/55">{provider.envKeys.id}</span> + <span className="font-mono text-white/55">{provider.envKeys.secret}</span> as project secrets to enable.</p>
      )}
      {errored && provider.connection?.last_error && (
        <p className="mt-3 text-[11.5px] text-rose-300/70 font-light line-clamp-2">{provider.connection.last_error}</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        {connected ? (
          <button type="button" disabled={!canEdit || busy} onClick={onDisconnect}
            className="inline-flex items-center gap-2 rounded-full px-4 h-9 ring-1 ring-white/[0.1] text-white/70 hover:text-rose-300 hover:ring-rose-400/30 text-[12.5px] disabled:opacity-50 transition-colors">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />} Disconnect
          </button>
        ) : (
          <button type="button" disabled={!canEdit || busy} onClick={onConnect}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 h-9 text-[12.5px] font-medium transition-colors disabled:opacity-50",
              provider.configured ? "bg-[hsl(215,90%,55%)] text-white hover:bg-[hsl(215,90%,60%)]" : "ring-1 ring-white/[0.1] text-white/60 hover:text-white/90",
            )}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : provider.configured ? <Link2 className="w-3.5 h-3.5" /> : <Plug className="w-3.5 h-3.5" />}
            {provider.configured ? "Connect" : "Setup required"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── JobRow ────────────────────────────────────────────────────────────────────
function JobRow({ job }: { job: DistJob }) {
  const Icon = PROVIDER_ICON[job.provider] ?? CircleSlash;
  const when = job.posted_at || job.scheduled_at || job.created_at;
  const whenLabel = job.posted_at ? "Posted" : job.scheduled_at ? "Scheduled" : "Created";
  return (
    <div className="flex items-center gap-3 rounded-2xl px-4 py-3">
      <div className="w-9 h-9 rounded-lg ring-1 ring-white/[0.08] bg-white/[0.03] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-white/65" strokeWidth={1.6} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] text-white/90 truncate">{job.title || job.caption || "Untitled distribution"}</div>
        <div className="text-[11px] text-white/40 truncate">
          {whenLabel} {fmtDate(when)}{job.aspect_ratio ? ` · ${job.aspect_ratio}` : ""}{job.error ? ` · ${job.error}` : ""}
        </div>
      </div>
      {job.external_url
        ? <a href={job.external_url} target="_blank" rel="noreferrer" className="text-[11px] font-mono uppercase tracking-[0.18em] text-[hsl(215,100%,78%)] hover:text-[hsl(215,100%,88%)]">View</a>
        : null}
      <Badge tone={JOB_TONE[job.status] ?? "neutral"}>{job.status.replace(/_/g, " ")}</Badge>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}
