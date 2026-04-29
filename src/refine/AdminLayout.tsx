/**
 * Admin Layout — Maximalist Cinematic
 * Pro-Dark + cinematic blue (#0A84FF), conic aurora, glass rail with sliding indicator,
 * diagnostic ticker, signature ENC plate. Aligns with Settings/Profile/Pricing system.
 */
import { useState, useEffect, useRef, useLayoutEffect, memo } from "react";
import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, Users, FolderKanban, DollarSign, History,
  MessageSquare, Shield, ChevronLeft, Settings, Coins, Loader2, Calculator,
  Activity, AlertTriangle, Film, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/layout/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NavSection {
  label: string;
  code: string;
  items: { key: string; label: string; icon: React.ElementType; path: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  { label: "Overview", code: "OVR", items: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  ]},
  { label: "Manage", code: "MNG", items: [
    { key: "users", label: "Users", icon: Users, path: "/admin/users" },
    { key: "projects", label: "Projects", icon: FolderKanban, path: "/admin/projects" },
    { key: "credits", label: "Transactions", icon: Coins, path: "/admin/credits" },
    { key: "messages", label: "Support", icon: MessageSquare, path: "/admin/messages" },
  ]},
  { label: "Finance", code: "FIN", items: [
    { key: "financials", label: "Financials", icon: DollarSign, path: "/admin/financials" },
    { key: "costs", label: "Cost Analysis", icon: Calculator, path: "/admin/costs" },
  ]},
  { label: "Production", code: "PRD", items: [
    { key: "pipeline", label: "Pipeline", icon: Activity, path: "/admin/pipeline" },
    { key: "failed", label: "Failed Clips", icon: AlertTriangle, path: "/admin/failed" },
  ]},
  { label: "System", code: "SYS", items: [
    { key: "audit", label: "Audit Log", icon: History, path: "/admin/audit" },
    { key: "packages", label: "Packages", icon: Coins, path: "/admin/packages" },
    { key: "moderation", label: "Moderation", icon: Shield, path: "/admin/moderation" },
    { key: "gallery", label: "Gallery", icon: Film, path: "/admin/gallery" },
    { key: "avatars", label: "Avatars", icon: Sparkles, path: "/admin/avatars" },
    { key: "config", label: "Config", icon: Settings, path: "/admin/config" },
    { key: "inventory", label: "Inventory", icon: FileText, path: "/admin/inventory" },
  ]},
];

// ─── Atmospheric backdrop ─────────────────────────────────────────────────────
const AdminAtmosphere = memo(function AdminAtmosphere() {
  return (
    <>
      <style>{`
        @keyframes adminAurora { to { transform: rotate(360deg); } }
        @keyframes adminTick { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
        @keyframes adminFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes adminScan { 0% { transform: translateY(-100%); } 100% { transform: translateY(120vh); } }
      `}</style>
      <div className="fixed inset-0 -z-50 bg-[hsl(220,14%,2%)]" aria-hidden />
      <div
        className="fixed inset-0 -z-40 pointer-events-none"
        style={{
          background:
            'conic-gradient(from 0deg at 30% 40%, transparent 0deg, hsla(215,100%,60%,0.30) 60deg, transparent 130deg, hsla(210,100%,55%,0.18) 220deg, transparent 300deg, hsla(215,100%,60%,0.24) 360deg)',
          filter: 'blur(95px)',
          animation: 'adminAurora 80s linear infinite',
          opacity: 0.8,
        }}
        aria-hidden
      />
      <div
        className="fixed -z-30 pointer-events-none rounded-full"
        style={{
          width: 700, height: 700, top: '-20%', right: '-15%',
          background: 'radial-gradient(circle, hsla(215,100%,60%,0.16), transparent 65%)',
          filter: 'blur(60px)', animation: 'adminFloat 16s ease-in-out infinite',
        }}
        aria-hidden
      />
      <div
        className="fixed -z-30 pointer-events-none rounded-full"
        style={{
          width: 520, height: 520, bottom: '-12%', left: '-8%',
          background: 'radial-gradient(circle, hsla(210,100%,55%,0.13), transparent 65%)',
          filter: 'blur(70px)', animation: 'adminFloat 20s ease-in-out infinite reverse',
        }}
        aria-hidden
      />
      <div
        className="fixed inset-x-0 -z-20 pointer-events-none h-[40vh]"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, hsla(215,100%,68%,0.04) 50%, transparent 100%)',
          animation: 'adminScan 22s linear infinite',
        }}
        aria-hidden
      />
      <div
        className="fixed inset-0 -z-20 pointer-events-none opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.06 0 0 0 0 0.07 0 0 0 0 0.08 0 0 0 0.65 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
        aria-hidden
      />
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, hsla(220,14%,1%,0.85) 100%)' }}
        aria-hidden
      />
    </>
  );
});

