/**
 * Admin Layout — "Floating Analysis" LIGHT
 * Single cohesive admin shell on a bright, colorful aura. A 96px left icon
 * rail (icons + labels, color-coded per destination, gradient active pill),
 * the operator card pinned at the bottom of the rail, and a borderless main
 * stage where data floats directly on the aurora. Consolidated 8-item nav: a
 * Dashboard, five Hub pages (People / Production / Money / Growth / System)
 * each with internal tabs, and two Tools entries (Audit / Config). The ⌘K
 * palette is the primary navigation device — typing an email or project title
 * jumps directly to the right profile.
 */
import { useState, useEffect, memo } from "react";
import { Outlet, NavLink, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FolderKanban, Loader2, Power,
  Lock, Wallet, TrendingUp, Cpu, Settings, ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { OpsAccessProvider, useOpsAccess } from "./rbac/OpsAccessProvider";
import { OpsRouteGuard } from "./rbac/OpsRouteGuard";
import { scopeForPath } from "./rbac/scopes";
import { AdminNotificationBell } from "./components/AdminNotificationBell";
import { AdminPalette } from "./components/AdminPalette";
import { ACCENT_HSL, INK, MUT, MUT2, CYAN, VIOLET, EMERALD, AMBER, MAGENTA } from "@/admin/ui/primitives";
import "./admin-skin.css";

type NavItem = { label: string; icon: React.ElementType; path: string; n: string; tint: string };
type NavSection = { code: string; label: string; live?: boolean; items: NavItem[] };

// Consolidated 8-item nav (was 47). Hubs absorb the old sub-pages — every
// legacy /admin/<sub> route still works for deep links, but the operator's
// primary surface is now just hubs + the dashboard + entity profiles. Hit
// ⌘K to jump anywhere by name. `tint` is the per-destination accent on the rail.
const NAV: NavSection[] = [
  { code: "01", label: "Pulse", live: true, items: [
    { n: "01", label: "Overview",   icon: LayoutDashboard, path: "/admin",               tint: ACCENT_HSL },
  ]},
  { code: "02", label: "Hubs", items: [
    { n: "02", label: "People",     icon: Users,          path: "/admin/people",         tint: ACCENT_HSL },
    { n: "03", label: "Studio",     icon: FolderKanban,   path: "/admin/production-hub",  tint: CYAN },
    { n: "04", label: "Money",      icon: Wallet,         path: "/admin/money",          tint: VIOLET },
    { n: "05", label: "Growth",     icon: TrendingUp,     path: "/admin/growth",         tint: EMERALD },
    { n: "06", label: "System",     icon: Cpu,            path: "/admin/system",         tint: AMBER },
  ]},
  { code: "03", label: "Tools", items: [
    { n: "07", label: "Audit",      icon: ScrollText,     path: "/admin/audit",          tint: MAGENTA },
    { n: "08", label: "Config",     icon: Settings,       path: "/admin/config",         tint: VIOLET },
  ]},
];

// Flat list for the rail — the section grouping is preserved in NAV (and read
// by the sidebar-route test) but the rail renders one continuous icon column.
const RAIL_ITEMS: NavItem[] = NAV.flatMap((s) => s.items);

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
    <span className="font-mono text-[10px] uppercase tracking-[0.22em] tabular-nums" style={{ color: MUT2 }}>
      {yyyy}.{mm}.{dd} <span style={{ color: "#cfd6e4" }}>//</span> {hh}:{mi}:{ss} UTC
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(150deg,#e6efff,#f0ecff 38%,#ffeef6 70%,#eafcff)" }}>
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: ACCENT_HSL }} />
        <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.32em]" style={{ color: MUT }}>
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
      className="admin-skin min-h-screen w-full flex relative overflow-hidden"
      style={{
        background: "linear-gradient(150deg,#e6efff 0%,#f0ecff 38%,#ffeef6 70%,#eafcff 100%)",
        color: INK,
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Aurora blobs — the data floats directly on this. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <span className="absolute rounded-full" style={{ width: 560, height: 560, left: -140, top: -180, background: "#3f7bff", filter: "blur(110px)", opacity: 0.5 }} />
        <span className="absolute rounded-full" style={{ width: 480, height: 480, right: -110, top: 40, background: "#b07bff", filter: "blur(110px)", opacity: 0.45 }} />
        <span className="absolute rounded-full" style={{ width: 440, height: 440, left: "38%", bottom: -200, background: "#34e3ff", filter: "blur(110px)", opacity: 0.42 }} />
        <span className="absolute rounded-full" style={{ width: 380, height: 380, right: "16%", bottom: -150, background: "#ff8fc4", filter: "blur(110px)", opacity: 0.4 }} />
      </div>

      {/* ── Left icon rail ── */}
      <aside
        className="relative z-10 flex w-[92px] shrink-0 flex-col py-4"
        style={{
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(28px) saturate(1.5)",
          WebkitBackdropFilter: "blur(28px) saturate(1.5)",
          borderRight: "1px solid rgba(255,255,255,0.7)",
          boxShadow: "8px 0 40px -22px rgba(16,24,40,0.18)",
        }}
      >
        {/* Brand mark */}
        <div className="mx-auto mb-4 mt-0.5 grid h-[42px] w-[42px] place-items-center rounded-[13px] text-[14px] font-extrabold text-white"
          style={{ background: "linear-gradient(135deg,#2f6bff,#7c3aed)", boxShadow: "0 12px 26px -8px rgba(124,58,237,0.6)" }}>
          SB
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1">
          {RAIL_ITEMS.map(({ label, icon: Icon, path, tint }) => {
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
                    "admin-rail-item group relative flex flex-col items-center gap-[5px] py-[9px] transition-colors",
                    !allowed && "opacity-40 cursor-not-allowed",
                    isActive ? "is-active" : "",
                  )
                }
                style={({ isActive }: { isActive: boolean }) => ({ color: isActive ? tint : MUT })}
              >
                {/* active left bar + soft pill */}
                <span aria-hidden className="pointer-events-none absolute left-0 top-2 bottom-2 w-[3px] rounded-r-[3px] opacity-0 transition-opacity group-[.is-active]:opacity-100"
                  style={{ background: "linear-gradient(180deg,#2f6bff,#7c3aed)" }} />
                <span aria-hidden className="pointer-events-none absolute inset-x-3 inset-y-1 -z-0 rounded-2xl opacity-0 transition-opacity group-[.is-active]:opacity-100"
                  style={{ background: "linear-gradient(160deg,rgba(47,107,255,0.14),rgba(124,58,237,0.08))" }} />
                <span className="relative flex h-[21px] w-[21px] items-center justify-center">
                  <Icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
                  {!allowed && <Lock className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5" style={{ color: MUT2 }} />}
                </span>
                <span className="relative font-mono text-[8px] font-semibold uppercase tracking-[0.04em]">{label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Operator footer */}
        <div className="mt-auto flex flex-col items-center gap-1.5 px-2 pt-3">
          <div className="relative grid h-[30px] w-[30px] place-items-center rounded-full text-[11px] font-bold text-white"
            style={{ background: "linear-gradient(135deg,#fb7185,#f59e0b)" }}>
            {initial}
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px rgba(16,185,129,0.7)" }} />
          </div>
          <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.06em]" style={{ color: MUT }}>Admin</span>
          <button
            onClick={() => signOut?.()}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
            style={{ background: "rgba(16,24,40,0.05)", color: MUT }}
            aria-label="Sign out"
            title="Sign out"
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(244,63,94,0.12)"; e.currentTarget.style.color = "#e11d48"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(16,24,40,0.05)"; e.currentTarget.style.color = MUT; }}
          >
            <Power className="h-3 w-3" />
          </button>
        </div>
      </aside>

      {/* ── Main stage ── */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="relative flex h-16 shrink-0 items-center justify-between px-10">
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em]">
            <span style={{ color: MUT2 }}>Directory</span>
            <span style={{ color: "#cfd6e4" }}>/</span>
            <span style={{ color: MUT }}>{activeSection || "Pulse"}</span>
            <span style={{ color: "#cfd6e4" }}>/</span>
            <span style={{ color: INK }}>{activeItem || "Overview"}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ boxShadow: "0 0 6px rgba(16,185,129,0.6)" }} />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: EMERALD }}>Uptime 99.98%</span>
            </div>
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
