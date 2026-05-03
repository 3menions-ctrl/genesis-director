import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import {
  Users, Palette, CreditCard, BarChart3, Building2, Lock,
  LayoutDashboard, Layers, ArrowLeft, Command, Check,
  ChevronsUpDown, PanelLeftClose, PanelLeftOpen, Coins, Plus,
  Film, UserSquare2, LayoutTemplate, CheckCircle2, ShieldCheck,
  ScrollText, FileSpreadsheet, Plug, KeyRound, Bell, Settings,
  Shield, AlertOctagon, Sparkles, Menu, X,
} from 'lucide-react';
import { useWorkspace, type OrgRole } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CinemaBackdrop } from '@/components/ui/CinemaBackdrop';
import logoImage from '@/assets/apex-studio-logo.png';

interface NavItem {
  to: string;
  label: string;
  Icon: typeof Users;
  minRole: OrgRole;
  description: string;
}

interface NavGroup { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operate',
    items: [
      { to: '/workspace',        label: 'Overview', Icon: LayoutDashboard, minRole: 'viewer',   description: 'Operational snapshot' },
      { to: '/workspace/projects',  label: 'Projects',  Icon: Film,           minRole: 'viewer',   description: 'All productions' },
      { to: '/workspace/assets', label: 'Assets',   Icon: Layers,          minRole: 'viewer',   description: 'Shared library' },
      { to: '/workspace/avatars',   label: 'Avatars',   Icon: UserSquare2,    minRole: 'viewer',   description: 'Brand cast' },
      { to: '/workspace/templates', label: 'Templates', Icon: LayoutTemplate, minRole: 'producer', description: 'Reusable layouts' },
    ],
  },
  {
    label: 'Govern',
    items: [
      { to: '/workspace/team',  label: 'Team',  Icon: Users,   minRole: 'viewer',   description: 'Roster & access' },
      { to: '/workspace/brand', label: 'Brand', Icon: Palette, minRole: 'producer', description: 'Identity & voice' },
      { to: '/workspace/approvals',   label: 'Approvals',   Icon: CheckCircle2, minRole: 'reviewer', description: 'Sign-off queue' },
      { to: '/workspace/permissions', label: 'Permissions', Icon: ShieldCheck,  minRole: 'admin',    description: 'Role matrix' },
      { to: '/workspace/audit',       label: 'Audit log',   Icon: ScrollText,   minRole: 'admin',    description: 'Activity trail' },
    ],
  },
  {
    label: 'Optimize',
    items: [
      { to: '/workspace/billing',   label: 'Billing',   Icon: CreditCard, minRole: 'admin', description: 'Plan & invoices' },
      { to: '/workspace/credits',   label: 'Credits',   Icon: Coins,           minRole: 'admin', description: 'Pool & top-ups' },
      { to: '/workspace/analytics', label: 'Telemetry', Icon: BarChart3,  minRole: 'admin', description: 'Usage by member' },
      { to: '/workspace/reports',   label: 'Reports',   Icon: FileSpreadsheet, minRole: 'admin', description: 'Export summaries' },
    ],
  },
  {
    label: 'Extend',
    items: [
      { to: '/workspace/integrations',  label: 'Integrations',  Icon: Plug,    minRole: 'admin', description: 'Slack, Drive, Zapier' },
      { to: '/workspace/api',           label: 'API & hooks',   Icon: KeyRound, minRole: 'admin', description: 'Programmatic access' },
      { to: '/workspace/notifications', label: 'Notifications', Icon: Bell,    minRole: 'admin', description: 'Routing rules' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/workspace/general',  label: 'General',  Icon: Settings,     minRole: 'admin', description: 'Workspace profile' },
      { to: '/workspace/security', label: 'Security', Icon: Shield,       minRole: 'admin', description: 'SSO & policies' },
      { to: '/workspace/danger',   label: 'Danger',   Icon: AlertOctagon, minRole: 'owner', description: 'Destructive actions' },
    ],
  },
];

const COLLAPSE_KEY = 'apex.workspaceRailCollapsed';
const ACCENT_HUE = 215; // canonical blue accent — matches AppShell
// Locked to canonical regular-user shell spec: 236 / 72 px
const RAIL_EXPANDED = 'lg:w-[236px]';
const RAIL_COLLAPSED = 'lg:w-[72px]';