// ─── Diagnostic ticker ────────────────────────────────────────────────────────
const AdminTicker = memo(function AdminTicker({ user }: { user: any }) {
  const items = [
    { code: "ADM", label: "Console" },
    { code: "RLS", label: "Verified" },
    { code: "LIVE", label: "Stream" },
  ];
  return (
    <div className="inline-flex items-center gap-4 px-4 py-1.5 rounded-full bg-[hsla(220,14%,4%,0.6)] border border-[hsla(215,100%,60%,0.14)] backdrop-blur-xl">
      {items.map((item, i) => (
        <div key={item.code} className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[hsl(215,100%,60%)]"
            style={{ animation: `adminTick 2.4s ease-in-out infinite`, animationDelay: `${i * 0.4}s` }}
          />
          <span className="text-[10px] uppercase tracking-[0.32em] text-white/55 font-mono">
            {item.code} <span className="text-white/30">/</span> {item.label}
          </span>
        </div>
      ))}
      <span className="text-[10px] uppercase tracking-[0.32em] text-white/35 font-mono hidden md:inline">
        ENC-{(user?.id || '').slice(0, 4).toUpperCase()}
      </span>
    </div>
  );
});

export function RefineAdminLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data, error } = await supabase.rpc("is_admin", { _user_id: user.id });
      setIsAdmin(error ? false : data === true);
    };
    checkAdmin();
  }, [user]);

  // Slide active indicator
  useLayoutEffect(() => {
    if (!navRef.current) return;
    const el = navRef.current.querySelector<HTMLElement>('[data-active="true"]');
    if (el) {
      setIndicator({ top: el.offsetTop, height: el.offsetHeight });
    } else {
      setIndicator(null);
    }
  }, [location.pathname, collapsed]);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-[hsl(220,14%,2%)] flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[hsl(215,100%,68%)] animate-spin" />
        <span className="ml-3 text-[12px] uppercase tracking-[0.3em] text-white/45 font-mono">
          Verifying admin access…
        </span>
      </div>
    );
  }

  if (!user || isAdmin === false) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen text-white relative">
      <AdminAtmosphere />
      <AppHeader showCreate={false} />

      <div className="relative flex">
        {/* ─── Sidebar Rail ─── */}
        <aside
          className={cn(
            "sticky top-14 h-[calc(100vh-56px)] transition-all duration-300 shrink-0 overflow-hidden",
            collapsed ? "w-16" : "w-64"
          )}
        >
          {/* Glass surface */}
          <div className="absolute inset-0 bg-[hsla(220,14%,4%,0.55)] backdrop-blur-2xl" />
          {/* Right luminous edge */}
          <div className="absolute top-0 bottom-0 right-0 w-px"
            style={{ background: 'linear-gradient(180deg, transparent, hsla(215,100%,60%,0.4), transparent)' }} />
          {/* Top hairline */}
          <div className="absolute top-0 left-3 right-3 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, hsla(215,100%,68%,0.5), transparent)' }} />

          <div className="relative h-full overflow-y-auto p-3 space-y-5 pb-24">
            {/* Header / Collapse */}
            <div className="flex items-center justify-between px-1 py-1">
              {!collapsed && (
                <span className="text-[10px] uppercase tracking-[0.4em] text-[hsl(215,100%,68%)] font-mono">
                  CONSOLE
                </span>
              )}
              <button
                onClick={() => setCollapsed(!collapsed)}
                className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-lg border border-[hsla(215,100%,60%,0.18)] hover:border-[hsla(215,100%,60%,0.45)] hover:bg-[hsla(215,100%,60%,0.08)] transition-all",
                  collapsed && "mx-auto"
                )}
                aria-label="Toggle sidebar"
              >
                <ChevronLeft
                  className={cn(
                    "w-3.5 h-3.5 text-[hsl(215,100%,68%)] transition-transform duration-200",
                    collapsed && "rotate-180"
                  )}
                />
              </button>
            </div>

            {/* Sliding active indicator */}
            <div ref={navRef} className="relative space-y-5">
              {indicator && (
                <div
                  className="absolute left-0 right-0 rounded-xl pointer-events-none transition-all duration-300 ease-out"
                  style={{
                    top: indicator.top,
                    height: indicator.height,
                    background: 'linear-gradient(135deg, hsla(215,100%,60%,0.18), hsla(210,100%,55%,0.10))',
                    border: '1px solid hsla(215,100%,60%,0.35)',
                    boxShadow: '0 10px 30px -10px hsla(215,100%,60%,0.6), inset 0 0 0 1px hsla(215,100%,75%,0.06)',
                  }}
                >
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-3/5 w-[2px] rounded-r"
                    style={{ background: 'linear-gradient(180deg, hsl(215,100%,72%), hsl(210,100%,55%))', boxShadow: '0 0 12px hsla(215,100%,60%,0.7)' }} />
                </div>
              )}

              {NAV_SECTIONS.map((section) => (
                <div key={section.label} className="relative">
                  {!collapsed ? (
                    <div className="flex items-center gap-2 px-2 mb-2">
                      <span className="text-[9px] font-semibold text-[hsl(215,100%,68%)] uppercase tracking-[0.32em] font-mono">
                        {section.code}
                      </span>
                      <span className="text-[9px] font-semibold text-white/30 uppercase tracking-[0.2em]">
                        {section.label}
                      </span>
                      <div className="flex-1 h-px"
                        style={{ background: 'linear-gradient(90deg, hsla(215,100%,60%,0.18), transparent)' }} />
                    </div>
                  ) : (
                    <div className="mx-auto mb-2 w-6 h-px" style={{ background: 'hsla(215,100%,60%,0.25)' }} />
                  )}

                  <div className="space-y-0.5">
                    {section.items.map(({ key, label, icon: Icon, path }) => {
                      const active = location.pathname === path;
                      return (
                        <Link
                          key={key}
                          to={path}
                          data-active={active ? "true" : undefined}
                          className={cn(
                            "relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-200 group",
                            active
                              ? "text-white"
                              : "text-white/45 hover:text-white hover:bg-[hsla(215,100%,60%,0.06)]"
                          )}
                          title={collapsed ? label : undefined}
                        >
                          <span className={cn(
                            "flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-all border",
                            active
                              ? "bg-[hsla(215,100%,60%,0.18)] border-[hsla(215,100%,60%,0.5)] text-[hsl(215,100%,75%)]"
                              : "bg-[hsla(220,14%,5%,0.5)] border-white/[0.06] text-white/55 group-hover:border-[hsla(215,100%,60%,0.25)] group-hover:text-[hsl(215,100%,72%)]"
                          )}>
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate uppercase tracking-[0.12em] text-[11px]">{label}</span>
                              {active && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(215,100%,68%)] shadow-[0_0_8px_hsla(215,100%,60%,0.9)]" />
                              )}
                            </>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin badge */}
          <div className={cn(
            "absolute bottom-4 left-3 right-3 z-10",
            collapsed && "left-2 right-2"
          )}>
            <div className="relative overflow-hidden rounded-xl bg-[hsla(220,14%,4%,0.7)] border border-[hsla(215,100%,60%,0.28)] backdrop-blur-xl">
              <div
                className="absolute inset-0 opacity-70 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 0% 0%, hsla(215,100%,60%,0.22), transparent 60%)' }}
              />
              <div className={cn("relative flex items-center", collapsed ? "justify-center p-2" : "gap-2 px-3 py-2.5")}>
                <span className="relative flex items-center justify-center w-6 h-6 rounded-md bg-[hsla(215,100%,60%,0.18)] border border-[hsla(215,100%,60%,0.45)]">
                  <Shield className="w-3 h-3 text-[hsl(215,100%,75%)]" />
                  <span
                    className="absolute inset-0 rounded-md"
                    style={{ animation: 'adminTick 2s ease-in-out infinite', boxShadow: '0 0 14px hsla(215,100%,60%,0.7)' }}
                  />
                </span>
                {!collapsed && (
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[hsl(215,100%,82%)]">
                      Admin Mode
                    </span>
                    <span className="text-[9px] uppercase tracking-[0.25em] text-white/40 font-mono">
                      Privileged · RLS
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* ─── Main content ─── */}
        <main className="flex-1 min-w-0 p-6 lg:p-8 space-y-6">
          {/* Eyebrow ticker */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <AdminTicker user={user} />
            <div className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40 font-mono">
              <span className="w-1 h-1 rounded-full bg-[hsl(215,100%,68%)]"
                style={{ animation: 'adminTick 2.4s ease-in-out infinite' }} />
              APEX STUDIO · ADMIN MEMBRANE
            </div>
          </div>

          {/* Outlet wrapper with subtle frame */}
          <div className="relative">
            <div className="absolute inset-x-0 -top-3 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, hsla(215,100%,60%,0.35), transparent)' }} />
            <Outlet />
          </div>

          {/* Footer plate */}
          <div className="relative pt-6 flex flex-col items-center gap-2">
            <div className="h-px w-32"
              style={{ background: 'linear-gradient(90deg, transparent, hsla(215,100%,68%,0.6), transparent)' }} />
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-white/30 font-mono">
              <span className="w-1 h-1 rounded-full bg-[hsl(215,100%,68%)]"
                style={{ animation: 'adminTick 2.4s ease-in-out infinite' }} />
              CONSOLE · SECURE CHANNEL · ENC-{(user?.id || '').slice(0, 4).toUpperCase()}
              <span className="w-1 h-1 rounded-full bg-[hsl(215,100%,68%)]"
                style={{ animation: 'adminTick 2.4s ease-in-out infinite', animationDelay: '0.6s' }} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
