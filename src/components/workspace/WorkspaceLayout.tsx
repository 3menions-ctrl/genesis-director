import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Users, Palette, CreditCard, BarChart3, Building2, Lock,
  LayoutDashboard, Layers, ArrowLeft, Command,
} from 'lucide-react';
import { useWorkspace, type OrgRole } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  Icon: typeof Users;
  minRole: OrgRole;
  description: string;
}

const NAV: NavItem[] = [
  { to: '/workspace',           label: 'Overview',  Icon: LayoutDashboard, minRole: 'viewer',   description: 'Operational snapshot' },
  { to: '/workspace/team',      label: 'Team',      Icon: Users,           minRole: 'viewer',   description: 'Roster, invites, access' },
  { to: '/workspace/brand',     label: 'Brand',     Icon: Palette,         minRole: 'producer', description: 'Identity & voice' },
  { to: '/workspace/assets',    label: 'Assets',    Icon: Layers,          minRole: 'viewer',   description: 'Shared library' },
  { to: '/workspace/billing',   label: 'Billing',   Icon: CreditCard,      minRole: 'admin',    description: 'Plan, seats, invoices' },
  { to: '/workspace/analytics', label: 'Telemetry', Icon: BarChart3,       minRole: 'admin',    description: 'Usage by member' },
];

/**
 * Workspace shell — Operations Command Center.
 * Intentionally distinct from the personal Pro-Dark canonical shell:
 *   • warm graphite ground (hsl 35,10%,4%) instead of cool blue-black
 *   • amber/copper accent (hsl 28,90%,60%) instead of #0A84FF blue
 *   • square edges, dense data layout, mono labels, no glow rails
 *   • editorial "ops console" voice (modules, telemetry, ORG ID)
 */
export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { currentOrg, hasPermission, loading } = useWorkspace();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(35,10%,4%)] text-[hsl(35,12%,72%)]">
        <div className="font-mono text-[11px] uppercase tracking-[0.32em] animate-pulse">
          Initializing workspace…
        </div>
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[hsl(35,10%,4%)]">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-sm bg-[hsl(35,12%,8%)] border border-[hsl(35,12%,16%)] flex items-center justify-center">
            <Building2 className="w-6 h-6 text-[hsl(28,80%,60%)]" />
          </div>
          <h2 className="text-xl font-display font-light text-[hsl(35,12%,92%)]">
            No workspace selected
          </h2>
          <p className="text-[13px] text-[hsl(35,8%,55%)] mt-2 font-mono">
            Switch to a workspace from the sidebar to manage it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(35,10%,4%)] text-[hsl(35,12%,92%)]">
      {/* ── Top utility bar ─────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-[hsl(35,12%,12%)] bg-[hsl(35,10%,4%)]/95 backdrop-blur-xl">
        <div className="max-w-[1320px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <NavLink
              to="/projects"
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-[hsl(35,8%,55%)] hover:text-[hsl(35,12%,92%)] transition-colors font-mono"
            >
              <ArrowLeft className="w-3 h-3" /> Studio
            </NavLink>
            <div className="h-4 w-px bg-[hsl(35,12%,16%)]" />
            <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[hsl(28,90%,62%)]">
              <Command className="w-3 h-3" />
              Workspace · OPS
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 border border-[hsl(35,12%,16%)] bg-[hsl(35,12%,7%)] font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(35,12%,72%)]">
              <span className="w-1.5 h-1.5 bg-[hsl(28,90%,60%)]" />
              {currentOrg.plan.replace('_', ' ')}
            </div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 border border-[hsl(35,12%,16%)] bg-[hsl(35,12%,7%)] font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(35,12%,72%)]">
              ROLE · {currentOrg.role}
            </div>
          </div>
        </div>
      </div>

      {/* ── Masthead ───────────────────────────────────────────── */}
      <div className="border-b border-[hsl(35,12%,12%)]">
        <div className="max-w-[1320px] mx-auto px-6 lg:px-10 py-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] items-end gap-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-[hsl(35,8%,45%)] mb-3">
              ORG · {currentOrg.id.slice(0, 8).toUpperCase()}
            </div>
            <h1 className="font-display text-[36px] sm:text-[48px] leading-[1.02] font-light tracking-tight">
              {currentOrg.name}
              <span className="text-[hsl(28,90%,60%)]">.</span>
            </h1>
            <p className="text-[13px] text-[hsl(35,8%,55%)] mt-3 font-light max-w-xl">
              Operations console for {currentOrg.name}. Provision seats, govern brand, audit spend.
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(35,8%,55%)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(140,70%,50%)] animate-pulse" />
            All systems nominal
          </div>
        </div>
      </div>

      {/* ── Body: command rail + content ───────────────────────── */}
      <div className="max-w-[1320px] mx-auto px-6 lg:px-10 py-8 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-10">
        <nav className="lg:sticky lg:top-20 self-start">
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-[hsl(35,8%,40%)] mb-3 px-3">
            Modules
          </div>
          <div className="border border-[hsl(35,12%,12%)] bg-[hsl(35,12%,5%)]">
            {NAV.map(({ to, label, Icon, minRole, description }, idx) => {
              const allowed = hasPermission(minRole);
              const active = to === '/workspace' ? pathname === '/workspace' : pathname.startsWith(to);
              return (
                <NavLink
                  key={to}
                  to={allowed ? to : pathname}
                  aria-disabled={!allowed}
                  onClick={(e) => { if (!allowed) e.preventDefault(); }}
                  className={cn(
                    'group relative flex items-start gap-3 px-4 py-3.5 transition-colors border-l-2',
                    idx > 0 && 'border-t border-t-[hsl(35,12%,12%)]',
                    active
                      ? 'border-l-[hsl(28,90%,60%)] bg-[hsl(28,40%,8%)]'
                      : 'border-l-transparent hover:bg-[hsl(35,12%,7%)]',
                    !allowed && 'opacity-40 cursor-not-allowed hover:bg-transparent',
                  )}
                >
                  <div className={cn(
                    'w-6 h-6 flex items-center justify-center mt-0.5',
                    active ? 'text-[hsl(28,90%,62%)]' : 'text-[hsl(35,8%,55%)]',
                  )}>
                    {allowed
                      ? <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                      : <Lock className="w-3 h-3" strokeWidth={1.5} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn(
                      'font-mono text-[11px] uppercase tracking-[0.20em]',
                      active ? 'text-[hsl(35,12%,98%)]' : 'text-[hsl(35,12%,82%)]',
                    )}>
                      {label}
                    </div>
                    <div className="text-[11px] text-[hsl(35,8%,45%)] leading-snug mt-0.5 truncate">
                      {description}
                    </div>
                  </div>
                  {active && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-[hsl(28,90%,62%)]">
                      ●
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
          <div className="mt-4 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(35,8%,40%)]">
            v2.4 · BUSINESS TIER
          </div>
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
