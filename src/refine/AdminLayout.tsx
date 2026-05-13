/**
 * Admin Layout — Tactical Operator HUD
 * Single cohesive admin shell. NO studio links. Reorganized into 5 operator
 * sections (Pulse / People / Money / Content / System). Pro-Dark + #0A84FF.
 */
import { useState, useEffect, memo } from "react";
import { Outlet, NavLink, useLocation, Navigate } from "react-router-dom";
import {
  Activity, AlertOctagon, Users, MessageSquare, DollarSign, Coins,
  FolderKanban, Shield, Mail, Settings, Loader2, ChevronLeft, Power,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── Nav model ────────────────────────────────────────────────────────────────
type NavItem = { label: string; icon: React.ElementType; path: string; n: string };
type NavSection = { code: string; label: string; live?: boolean; items: NavItem[] };

const NAV: NavSection[] = [
  { code: "01", label: "Pulse", live: true, items: [
    { n: "01", label: "Telemetry",  icon: Activity,     path: "/admin" },
    { n: "02", label: "Production", icon: AlertOctagon, path: "/admin/production" },
  ]},
  { code: "02", label: "People", items: [
    { n: "03", label: "Identity",   icon: Users,        path: "/admin/users" },
    { n: "04", label: "Inbox",      icon: MessageSquare, path: "/admin/messages" },
  ]},
  { code: "03", label: "Money", items: [
    { n: "05", label: "Treasury",   icon: DollarSign,   path: "/admin/finance" },
    { n: "06", label: "Ledger",     icon: Coins,        path: "/admin/credits" },
  ]},
  { code: "04", label: "Content", items: [
    { n: "07", label: "Projects",   icon: FolderKanban, path: "/admin/projects" },
    { n: "08", label: "Moderation", icon: Shield,       path: "/admin/moderation" },
  ]},
  { code: "05", label: "System", items: [
    { n: "09", label: "Emails",     icon: Mail,         path: "/admin/emails" },
    { n: "10", label: "Config",     icon: Settings,     path: "/admin/config" },
  ]},
];

// ─── Status bar clock ─────────────────────────────────────────────────────────
const Clock = memo(function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const yyyy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mi = String(t.getUTCMinutes()).padStart(2, "0");
  const ss = String(t.getUTCSeconds()).padStart(2, "0");
  return (
    <span className="text-[10px] uppercase tracking-[0.28em] text-white/40 font-mono tabular-nums">
      {yyyy}.{mm}.{dd} <span className="text-white/20">//</span> {hh}:{mi}:{ss} UTC
    </span>
  );
});

// ─── Layout ───────────────────────────────────────────────────────────────────
export function RefineAdminLayout() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data, error } = await supabase.rpc("is_admin", { _user_id: user.id });
      setIsAdmin(error ? false : data === true);
    };
    check();
  }, [user]);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-[#040506] flex items-center justify-center">
        <Loader2 className="w-4 h-4 text-[#0A84FF] animate-spin" />
        <span className="ml-3 text-[10px] uppercase tracking-[0.32em] text-white/40 font-mono">
          Verifying privileged access…
        </span>
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/" replace />;

  // Active section breadcrumb
  let activeSection = "";
  let activeItem = "";
  for (const s of NAV) {
    for (const it of s.items) {
      const active = it.path === "/admin"
        ? location.pathname === "/admin"
        : location.pathname === it.path || location.pathname.startsWith(`${it.path}/`);
      if (active) { activeSection = s.label; activeItem = it.label; }
    }
  }

  const initial = (user.email?.[0] || "C").toUpperCase();

  return (
    <div
      className="min-h-screen w-full bg-[#040506] text-slate-400 flex selection:bg-[#0A84FF]/30"
      style={{ fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}
    >
      {/* ─── Sidebar ─── */}
      <aside
        className={cn(
          "border-r border-white/5 bg-[#040506] flex flex-col shrink-0 transition-[width] duration-300",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Brand row */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#0A84FF] shadow-[0_0_8px_#0A84FF] shrink-0" />
            {!collapsed && (
              <span className="text-[11px] font-bold tracking-[0.22em] text-white uppercase truncate">
                Admin Membrane
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-6 h-6 rounded border border-white/10 hover:border-[#0A84FF]/50 hover:text-[#0A84FF] text-white/40 flex items-center justify-center transition-colors"
            aria-label="Toggle sidebar"
          >
            <ChevronLeft className={cn("w-3 h-3 transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 pt-6 space-y-7 overflow-y-auto">
          {NAV.map((section) => (
            <div key={section.code}>
              {!collapsed ? (
                <div className="text-[10px] text-slate-600 mb-3 px-2 flex justify-between items-center font-bold tracking-widest uppercase">
                  <span>{section.code} <span className="text-slate-700">//</span> {section.label}</span>
                  {section.live && (
                    <span className="text-[#0A84FF]/50 italic underline underline-offset-4 not-uppercase">
                      live
                    </span>
                  )}
                </div>
              ) : (
                <div className="mx-auto mb-2 w-6 h-px bg-white/5" />
              )}
              <div className="space-y-0.5">
                {section.items.map(({ label, icon: Icon, path, n }) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={path === "/admin"}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 px-3 py-2 text-[12px] transition-all",
                        isActive
                          ? "bg-[#0A84FF]/10 text-white border-l-2 border-[#0A84FF] pl-[10px]"
                          : "text-slate-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-[10px]"
                      )
                    }
                    title={collapsed ? label : undefined}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{label}</span>
                        <span className="text-[10px] opacity-30 font-mono">{n}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Operator card */}
        <div className="p-4 border-t border-white/5">
          <div className={cn(
            "flex items-center gap-3",
            collapsed && "justify-center"
          )}>
            <div className="relative w-9 h-9 rounded bg-[#0A84FF]/15 border border-[#0A84FF]/40 flex items-center justify-center text-[#0A84FF] text-[12px] font-bold shrink-0">
              {initial}
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#0A84FF] shadow-[0_0_6px_#0A84FF]" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-white font-bold truncate">
                  {user.email?.split("@")[0] || "Operator"}
                </div>
                <div className="text-[9px] text-[#0A84FF] uppercase tracking-[0.22em] font-mono">
                  Super_Admin
                </div>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={() => signOut?.()}
                className="w-7 h-7 rounded border border-white/5 hover:border-red-500/40 hover:text-red-400 text-white/30 flex items-center justify-center transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <Power className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Status bar */}
        <header className="h-14 border-b border-white/5 px-8 flex items-center justify-between text-[11px] uppercase tracking-widest shrink-0 bg-[#040506]/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="text-slate-600">Directory</span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-500">{activeSection || "Pulse"}</span>
            <span className="text-slate-700">/</span>
            <span className="text-white">{activeItem || "Telemetry"}</span>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              <span className="text-emerald-500/80 font-mono">Uptime 99.98%</span>
            </div>
            <Clock />
          </div>
        </header>

        {/* Outlet */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