/**
 * Workspace shell — Premium Operations console.
 * Mirrors the AppShell visual language (rounded glass rail, blue glow,
 * cinematic backdrop, font-display serif) while keeping the workspace
 * navigation structure (Operate / Govern / Optimize / Extend / Settings).
 * Used as the SOLE shell for every /workspace/* route — do NOT wrap
 * workspace pages in <AppShell> as well.
 */
export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { currentOrg, hasPermission, loading, organizations, switchOrg } = useWorkspace();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center text-white/70">
        <CinemaBackdrop />
        <div className="relative font-mono text-[11px] uppercase tracking-[0.32em] animate-pulse text-white/55">
          Initializing workspace…
        </div>
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-6">
        <CinemaBackdrop />
        <div className="relative max-w-md text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-white/[0.07] to-white/[0.015] border border-white/[0.08] flex items-center justify-center shadow-[0_2px_16px_rgba(0,0,0,0.4),inset_0_1px_0_hsla(0,0%,100%,0.06)]">
            <Building2 className="w-6 h-6 text-[hsl(215,100%,68%)]" />
          </div>
          <h2 className="text-xl font-display font-light text-white/90 tracking-[-0.01em]">
            No workspace selected
          </h2>
          <p className="text-[13px] text-white/45 mt-2 font-light">
            Switch to a workspace from the sidebar to manage it.
          </p>
        </div>
      </div>
    );
  }

  const railWidth = collapsed ? RAIL_COLLAPSED : RAIL_EXPANDED;
  const orgInitials = currentOrg.name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const tint = (a: number) => `hsla(${ACCENT_HUE}, 90%, 62%, ${a})`;

  return (
    <TooltipProvider delayDuration={150}>
    <div data-workspace-shell className="relative flex min-h-screen w-full bg-transparent text-foreground">
      {/* Cinematic backdrop — identical to AppShell */}
      <CinemaBackdrop />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Premium glass rail ───────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col w-[260px]',
          '-translate-x-full transition-transform duration-300 ease-out',
          mobileOpen && 'translate-x-0',
          'md:static md:translate-x-0 md:shrink-0 md:sticky md:top-0',
          'md:h-screen md:p-0 md:border-r md:border-white/[0.06]',
          'lg:transition-[width] lg:duration-300 lg:ease-out',
          railWidth,
        )}
        style={{
          background:
            'linear-gradient(180deg, hsla(220, 18%, 4%, 0.92) 0%, hsla(220, 16%, 3%, 0.96) 100%)',
          backdropFilter: 'blur(40px) saturate(160%)',
          WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        }}
      >
        <div className="relative flex flex-1 flex-col min-h-0">
        {/* Top edge highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, hsla(0,0%,100%,0.08) 50%, transparent 100%)',
          }}
        />
        {/* Accent halo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full opacity-50"
          style={{
            background:
              `radial-gradient(closest-side, ${tint(0.18)}, transparent 70%)`,
            filter: 'blur(24px)',
          }}
        />

        {/* Brand */}
        <div className={cn('relative flex h-[60px] shrink-0 items-center gap-3 px-4', collapsed && 'lg:justify-center lg:px-0')}>
          <Link to="/projects" className="group flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-[hsl(215,100%,55%/0.35)] to-[hsl(215,100%,40%/0.15)] opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500" />
              <div className="relative w-9 h-9 rounded-2xl bg-gradient-to-br from-white/[0.07] to-white/[0.015] flex items-center justify-center overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.4),inset_0_1px_0_hsla(0,0%,100%,0.06)]">
                <img src={logoImage} alt="Apex-Studio" className="w-[22px] h-[22px] object-contain opacity-90 group-hover:scale-105 transition-transform duration-300" />
              </div>
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 lg:flex">
                <span className="text-[15px] font-semibold text-white/95 tracking-[-0.03em] leading-none font-display truncate">
                  Apex<span className="text-white/85 mx-[1px]">-</span>Studio
                </span>
                <span className="text-[9px] font-light uppercase tracking-[0.22em] text-white/30 mt-[4px]">
                  Workspace
                </span>
              </div>
            )}
          </Link>
          <button
            className="ml-auto md:hidden w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.06] text-white/45 hover:text-white/80 transition-colors duration-200"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Org switcher — premium pill */}
        <div className={cn('px-3 pb-3', collapsed && 'lg:px-2')}>
          <Popover open={orgSwitcherOpen} onOpenChange={setOrgSwitcherOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'group w-full flex items-center gap-2.5 px-3 h-12 rounded-2xl text-left transition-all duration-300',
                  'border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] hover:from-white/[0.07] hover:to-white/[0.02] hover:border-white/[0.10]',
                  'shadow-[inset_0_1px_0_hsla(0,0%,100%,0.05)]',
                  collapsed && 'justify-center px-0',
                )}
                title={currentOrg.name}
              >
                <div
                  className="w-7 h-7 shrink-0 rounded-xl text-white font-mono text-[10px] font-bold uppercase flex items-center justify-center"
                  style={{
                    background:
                      'linear-gradient(135deg, hsl(215,100%,62%), hsl(215,100%,46%))',
                    boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.18), 0 6px 18px -8px hsla(215,100%,55%,0.65)',
                  }}
                >
                  {orgInitials || 'OP'}
                </div>
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[13px] leading-tight text-white/95 truncate">
                        {currentOrg.name}
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 mt-0.5">
                        {currentOrg.plan.replace('_', ' ')} · {currentOrg.role}
                      </div>
                    </div>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-white/40 shrink-0 group-hover:text-white/70 transition-colors" strokeWidth={1.5} />
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="right"
              sideOffset={8}
              className="w-[280px] p-0 bg-[hsl(220,16%,5%)]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
            >
              <div className="px-3 py-2.5 border-b border-white/[0.06] font-mono text-[9px] uppercase tracking-[0.32em] text-white/40">
                Workspaces
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {organizations.map((o) => {
                  const isCurrent = o.id === currentOrg.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => { switchOrg(o.id); setOrgSwitcherOpen(false); }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors',
                        isCurrent && 'bg-[hsl(215,60%,12%)]/40',
                      )}
                    >
                      <div className="w-6 h-6 shrink-0 rounded-lg bg-white/[0.06] text-white/85 font-mono text-[9px] font-bold flex items-center justify-center">
                        {o.name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'OP'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-white/90 truncate">{o.name}</div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 mt-0.5">
                          {o.plan.replace('_', ' ')} · {o.role}
                        </div>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-[hsl(215,100%,72%)] shrink-0" strokeWidth={2} />}
                    </button>
                  );
                })}
              </div>
              <NavLink
                to="/workspace/billing"
                onClick={() => setOrgSwitcherOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 border-t border-white/[0.06] hover:bg-white/[0.04] transition-colors font-mono text-[10px] uppercase tracking-[0.18em] text-white/55 hover:text-white/85"
              >
                <Plus className="w-3 h-3" strokeWidth={1.5} /> Workspace settings
              </NavLink>
            </PopoverContent>
          </Popover>
        </div>

        {/* Nav groups — premium glow */}
        <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-hide">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={group.label} className={cn(gIdx > 0 && 'mt-5')}>
              {!collapsed && (
                <div className="px-2 pb-2 text-[9.5px] font-light uppercase tracking-[0.28em] text-white/25">
                  {group.label}
                </div>
              )}
              {collapsed && gIdx > 0 && (
                <div className="mx-3 my-3 h-px bg-white/[0.06]" />
              )}
              <ul className="space-y-1">
                {group.items.map(({ to, label, Icon, minRole, description }) => {
                  const allowed = hasPermission(minRole);
                  const active = to === '/workspace' ? pathname === '/workspace' : pathname.startsWith(to);
                  const link = (
                    <NavLink
                      to={allowed ? to : pathname}
                      aria-disabled={!allowed}
                      onClick={(e) => { if (!allowed) e.preventDefault(); }}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-2xl px-3 h-[40px] text-[13px] font-light tracking-[-0.005em] transition-all duration-300',
                        active
                          ? 'text-white shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]'
                          : 'text-white/55 hover:text-white',
                        collapsed && 'lg:justify-center lg:px-0 lg:gap-0',
                        !allowed && 'opacity-35 cursor-not-allowed hover:text-white/55',
                      )}
                      style={
                        active
                          ? {
                              background: `linear-gradient(90deg, ${tint(0.16)} 0%, ${tint(0.05)} 55%, transparent 100%)`,
                              boxShadow: `inset 0 1px 0 hsla(0,0%,100%,0.07), 0 12px 28px -16px ${tint(0.5)}`,
                            }
                          : undefined
                      }
                    >
                      {!active && allowed && (
                        <span
                          aria-hidden
                          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                          style={{
                            background: `linear-gradient(90deg, ${tint(0.09)} 0%, ${tint(0.025)} 60%, transparent 100%)`,
                          }}
                        />
                      )}
                      {active && (
                        <span
                          aria-hidden
                          className="absolute -left-3 top-1/2 -translate-y-1/2 h-7 w-[2px] rounded-r-full"
                          style={{
                            background: `linear-gradient(180deg, hsl(${ACCENT_HUE}, 100%, 72%) 0%, hsl(${ACCENT_HUE}, 95%, 55%) 100%)`,
                            boxShadow: `0 0 16px ${tint(0.85)}, 0 0 32px ${tint(0.4)}`,
                          }}
                        />
                      )}
                      {allowed ? (
                        <Icon
                          className={cn(
                            'relative w-[18px] h-[18px] shrink-0 transition-all duration-300',
                            active ? '' : 'group-hover:scale-[1.1] group-hover:translate-x-[1px]',
                          )}
                          strokeWidth={1.5}
                          style={{
                            color: active ? `hsl(${ACCENT_HUE}, 100%, 72%)` : tint(0.5),
                            filter: active ? `drop-shadow(0 0 8px ${tint(0.7)})` : undefined,
                          }}
                        />
                      ) : (
                        <Lock className="relative w-[16px] h-[16px] shrink-0 text-white/30" strokeWidth={1.5} />
                      )}
                      {!collapsed && (
                        <span className="relative truncate transition-transform duration-300 group-hover:translate-x-[2px]">
                          {label}
                        </span>
                      )}
                      {active && !collapsed && (
                        <span
                          aria-hidden
                          className="relative ml-auto h-1.5 w-1.5 rounded-full"
                          style={{
                            background: `hsl(${ACCENT_HUE}, 100%, 72%)`,
                            boxShadow: `0 0 10px ${tint(0.9)}, 0 0 20px ${tint(0.4)}`,
                          }}
                        />
                      )}
                    </NavLink>
                  );
                  return (
                    <li key={to}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right" sideOffset={8} className="bg-card/95 border-white/10 text-[12px] font-medium">
                            {label} — {description}
                          </TooltipContent>
                        </Tooltip>
                      ) : link}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer: studio + collapse */}
        <div className="px-3 pb-3 pt-2 space-y-2">
          <div className="flex items-center gap-1">
            <NavLink
              to="/projects"
              title="Back to Studio"
              className={cn(
                'flex items-center justify-center gap-2 h-9 rounded-full border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] transition-colors font-light text-[11px] tracking-[-0.005em] text-white/60 hover:text-white/95',
                collapsed ? 'justify-center flex-1' : 'flex-1',
              )}
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              {!collapsed && 'Studio'}
            </NavLink>
            <button
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:flex w-9 h-9 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] text-white/55 hover:text-white/95 transition-colors"
            >
              {collapsed
                ? <PanelLeftOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
                : <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.5} />}
            </button>
          </div>
          {/* No per-tier chrome — canonical shell is identical across tiers. */}
        </div>
        </div>
      </aside>

      {/* ── Main column ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Lightweight mobile-only menu trigger; no chrome strip on desktop —
            the personal AppShell has none and the canonical rule is parity. */}
        <div className="md:hidden sticky top-0 z-20 h-12 flex items-center px-4 border-b border-white/[0.04] backdrop-blur-xl"
             style={{ background: 'linear-gradient(180deg, hsla(220,16%,4%,0.78), hsla(220,16%,4%,0.55))' }}>
          <button
            onClick={() => setMobileOpen(true)}
            className="w-8 h-8 -ml-1 flex items-center justify-center rounded-full hover:bg-white/[0.06] text-white/60 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Page content */}
        <div className="flex-1 px-6 lg:px-10 py-8 min-w-0">
          {children}
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
