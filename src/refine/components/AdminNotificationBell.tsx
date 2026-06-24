/**
 * AdminNotificationBell — realtime in-app alerts for admin operators.
 * Shows unread count badge, dropdown with recent admin notifications,
 * mark-as-read + click-through. Subscribes via Supabase Realtime so new
 * purchases, support messages, and sales inquiries appear instantly.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, ShoppingBag, MessageSquare, Building2, Check, Loader2, UserPlus,
  AlertTriangle, Undo2, ShieldAlert, Flame, Clock3, Clapperboard, UserMinus, ZapOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ACCENT_HSL, accent, ROSE, AMBER, INK, MUT, MUT2 } from "@/admin/ui/primitives";

type AdminNotifType =
  | "admin_purchase" | "admin_support_message" | "admin_inquiry" | "admin_signup"
  | "admin_payment_failed" | "admin_refund" | "admin_dispute" | "admin_high_value_purchase"
  | "admin_stuck_job" | "admin_first_video" | "admin_account_deleted"
  | "admin_abuse_signal" | "admin_error_spike";

interface AdminNotif {
  id: string;
  type: AdminNotifType;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  read: boolean;
  created_at: string;
  severity?: "info" | "warn" | "critical" | null;
}

const ADMIN_TYPES: AdminNotifType[] = [
  "admin_purchase",
  "admin_support_message",
  "admin_inquiry",
  "admin_signup",
  "admin_payment_failed",
  "admin_refund",
  "admin_dispute",
  "admin_high_value_purchase",
  "admin_stuck_job",
  "admin_first_video",
  "admin_account_deleted",
  "admin_abuse_signal",
  "admin_error_spike",
];

function iconFor(type: AdminNotifType) {
  if (type === "admin_purchase") return ShoppingBag;
  if (type === "admin_high_value_purchase") return Flame;
  if (type === "admin_payment_failed") return AlertTriangle;
  if (type === "admin_refund") return Undo2;
  if (type === "admin_dispute") return ShieldAlert;
  if (type === "admin_stuck_job") return Clock3;
  if (type === "admin_first_video") return Clapperboard;
  if (type === "admin_account_deleted") return UserMinus;
  if (type === "admin_abuse_signal") return ShieldAlert;
  if (type === "admin_error_spike") return ZapOff;
  if (type === "admin_inquiry") return Building2;
  if (type === "admin_signup") return UserPlus;
  return MessageSquare;
}

function tonesFor(severity: AdminNotif["severity"]) {
  if (severity === "critical") return { fg: ROSE, bg: "hsl(345 82% 56% / 0.1)", row: "hsl(345 82% 56% / 0.05)", dot: ROSE };
  if (severity === "warn") return { fg: AMBER, bg: "hsl(33 92% 47% / 0.12)", row: "hsl(33 92% 47% / 0.05)", dot: AMBER };
  return { fg: ACCENT_HSL, bg: accent(0.1), row: accent(0.05), dot: ACCENT_HSL };
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function AdminNotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,type,title,body,data,read,created_at,severity")
      .eq("user_id", user.id)
      .in("type", ADMIN_TYPES)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as AdminNotif[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`admin-notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as AdminNotif;
          if (!ADMIN_TYPES.includes(n.type)) return;
          setItems((prev) => [n, ...prev].slice(0, 30));
          // soft chime via subtle Audio API beep — skipped to keep UX quiet
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  // Outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const unread = items.filter((i) => !i.read).length;
  const critical = items.filter((i) => !i.read && i.severity === "critical").length;
  const warn = items.filter((i) => !i.read && i.severity === "warn").length;
  const bellTone = critical > 0
    ? { color: ROSE, glow: `0 0 16px ${ROSE}` }
    : warn > 0
    ? { color: AMBER, glow: `0 0 14px ${AMBER}` }
    : { color: ACCENT_HSL, glow: "" };

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    const ids = items.filter((i) => !i.read).map((i) => i.id);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", ids);
  };

  const handleClick = async (n: AdminNotif) => {
    if (!n.read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    }
    const href = (n.data?.href as string) || "/admin";
    setOpen(false);
    navigate(href);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5",
        )}
        style={{
          background: "rgba(255,255,255,0.7)",
          border: "1px solid rgba(255,255,255,0.9)",
          boxShadow: unread > 0 && bellTone.glow ? bellTone.glow : "0 6px 18px -10px rgba(16,24,40,0.2)",
          color: unread > 0 ? bellTone.color : MUT,
        }}
        aria-label="Admin notifications"
        title="Admin notifications"
      >
        <Bell className="w-3.5 h-3.5" />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-white text-[9px] font-mono font-semibold flex items-center justify-center"
            style={{ background: bellTone.color, boxShadow: `0 4px 10px -2px ${bellTone.color}` }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-3 w-[380px] max-h-[520px] rounded-2xl border border-[#e7ebf3] bg-white z-50 flex flex-col overflow-hidden"
          style={{
            fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
            boxShadow: "0 40px 100px -30px rgba(16,24,40,0.35)",
          }}
        >
          <div className="px-5 py-4 flex items-center justify-between border-b border-[#eef1f6]">
            <div>
              <div className="text-[9px] uppercase tracking-[0.26em] font-mono" style={{ color: MUT2 }}>
                Operator Inbox
              </div>
              <div className="font-display text-[15px] font-semibold tracking-[-0.02em] mt-0.5" style={{ color: INK }}>
                {unread > 0 ? `${unread} new alert${unread === 1 ? "" : "s"}` : "All caught up"}
              </div>
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] uppercase tracking-[0.18em] font-mono flex items-center gap-1 transition-colors"
                style={{ color: MUT }}
              >
                <Check className="w-3 h-3" />
                Mark all
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12" style={{ color: MUT2 }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="text-[11px] uppercase tracking-[0.22em] font-mono" style={{ color: MUT2 }}>
                  No alerts yet
                </div>
                <div className="text-[12px] mt-2 font-light" style={{ color: MUT }}>
                  Purchases, support messages, and inquiries will surface here in realtime.
                </div>
              </div>
            ) : (
              <ul>
                {items.map((n, i) => {
                  const Icon = iconFor(n.type);
                  const t = tonesFor(n.severity);
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClick(n)}
                        className="group w-full text-left px-5 py-3 flex gap-3 border-b border-[#f1f3f8] transition-colors hover:bg-[#f4f7ff]"
                        style={{
                          background: !n.read
                            ? t.row
                            : i % 2 === 1
                            ? "#fafbfd"
                            : undefined,
                        }}
                      >
                        <div
                          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                          style={
                            n.read
                              ? { background: "rgba(16,24,40,0.05)", color: MUT2 }
                              : { background: t.bg, color: t.fg }
                          }
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div
                              className="text-[13px] truncate"
                              style={{ color: n.read ? MUT : INK }}
                            >
                              {n.title}
                            </div>
                            <div className="text-[9px] uppercase tracking-[0.18em] font-mono shrink-0" style={{ color: MUT2 }}>
                              {timeAgo(n.created_at)}
                            </div>
                          </div>
                          {n.body && (
                            <div className="text-[12px] mt-0.5 line-clamp-2 font-light" style={{ color: MUT }}>
                              {n.body}
                            </div>
                          )}
                        </div>
                        {!n.read && (
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0 mt-2.5"
                            style={{ background: t.dot, boxShadow: `0 0 6px ${t.dot}` }}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}