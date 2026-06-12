/**
 * Admin Alerts Monitor — live operator HUD for the four signal streams that
 * matter most: signups, purchases, support, sales inquiries. Realtime,
 * glowing, cinematic.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus, ShoppingBag, MessageSquare, Building2,
  Loader2, CheckCheck, Activity, Mail, Bell,
  AlertTriangle, Undo2, ShieldAlert, Flame, Clock3, Clapperboard, UserMinus, ZapOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminPageShell } from "../../components/AdminPageShell";
import { cn } from "@/lib/utils";

type Kind =
  | "admin_signup" | "admin_purchase" | "admin_support_message" | "admin_inquiry"
  | "admin_payment_failed" | "admin_refund" | "admin_dispute" | "admin_high_value_purchase"
  | "admin_stuck_job" | "admin_first_video" | "admin_account_deleted"
  | "admin_abuse_signal" | "admin_error_spike";

interface Notif {
  id: string;
  type: Kind;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  read: boolean;
  created_at: string;
  severity?: "info" | "warn" | "critical" | null;
}

const KINDS: Kind[] = [
  "admin_signup", "admin_purchase", "admin_support_message", "admin_inquiry",
  "admin_payment_failed", "admin_refund", "admin_dispute", "admin_high_value_purchase",
  "admin_stuck_job", "admin_first_video", "admin_account_deleted",
  "admin_abuse_signal", "admin_error_spike",
];

// Tier-based palette. Critical = red, warn = amber, info = blue/teal/emerald accents.
const META: Record<Kind, { label: string; icon: any; tone: string; glow: string; severity: "info" | "warn" | "critical" }> = {
  admin_signup:               { label: "Signups",     icon: UserPlus,      tone: "#10B981", glow: "rgba(16,185,129,0.45)",  severity: "info" },
  admin_purchase:             { label: "Purchases",   icon: ShoppingBag,   tone: "#0A84FF", glow: "rgba(10,132,255,0.55)",  severity: "info" },
  admin_support_message:      { label: "Support",     icon: MessageSquare, tone: "#F59E0B", glow: "rgba(245,158,11,0.45)",  severity: "info" },
  admin_inquiry:              { label: "Sales",       icon: Building2,     tone: "#22D3EE", glow: "rgba(34,211,238,0.45)",  severity: "info" },
  admin_high_value_purchase:  { label: "Big Sale",    icon: Flame,         tone: "#FF6B00", glow: "rgba(255,107,0,0.55)",   severity: "warn" },
  admin_first_video:          { label: "First Ship",  icon: Clapperboard,  tone: "#34D399", glow: "rgba(52,211,153,0.45)",  severity: "info" },
  admin_payment_failed:       { label: "Pay Fail",    icon: AlertTriangle, tone: "#FFB020", glow: "rgba(255,176,32,0.55)",  severity: "warn" },
  admin_refund:               { label: "Refund",      icon: Undo2,         tone: "#FFB020", glow: "rgba(255,176,32,0.45)",  severity: "warn" },
  admin_stuck_job:            { label: "Stuck Job",   icon: Clock3,        tone: "#FFB020", glow: "rgba(255,176,32,0.45)",  severity: "warn" },
  admin_account_deleted:      { label: "Deleted",     icon: UserMinus,     tone: "#FFB020", glow: "rgba(255,176,32,0.40)",  severity: "warn" },
  admin_dispute:              { label: "Chargeback",  icon: ShieldAlert,   tone: "#FF3B30", glow: "rgba(255,59,48,0.65)",   severity: "critical" },
  admin_abuse_signal:         { label: "Abuse",       icon: ShieldAlert,   tone: "#FF3B30", glow: "rgba(255,59,48,0.60)",   severity: "critical" },
  admin_error_spike:          { label: "Err Spike",   icon: ZapOff,        tone: "#FF3B30", glow: "rgba(255,59,48,0.60)",   severity: "critical" },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function AdminNotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Kind | "all">("all");

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,type,title,body,data,read,created_at,severity")
      .eq("user_id", user.id)
      .in("type", KINDS)
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data as Notif[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`admin-monitor-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          if (!KINDS.includes(n.type)) return;
          setItems((p) => [n, ...p].slice(0, 200));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const counts = useMemo(() => {
    const out = {} as Record<Kind, { total: number; unread: number; last?: string }>;
    for (const k of KINDS) out[k] = { total: 0, unread: 0 };
    for (const n of items) {
      if (!out[n.type]) continue;
      out[n.type].total++;
      if (!n.read) out[n.type].unread++;
      if (!out[n.type].last) out[n.type].last = n.created_at;
    }
    return out;
  }, [items]);

  const filtered = filter === "all" ? items : items.filter((n) => n.type === filter);
  const totalUnread = Object.values(counts).reduce((s, c) => s + c.unread, 0);

  const markAllRead = async () => {
    if (!user || totalUnread === 0) return;
    const ids = items.filter((i) => !i.read).map((i) => i.id);
    setItems((p) => p.map((i) => ({ ...i, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", ids);
  };

  const handleOpen = async (n: Notif) => {
    if (!n.read) {
      setItems((p) => p.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    }
    const href = (n.data?.href as string) || "/admin";
    navigate(href);
  };

  return (
    <AdminPageShell
      eyebrow="08 // COMMS"
      code="NTF"
      title="Operator"
      italic="Monitor."
      description="Realtime alert feed — signups, purchases, support, sales. Pinged in-app and to admin email."
    >
      {/* Stat constellation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {KINDS.map((k) => {
          const m = META[k];
          const c = counts[k];
          const Icon = m.icon;
          const active = filter === k;
          return (
            <button
              key={k}
              onClick={() => setFilter(active ? "all" : k)}
              className={cn(
                "relative group overflow-hidden text-left rounded-2xl border bg-[#070809]/60 backdrop-blur-xl p-5 transition-all",
                active ? "border-white/30 scale-[1.01]" : "border-white/8 hover:border-white/15"
              )}
              style={{ boxShadow: active ? `0 0 40px ${m.glow}, inset 0 0 0 1px ${m.tone}55` : `0 0 0 transparent` }}
            >
              {/* Glow */}
              <div
                aria-hidden
                className="absolute -top-20 -right-20 w-48 h-48 rounded-full pointer-events-none transition-opacity"
                style={{ background: `radial-gradient(circle, ${m.glow}, transparent 70%)`, filter: "blur(40px)", opacity: c.unread > 0 ? 0.9 : 0.25 }}
              />
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border"
                    style={{ borderColor: `${m.tone}55`, background: `${m.tone}15`, color: m.tone, boxShadow: c.unread > 0 ? `0 0 14px ${m.glow}` : "none" }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.3em] text-white/40 font-mono">
                      {m.label}
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5 font-mono">
                      {c.last ? `${timeAgo(c.last)} ago` : "—"}
                    </div>
                  </div>
                </div>
                {c.unread > 0 && (
                  <span
                    className="min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-mono font-semibold flex items-center justify-center text-white animate-pulse"
                    style={{ background: m.tone, boxShadow: `0 0 14px ${m.glow}` }}
                  >
                    {c.unread}
                  </span>
                )}
              </div>
              <div className="relative mt-5 flex items-baseline gap-2">
                <div
                  className="text-[42px] leading-none text-white"
                  style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, textShadow: c.unread > 0 ? `0 0 24px ${m.glow}` : "none" }}
                >
                  {c.total}
                </div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/35 font-mono">total</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-white/40 font-mono">
          <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
          <span>Live · {filtered.length} event{filtered.length === 1 ? "" : "s"}</span>
          {filter !== "all" && (
            <button onClick={() => setFilter("all")} className="text-[#0A84FF] hover:text-white transition-colors normal-case tracking-normal">
              · clear filter
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] font-mono">
          <div className="flex items-center gap-1.5 text-white/40 px-2 py-1 rounded border border-white/5">
            <Mail className="w-3 h-3" /> Email · on
          </div>
          <div className="flex items-center gap-1.5 text-white/40 px-2 py-1 rounded border border-white/5">
            <Bell className="w-3 h-3" /> In-app · on
          </div>
          <button
            onClick={markAllRead}
            disabled={totalUnread === 0}
            className="flex items-center gap-1.5 px-3 py-1 rounded border border-white/10 hover:border-[#0A84FF]/50 hover:text-[#0A84FF] text-white/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCheck className="w-3 h-3" /> Mark all read
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="relative rounded-2xl border border-white/8 bg-[#070809]/60 backdrop-blur-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/30">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-[11px] uppercase tracking-[0.3em] text-white/30 font-mono">No events yet</div>
            <div className="text-[13px] text-white/40 mt-2">
              Live alerts will appear here the moment they happen.
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {filtered.map((n) => {
              const m = META[n.type];
              const Icon = m.icon;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => handleOpen(n)}
                    className={cn(
                      "group w-full text-left px-6 py-4 flex items-start gap-4 hover:bg-white/[0.03] transition-colors relative",
                      !n.read && "bg-white/[0.015]"
                    )}
                  >
                    {!n.read && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-8 rounded-r"
                        style={{ background: m.tone, boxShadow: `0 0 10px ${m.glow}` }}
                      />
                    )}
                    <div
                      className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border"
                      style={{
                        borderColor: n.read ? "rgba(255,255,255,0.08)" : `${m.tone}55`,
                        background: n.read ? "rgba(255,255,255,0.02)" : `${m.tone}12`,
                        color: n.read ? "rgba(255,255,255,0.35)" : m.tone,
                        boxShadow: n.read ? "none" : `0 0 12px ${m.glow}`,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <div
                          className={cn(
                            "text-[15px] truncate",
                            n.read ? "text-white/70" : "text-white"
                          )}
                        >
                          {n.title}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-mono shrink-0">
                          {timeAgo(n.created_at)} ago
                        </div>
                      </div>
                      {n.body && (
                        <div className="text-[13px] text-white/50 mt-1 line-clamp-2">
                          {n.body}
                        </div>
                      )}
                      <div className="text-[9px] uppercase tracking-[0.3em] text-white/25 font-mono mt-2">
                        {m.label}
                        {n.data?.href && (
                          <span className="ml-3 text-[#0A84FF]/60 opacity-0 group-hover:opacity-100 transition-opacity normal-case tracking-normal">
                            → Open
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminPageShell>
  );
}
