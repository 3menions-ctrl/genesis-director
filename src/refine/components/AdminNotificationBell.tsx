/**
 * AdminNotificationBell — realtime in-app alerts for admin operators.
 * Shows unread count badge, dropdown with recent admin notifications,
 * mark-as-read + click-through. Subscribes via Supabase Realtime so new
 * purchases, support messages, and sales inquiries appear instantly.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ShoppingBag, MessageSquare, Building2, Check, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type AdminNotifType = "admin_purchase" | "admin_support_message" | "admin_inquiry" | "admin_signup";

interface AdminNotif {
  id: string;
  type: AdminNotifType;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  read: boolean;
  created_at: string;
}

const ADMIN_TYPES: AdminNotifType[] = [
  "admin_purchase",
  "admin_support_message",
  "admin_inquiry",
  "admin_signup",
];

function iconFor(type: AdminNotifType) {
  if (type === "admin_purchase") return ShoppingBag;
  if (type === "admin_inquiry") return Building2;
  if (type === "admin_signup") return UserPlus;
  return MessageSquare;
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
      .select("id,type,title,body,data,read,created_at")
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
        className="relative w-8 h-8 rounded-full border border-white/10 hover:border-[#0A84FF]/50 hover:text-[#0A84FF] text-white/50 flex items-center justify-center transition-colors"
        aria-label="Admin notifications"
        title="Admin notifications"
      >
        <Bell className="w-3.5 h-3.5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#0A84FF] text-white text-[9px] font-mono font-semibold flex items-center justify-center shadow-[0_0_10px_#0A84FF]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-3 w-[380px] max-h-[520px] rounded-2xl border border-white/10 bg-[#070809]/95 backdrop-blur-xl shadow-2xl z-50 flex flex-col overflow-hidden"
          style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
        >
          <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
            <div>
              <div className="text-[9px] uppercase tracking-[0.3em] text-white/40 font-mono">
                Operator Inbox
              </div>
              <div
                className="text-[15px] text-white mt-0.5"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {unread > 0 ? `${unread} new alert${unread === 1 ? "" : "s"}` : "All caught up"}
              </div>
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-[#0A84FF] font-mono flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" />
                Mark all
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-white/30">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="text-[11px] text-white/30 uppercase tracking-[0.25em] font-mono">
                  No alerts yet
                </div>
                <div className="text-[12px] text-white/40 mt-2" style={{ fontFamily: "'Fraunces', serif" }}>
                  Purchases, support messages, and inquiries will surface here in realtime.
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {items.map((n) => {
                  const Icon = iconFor(n.type);
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClick(n)}
                        className={cn(
                          "w-full text-left px-5 py-3 flex gap-3 hover:bg-white/[0.03] transition-colors",
                          !n.read && "bg-[#0A84FF]/[0.04]"
                        )}
                      >
                        <div
                          className={cn(
                            "shrink-0 w-8 h-8 rounded-full flex items-center justify-center border",
                            n.read
                              ? "border-white/10 text-white/40"
                              : "border-[#0A84FF]/40 text-[#0A84FF] bg-[#0A84FF]/10"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div
                              className={cn(
                                "text-[13px] truncate",
                                n.read ? "text-white/70" : "text-white"
                              )}
                              style={{ fontFamily: "'Fraunces', serif" }}
                            >
                              {n.title}
                            </div>
                            <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-mono shrink-0">
                              {timeAgo(n.created_at)}
                            </div>
                          </div>
                          {n.body && (
                            <div className="text-[12px] text-white/50 mt-0.5 line-clamp-2">
                              {n.body}
                            </div>
                          )}
                        </div>
                        {!n.read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#0A84FF] shadow-[0_0_6px_#0A84FF] shrink-0 mt-2.5" />
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