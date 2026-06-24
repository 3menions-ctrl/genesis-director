/**
 * Admin Layout — Editorial Noir
 * Single cohesive admin shell. Consolidated into 9 nav items (was 47): a
 * Dashboard, five Hub pages (People / Production / Money / Growth / System)
 * each with internal tabs, and two Tools entries (Audit / Config). The ⌘K
 * palette is the primary navigation device — typing an email or project
 * title jumps directly to the right profile.
 * Deep-dark + single cinema accent hsl(214 90% 62%). Borderless gradient
 * glass surfaces, Fraunces nav labels, frosted operator card, ambient grain
 * + radial glow, refined typographic hierarchy.
 */
import { useState, useEffect, memo } from "react";
import { Outlet, NavLink, useLocation, Navigate } from "react-router-dom";
import {
  Activity, Users, FolderKanban, Loader2, Power,
  Lock, Wallet, TrendingUp, Zap, Settings, ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { OpsAccessProvider, useOpsAccess } from "./rbac/OpsAccessProvider";
import { OpsRouteGuard } from "./rbac/OpsRouteGuard";
import { scopeForPath } from "./rbac/scopes";
import { AdminNotificationBell } from "./components/AdminNotificationBell";
import { AdminPalette } from "./components/AdminPalette";
import { ACCENT_HSL, accent, Aurora } from "@/admin/ui/primitives";
import "./admin-skin.css";

type NavItem = { label: string; icon: React.ElementType; path: string; n: string };
type NavSection = { code: string; label: string; live?: boolean; items: NavItem[] };

// Consolidated 9-item nav (was 47). Hubs absorb the old sub-pages — every
// legacy /admin/<sub> route still works for deep links, but the operator's
// primary surface is now just hubs + the dashboard + entity profiles. Hit
// ⌘K to jump anywhere by name.
const NAV: NavSection[] = [
  { code: "01", label: "Pulse", live: true, items: [
    { n: "01", label: "Dashboard",  icon: Activity, path: "/admin" },
  ]},
  { code: "02", label: "Hubs", items: [
    { n: "02", label: "People",     icon: Users,          path: "/admin/people" },
    { n: "03", label: "Production", icon: FolderKanban,   path: "/admin/production-hub" },
    { n: "04", label: "Money",      icon: Wallet,         path: "/admin/money" },
    { n: "05", label: "Growth",     icon: TrendingUp,     path: "/admin/growth" },
    { n: "06", label: "System",     icon: Zap,            path: "/admin/system" },
  ]},
  { code: "03", label: "Tools", items: [
    { n: "07", label: "Audit",      icon: ScrollText,     path: "/admin/audit" },
    { n: "08", label: "Config",     icon: Settings,       path: "/admin/config" },
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

function RefineAdminLayoutInner() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const { hasScope } = useOpsAccess();

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
      <div className="min-h-screen bg-[#06070a] flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: ACCENT_HSL }} />
        <span className="ml-3 text-[10px] uppercase tracking-[0.32em] text-white/45 font-mono">
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
      className="admin-skin min-h-screen w-full bg-[#06070a] text-white/70 flex selection:bg-[hsl(214_90%_62%/0.3)] relative overflow-hidden"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Ambient grain */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.03] mix-blend-overlay"
        style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }}
      />
      {/* Deep aurora atmosphere — figures float over it (Horizon direction). */}
      <Aurora />

      {/* Icon rail — large icons, small labels below */}
      <aside
        className="relative z-10 w-[104px] backdrop-blur-xl flex flex-col shrink-0"
        style={{ background: "linear-gradient(165deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015) 60%, rgba(255,255,255,0.01))", boxShadow: "0 30px 90px -50px rgba(0,0,0,0.95)" }}
      >
        {/* top specular highlight */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }} />

        {/* Brand mark */}
        <div className="flex flex-col items-center gap-2 pt-7 pb-5">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: `linear-gradient(140deg, ${accent(0.95)}, ${accent(0.22)})`, boxShadow: `0 0 24px ${accent(0.5)}` }}
          >
            <Activity className="w-[18px] h-[18px] text-white" />
          </div>
          <span className="text-[8px] font-mono font-semibold tracking-[0.26em] text-white/40 uppercase">Membrane</span>
        </div>

        {/* Nav rail */}
        <nav className="flex-1 flex flex-col items-center gap-1 px-2.5 py-2 overflow-y-auto">
          {NAV.map((section, si) => (
            <div key={section.code} className="w-full flex flex-col items-center gap-1">
              {si > 0 && <span aria-hidden className="my-2.5 w-9 h-px bg-white/[0.07]" />}
              {section.items.map(({ label, icon: Icon, path }) => {
                const allowed = hasScope(scopeForPath(path));
                return (
                  <NavLink
                    key={path}
                    to={path}
                    end={path === "/admin"}
                    onClick={(e) => { if (!allowed) e.preventDefault(); }}
                    aria-disabled={!allowed}
                    tabIndex={allowed ? undefined : -1}
                    title={!allowed ? `Locked · ${scopeForPath(path)} scope required` : label}
                    className={({ isActive }) =>
                      cn(
                        "admin-rail-item group relative w-full flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-colors",
                        !allowed && "opacity-40 cursor-not-allowed",
                        isActive ? "is-active" : "hover:bg-white/[0.03]"
                      )
                    }
                  >
                    <span
                      className={cn(
                        "relative w-12 h-12 rounded-2xl grid place-items-center transition-all",
                        "bg-white/[0.04] text-white/55",
                        "group-hover:bg-white/[0.08] group-hover:text-white",
                        "group-[.is-active]:bg-[hsl(214_90%_62%/0.16)] group-[.is-active]:text-[hsl(214_90%_62%)]",
                        "group-[.is-active]:ring-1 group-[.is-active]:ring-[hsl(214_90%_62%/0.4)]",
                        "group-[.is-active]:shadow-[0_0_26px_-4px_hsl(214_90%_62%/0.65)]"
                      )}
                    >
                      <Icon className="w-[22px] h-[22px]" />
                      {!allowed && (
                        <Lock className="absolute -bottom-1 -right-1 w-4 h-4 text-white/55 bg-[#06070a] rounded-full p-0.5" />
                      )}
                    </span>
                    <span className="text-[10px] tracking-wide leading-none text-center text-white/40 group-hover:text-white/70 group-[.is-active]:text-white">
                      {label}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Operator */}
        <div className="flex flex-col items-center gap-2.5 py-5">
          <div
            className="relative w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-semibold"
            style={{ background: `linear-gradient(135deg, ${accent(0.4)}, ${accent(0.08)})` }}
            title={`Administrator · ${user.email ?? "Operator"}`}
          >
            {initial}
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
          </div>
          <button
            onClick={() => signOut?.()}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-[hsl(350_90%_70%/0.16)] hover:text-[hsl(350_90%_70%)] text-white/40 flex items-center justify-center transition-colors"
            aria-label="Sign out"
            title="Sign out"
          >
            <Power className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="relative h-16 px-10 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] shrink-0 bg-white/[0.02] backdrop-blur-md">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)" }} />
          <div className="flex items-center gap-4 font-mono">
            <span className="text-white/25">Directory</span>
            <span className="text-white/15">/</span>
            <span className="text-white/35">{activeSection || "Pulse"}</span>
            <span className="text-white/15">/</span>
            <span className="text-white/70">{activeItem || "Telemetry"}</span>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse" />
              <span className="text-emerald-400/70 font-mono">Uptime 99.98%</span>
            </div>
            <button
              type="button"
              onClick={() => {
                document.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
                );
              }}
              className="hidden md:flex items-center gap-2 px-3 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/55 hover:text-white transition-colors font-mono normal-case"
              title="Open command palette (⌘K)"
            >
              <span className="text-[11px] tracking-[0.12em]">Search…</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.08] text-white/60">⌘K</kbd>
            </button>
            <Clock />
            <AdminNotificationBell />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <OpsRouteGuard>
            <Outlet />
          </OpsRouteGuard>
        </div>
      </main>

      {/* ⌘K admin command palette — global to every admin page */}
      <AdminPalette />
    </div>
  );
}

export function RefineAdminLayout() {
  return (
    <OpsAccessProvider>
      <RefineAdminLayoutInner />
    </OpsAccessProvider>
  );
}
