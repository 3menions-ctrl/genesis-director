import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Users, Palette, CreditCard, BarChart3, Building2, ShieldCheck, Lock, LayoutDashboard, Layers } from 'lucide-react';
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
  { to: '/workspace',           label: 'Overview',  Icon: LayoutDashboard, minRole: 'viewer',  description: 'Workspace at a glance' },
  { to: '/workspace/team',      label: 'Team',      Icon: Users,       minRole: 'viewer',  description: 'Members, invites, roles' },
  { to: '/workspace/brand',     label: 'Brand kit', Icon: Palette,     minRole: 'producer',description: 'Colors, voice, logo' },
  { to: '/workspace/assets',    label: 'Assets',    Icon: Layers,      minRole: 'viewer',  description: 'Logos, fonts, references' },
  { to: '/workspace/billing',   label: 'Billing',   Icon: CreditCard,  minRole: 'admin',   description: 'Invoices, VAT, payment' },
  { to: '/workspace/analytics', label: 'Analytics', Icon: BarChart3,   minRole: 'admin',   description: 'Usage by member' },
];

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { currentOrg, hasPermission, loading } = useWorkspace();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/55">
        <div className="animate-pulse">Loading workspace…</div>
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white/45" />
          </div>
          <h2 className="text-xl font-display font-light text-white/85">No workspace selected</h2>
          <p className="text-[13px] text-white/45 mt-2">Switch to a workspace from the sidebar to manage it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,14%,2%)] text-white">
      {/* Header band */}
      <div className="border-b border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8">
          <div className="text-[10px] uppercase tracking-[0.32em] text-[#9DCBFF] font-medium mb-3 inline-flex items-center gap-2">
            <ShieldCheck className="w-3 h-3" />
            Workspace admin
          </div>
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <h1 className="font-display text-[32px] sm:text-[40px] leading-[1.05] font-light tracking-tight">
                {currentOrg.name}
              </h1>
              <p className="text-[13px] text-white/45 mt-2 font-light max-w-lg">
                Manage everything for this organization — your team, brand, billing and usage.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-white/65">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0A84FF]" />
              {currentOrg.plan} · {currentOrg.role}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-8">
        {/* Sidebar */}
        <nav className="space-y-1 lg:sticky lg:top-6 self-start">
          {NAV.map(({ to, label, Icon, minRole, description }) => {
            const allowed = hasPermission(minRole);
            const active = pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={allowed ? to : pathname}
                aria-disabled={!allowed}
                onClick={(e) => { if (!allowed) e.preventDefault(); }}
                className={cn(
                  'group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all border',
                  active
                    ? 'border-[#0A84FF]/40 bg-[#0A84FF]/[0.07] shadow-[0_0_24px_-12px_hsla(212,100%,55%,0.6)]'
                    : 'border-transparent hover:bg-white/[0.04]',
                  !allowed && 'opacity-40 cursor-not-allowed',
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 border',
                  active ? 'border-[#0A84FF]/40 bg-[#0A84FF]/[0.10]' : 'border-white/[0.06] bg-white/[0.02]',
                )}>
                  {allowed ? (
                    <Icon className={cn('w-3.5 h-3.5', active ? 'text-[#9DCBFF]' : 'text-white/65')} strokeWidth={1.6} />
                  ) : (
                    <Lock className="w-3 h-3 text-white/35" strokeWidth={1.6} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className={cn('text-[13px] font-medium', active ? 'text-white' : 'text-white/85')}>{label}</div>
                  <div className="text-[11px] text-white/40 leading-snug truncate">{description}</div>
                </div>
              </NavLink>
            );
          })}
        </nav>

        {/* Content */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}