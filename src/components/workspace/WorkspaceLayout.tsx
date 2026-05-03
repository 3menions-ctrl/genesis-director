import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Users, Palette, CreditCard, BarChart3, Building2, Lock,
  LayoutDashboard, Layers, ArrowLeft, Command, Check,
  ChevronsUpDown, PanelLeftClose, PanelLeftOpen, Coins, Plus,
  Film, UserSquare2, LayoutTemplate, CheckCircle2, ShieldCheck,
  ScrollText, FileSpreadsheet, Plug, KeyRound, Bell, Settings,
  Shield, AlertOctagon,
} from 'lucide-react';
import { useWorkspace, type OrgRole } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

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

/**
 * Workspace shell — Operations Command Center.
 * Pro-Dark canonical palette (hsl 220,14%,*) + single blue accent
 * (hsl 215,100%,60%, matches AppShell). Square edges, dense data
 * layout, mono labels, editorial "ops console" voice.
 * Used as the SOLE shell for every /workspace/* route — do NOT
 * wrap workspace pages in <AppShell> as well.
 */
export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { currentOrg, hasPermission, loading, organizations, switchOrg } = useWorkspace();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,14%,4%)] text-[hsl(220,14%,72%)]">
        <div className="font-mono text-[11px] uppercase tracking-[0.32em] animate-pulse">
          Initializing workspace…
        </div>
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[hsl(220,14%,4%)]">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-sm bg-[hsl(220,14%,8%)] border border-[hsl(220,14%,16%)] flex items-center justify-center">
            <Building2 className="w-6 h-6 text-[hsl(215,90%,60%)]" />
          </div>
          <h2 className="text-xl font-display font-light text-[hsl(220,14%,92%)]">
            No workspace selected
          </h2>
          <p className="text-[13px] text-[hsl(220,8%,55%)] mt-2 font-mono">
            Switch to a workspace from the sidebar to manage it.
          </p>
        </div>
      </div>
    );
  }

  const railWidth = collapsed ? 'w-[72px]' : 'w-[256px]';
  const orgInitials = currentOrg.name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const credits = currentOrg.credits_balance ?? 0;

  return (
    <div className="min-h-screen flex bg-[hsl(220,14%,4%)] text-[hsl(220,14%,92%)]">
      {/* ── Persistent left rail ───────────────────────────────── */}
      <aside
        className={cn(
          'sticky top-0 h-screen shrink-0 border-r border-[hsl(220,14%,12%)] bg-[hsl(220,14%,3%)] flex flex-col z-30 transition-[width] duration-200',
          railWidth,
        )}
      >
        {/* Org switcher */}
        <div className="border-b border-[hsl(220,14%,12%)] p-3">
          <Popover open={orgSwitcherOpen} onOpenChange={setOrgSwitcherOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'w-full flex items-center gap-2.5 px-2 py-2 border border-[hsl(220,14%,14%)] bg-[hsl(220,14%,6%)] hover:border-[hsl(215,80%,30%)] hover:bg-[hsl(220,14%,8%)] transition-colors text-left',
                  collapsed && 'justify-center px-0',
                )}
                title={currentOrg.name}
              >
                <div className="w-7 h-7 shrink-0 bg-[hsl(215,100%,60%)] text-[hsl(220,14%,4%)] font-mono text-[10px] font-bold uppercase flex items-center justify-center">
                  {orgInitials || 'OP'}
                </div>
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[13px] leading-tight text-[hsl(220,14%,96%)] truncate">
                        {currentOrg.name}
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(220,8%,50%)] mt-0.5">
                        {currentOrg.plan.replace('_', ' ')} · {currentOrg.role}
                      </div>
                    </div>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-[hsl(220,8%,50%)] shrink-0" strokeWidth={1.5} />
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="right"
              sideOffset={8}
              className="w-[280px] p-0 bg-[hsl(220,14%,5%)] border border-[hsl(220,14%,16%)] rounded-none"
            >
              <div className="px-3 py-2 border-b border-[hsl(220,14%,12%)] font-mono text-[9px] uppercase tracking-[0.32em] text-[hsl(220,8%,50%)]">
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
                        'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[hsl(220,14%,8%)] transition-colors',
                        isCurrent && 'bg-[hsl(215,40%,8%)]',
                      )}
                    >
                      <div className="w-6 h-6 shrink-0 bg-[hsl(220,14%,12%)] text-[hsl(220,14%,82%)] font-mono text-[9px] font-bold flex items-center justify-center">
                        {o.name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'OP'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-[hsl(220,14%,92%)] truncate">{o.name}</div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(220,8%,50%)] mt-0.5">
                          {o.plan.replace('_', ' ')} · {o.role}
                        </div>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-[hsl(215,100%,62%)] shrink-0" strokeWidth={2} />}
                    </button>
                  );
                })}
              </div>
              <NavLink
                to="/workspace/billing"
                onClick={() => setOrgSwitcherOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 border-t border-[hsl(220,14%,12%)] hover:bg-[hsl(220,14%,8%)] transition-colors font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(220,8%,55%)]"
              >
                <Plus className="w-3 h-3" strokeWidth={1.5} /> Manage workspaces
              </NavLink>
            </PopoverContent>
          </Popover>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={group.label} className={cn(gIdx > 0 && 'mt-4')}>
              {!collapsed && (
                <div className="px-5 pb-1.5 font-mono text-[9px] uppercase tracking-[0.32em] text-[hsl(220,8%,38%)]">
                  {group.label}
                </div>
              )}
              {collapsed && gIdx > 0 && (
                <div className="mx-3 my-2 h-px bg-[hsl(220,14%,12%)]" />
              )}
              <div>
                {group.items.map(({ to, label, Icon, minRole, description }) => {
                  const allowed = hasPermission(minRole);
                  const active = to === '/workspace' ? pathname === '/workspace' : pathname.startsWith(to);
                  return (
                    <NavLink
                      key={to}
                      to={allowed ? to : pathname}
                      aria-disabled={!allowed}
                      onClick={(e) => { if (!allowed) e.preventDefault(); }}
                      title={collapsed ? `${label} — ${description}` : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 px-3 mx-2 my-0.5 py-2 transition-colors border-l-2',
                        collapsed && 'justify-center px-0 mx-3',
                        active
                          ? 'border-l-[hsl(215,100%,60%)] bg-[hsl(215,40%,9%)] text-[hsl(220,14%,98%)]'
                          : 'border-l-transparent text-[hsl(220,14%,75%)] hover:bg-[hsl(220,14%,7%)] hover:text-[hsl(220,14%,95%)]',
                        !allowed && 'opacity-35 cursor-not-allowed hover:bg-transparent',
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 flex items-center justify-center shrink-0',
                        active ? 'text-[hsl(215,100%,62%)]' : 'text-[hsl(220,8%,55%)] group-hover:text-[hsl(220,14%,90%)]',
                      )}>
                        {allowed
                          ? <Icon className="w-4 h-4" strokeWidth={1.5} />
                          : <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      </div>
                      {!collapsed && (
                        <div className="min-w-0 flex-1">
                          <div className={cn(
                            'font-mono text-[11px] uppercase tracking-[0.18em]',
                            active ? 'text-[hsl(220,14%,98%)]' : '',
                          )}>
                            {label}
                          </div>
                        </div>
                      )}
                      {!collapsed && active && (
                        <span className="w-1 h-1 rounded-full bg-[hsl(215,100%,62%)] shrink-0" />
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer: credits + studio + collapse */}
        <div className="border-t border-[hsl(220,14%,12%)] p-3 space-y-2">
          <div className="flex items-center gap-1">
            <NavLink
              to="/projects"
              title="Back to Studio"
              className={cn(
                'flex items-center gap-2 px-2.5 py-2 border border-[hsl(220,14%,14%)] bg-[hsl(220,14%,6%)] hover:bg-[hsl(220,14%,9%)] transition-colors font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(220,8%,60%)] hover:text-[hsl(220,14%,92%)]',
                collapsed ? 'justify-center flex-1' : 'flex-1',
              )}
            >
              <ArrowLeft className="w-3 h-3" strokeWidth={1.5} />
              {!collapsed && 'Studio'}
            </NavLink>
            <button
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="w-9 h-9 flex items-center justify-center border border-[hsl(220,14%,14%)] bg-[hsl(220,14%,6%)] hover:bg-[hsl(220,14%,9%)] text-[hsl(220,8%,60%)] hover:text-[hsl(220,14%,92%)] transition-colors"
            >
              {collapsed
                ? <PanelLeftOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
                : <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.5} />}
            </button>
          </div>
          {!collapsed && (
            <div className="font-mono text-[9px] uppercase tracking-[0.20em] text-[hsl(220,8%,32%)] pt-1 px-1">
              v2.4 · BUSINESS TIER
            </div>
          )}
        </div>
      </aside>

      {/* ── Main column ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top utility strip */}
        <div className="sticky top-0 z-20 border-b border-[hsl(220,14%,12%)] bg-[hsl(220,14%,4%)]/95 backdrop-blur-xl h-12 flex items-center justify-between px-6 lg:px-10">
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[hsl(215,100%,62%)]">
            <Command className="w-3 h-3" strokeWidth={1.5} />
            Workspace · OPS
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(220,8%,55%)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(140,70%,50%)] animate-pulse" />
            All systems nominal
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 px-6 lg:px-10 py-8 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
