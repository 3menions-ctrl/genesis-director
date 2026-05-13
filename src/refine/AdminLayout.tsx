/**
 * Admin Layout — Editorial Noir
 * Single cohesive admin shell. NO studio links. Reorganized into 5 operator
 * sections (Pulse / People / Money / Content / System). Pro-Dark + #0A84FF.
 * Premium editorial pass: Fraunces nav labels, frosted operator card,
 * ambient grain + radial glow, refined typographic hierarchy.
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

type NavItem = { label: string; icon: React.ElementType; path: string; n: string };
type NavSection = { code: string; label: string; live?: boolean; items: NavItem[] };

const NAV: NavSection[] = [
  { code: "01", label: "Pulse", live: true, items: [
    { n: "01", label: "Telemetry",  icon: Activity,     path: "/admin" },
    { n: "02", label: "Production", icon: AlertOctagon, path: "/admin/production" },
  ]},
  { code: "02", label: "People", items: [
    { n: "03", label: "Identity",   icon: Users,         path: "/admin/users" },
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
    <span className="text-[10px] uppercase tracking-[0.28em] text-white/30 font-mono tabular-nums">
      {yyyy}.{mm}.{dd} <span className="text-white/15">//</span> {hh}:{mi}:{ss} UTC
    </span>
  );
});

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
      className="min-h-screen w-full bg-[#040506] text-white/80 flex selection:bg-[#0A84FF]/30 relative overflow-hidden"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Ambient grain */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.03] mix-blend-overlay"
        style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }}
      />
      {/* Atmospheric glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-60 right-0 w-[800px] h-[800px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(10,132,255,0.07), transparent 65%)", filter: "blur(80px)" }}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "relative z-10 border-r border-white/5 bg-[#040506]/70 backdrop-blur-xl flex flex-col shrink-0 transition-[width] duration-300",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        <div className="px-6 py-7 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#0A84FF] shadow-[0_0_10px_#0A84FF] shrink-0" />
            {!collapsed && (
              <span className="text-[10px] font-mono font-semibold tracking-[0.28em] text-white uppercase truncate">
                Admin Membrane
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-6 h-6 rounded-full border border-white/10 hover:border-[#0A84FF]/50 hover:text-[#0A84FF] text-white/40 flex items-center justify-center transition-colors"
            aria-label="Toggle sidebar"
          >
            <ChevronLeft className={cn("w-3 h-3 transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>

        <nav className="flex-1 px-5 py-4 space-y-8 overflow-y-auto">
          {NAV.map((section) => (
            <div key={section.code}>
              {!collapsed ? (
                <div className="text-[9px] text-white/30 mb-3 px-2 flex justify-between items-center font-mono font-semibold tracking-[0.28em] uppercase">
                  <span>{section.code} <span className="text-white/15">//</span> {section.label}</span>
                  {section.live && (
                    <span className="text-[#0A84FF]/70 italic normal-case tracking-normal text-[11px]" style={{ fontFamily: "'Fraunces', serif" }}>
                      live
                    </span>
                  )}
                </div>
              ) : (
                <div className="mx-auto mb-2 w-6 h-px bg-white/5" />
              )}
              <div className="space-y-1">
                {section.items.map(({ label, icon: Icon, path, n }) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={path === "/admin"}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                        isActive
                          ? "bg-[#0A84FF]/10 text-white"
                          : "text-white/45 hover:bg-white/[0.03] hover:text-white"
                      )
                    }
                    title={collapsed ? label : undefined}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                    {!collapsed && (
                      <>
                        <span
                          className="flex-1 truncate text-[14px]"
                          style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
                        >
                          {label}
                        </span>
                        <span className="text-[9px] opacity-25 font-mono tracking-wider">{n}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Operator card */}
        <div className="p-5">
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5",
            collapsed && "justify-center p-2 rounded-full"
          )}>
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-[#0A84FF]/40 via-[#0A84FF]/10 to-transparent border border-white/10 flex items-center justify-center text-white text-[12px] font-semibold shrink-0">
              {initial}
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[9px] text-white/40 uppercase tracking-[0.22em] font-mono leading-none mb-1">
                  Administrator
                </div>
                <div
                  className="text-[13px] text-white truncate"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  {user.email?.split("@")[0] || "Operator"}
                </div>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={() => signOut?.()}
                className="w-7 h-7 rounded-full border border-white/5 hover:border-red-500/40 hover:text-red-400 text-white/30 flex items-center justify-center transition-colors shrink-0"
                aria-label="Sign out"
                title="Sign out"
              >
                <Power className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="h-16 border-b border-white/5 px-10 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] shrink-0 bg-[#040506]/40 backdrop-blur-md">
          <div className="flex items-center gap-4 font-mono">
            <span className="text-white/20">Directory</span>
            <span className="text-white/10">/</span>
            <span className="text-white/30">{activeSection || "Pulse"}</span>
            <span className="text-white/10">/</span>
            <span className="text-white/70">{activeItem || "Telemetry"}</span>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse" />
              <span className="text-emerald-500/70 font-mono">Uptime 99.98%</span>
            </div>
            <Clock />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
