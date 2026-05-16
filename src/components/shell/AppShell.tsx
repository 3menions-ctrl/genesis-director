import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useLocation, Link, Navigate } from 'react-router-dom';
import {
  Film, Sparkles, Scissors, Layers, GraduationCap,
  User as UserIcon, Settings as SettingsIcon, HelpCircle, Shield, LogOut,
  Zap, ChevronDown, Menu, X, PanelLeftClose, PanelLeft, ArrowRight, Code2,
  Users as UsersIcon, Smile,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SignOutDialog } from '@/components/auth/SignOutDialog';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { NotificationBell } from '@/components/social/NotificationBell';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useNavigationWithLoading } from '@/components/navigation';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import logoImage from '@/assets/apex-studio-logo.webp';
import { CinemaBackdrop } from '@/components/ui/CinemaBackdrop';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';

interface NavItem {
  label: string;
  to: string;
  icon: typeof Film;
  match?: (pathname: string) => boolean;
  /** HSL hue (0-360) used for icon tint + active accent gradient. */
  hue: number;
}

/**
 * Condensed, grouped primary navigation.
 * Three editorial sections — Create, Library, Cast — keep the rail
 * focused on the pages users actually need. Secondary destinations
 * (avatars-gallery, developers) remain reachable from their parent
 * pages but no longer clutter the sidebar.
 */
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Create',
    items: [
      { label: 'Create', to: '/create', icon: Sparkles,  hue: 215 },
      { label: 'Editor', to: '/editor', icon: Scissors,  hue: 215 },
    ],
  },
  {
    label: 'Library',
    items: [
      { label: 'Projects',  to: '/projects',  icon: Film,   hue: 215, match: (p) => p === '/projects' || p.startsWith('/projects') },
      { label: 'Templates', to: '/templates', icon: Layers, hue: 215 },
    ],
  },
  {
    label: 'Cast',
    items: [
      { label: 'Avatars',  to: '/avatars',        icon: UserIcon,      hue: 215 },
      { label: 'Mascots',  to: '/mascots',        icon: Smile,         hue: 215 },
      { label: 'Training', to: '/training-video', icon: GraduationCap, hue: 215 },
    ],
  },
];

interface AppShellProps {
  children: ReactNode;
}

const SIDEBAR_KEY = 'apex.sidebar.collapsed';

export function AppShell({ children }: AppShellProps) {
  const { profile, isAdmin } = useAuth();
  const { navigateTo } = useNavigationWithLoading();
  const { startNavigation, isHeavyRoute } = useNavigationLoading();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    // Default to expanded so every nav item shows its icon + label.
    // Users can still collapse via the toggle; stored preference is honoured
    // only after they explicitly choose the icon rail again.
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      return stored === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);

  // Sidebar stays expanded across routes so icon + label are always visible.
  // (Previously auto-collapsed on /create — removed per UX request.)

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const isZeroCredits = (profile?.credits_balance ?? 0) === 0;
  const credits = profile?.credits_balance?.toLocaleString() || '0';
  const isBusiness = profile?.account_type === 'business' || profile?.account_type === 'enterprise';

  // Cole's admin role is a fully cohesive admin-only experience. Admin access
  // is role-based, not profile-account-type based, so the Studio shell never
  // renders for the admin account.
  if (isAdmin && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin" replace />;
  }

  const isItemActive = (item: NavItem) => {
    if (item.match) return item.match(location.pathname);
    return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
  };

  // Wire NavLink clicks into the global loading overlay so heavy routes
  // (Editor, Avatars, Templates, etc.) feel instantly responsive instead
  // of staring at a blank screen during chunk load.
  const handleNavClick = (to: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Respect modifier clicks / new-tab opens
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (location.pathname === to) {
      e.preventDefault();
      return;
    }
    if (isHeavyRoute(to)) {
      startNavigation(to);
    }
    setMobileOpen(false);
  };

  // Stationary anchored rail — no surrounding gutter. Solid, edge-to-edge.
  const railWidth = collapsed ? 'lg:w-[72px]' : 'lg:w-[236px]';

  return (
    <TooltipProvider delayDuration={150}>
      <div data-app-shell className="relative flex min-h-screen w-full bg-transparent text-foreground">
        {/* Cinematic backdrop — identical to global loading screen */}
        <CinemaBackdrop />

        {/* Mobile backdrop */}
        {mobileOpen && (
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* ── Sidebar (icon rail) ──
            On lg+ screens the sidebar is an in-flow flex sibling of the main
            column with a small surrounding gutter so the rail visually floats
            and never visually presses against page content. On smaller screens
            it slides in as an overlay drawer. */}
        <aside
          className={cn(
            // Mobile: overlay drawer
            'fixed inset-y-0 left-0 z-50 flex flex-col w-[260px]',
            '-translate-x-full transition-transform duration-300 ease-out',
            mobileOpen && 'translate-x-0',
            // Desktop: anchored, edge-to-edge, fixed-height rail with solid border
            'lg:static lg:translate-x-0 lg:shrink-0 lg:sticky lg:top-0',
            'lg:h-screen lg:p-0',
            'lg:transition-[width] lg:duration-300 lg:ease-out',
            'lg:border-r lg:border-white/[0.06]',
            railWidth,
          )}
          style={{
            background:
              'linear-gradient(180deg, hsla(220, 18%, 4%, 0.92) 0%, hsla(220, 16%, 3%, 0.96) 100%)',
            backdropFilter: 'blur(40px) saturate(160%)',
            WebkitBackdropFilter: 'blur(40px) saturate(160%)',
          }}
        >
          {/* Inset floating panel (only on lg+) */}
          <div
            className={cn(
              'relative flex flex-1 flex-col min-h-0',
            )}
          >
          {/* Soft inner highlight at the top edge for depth */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, hsla(0,0%,100%,0.08) 50%, transparent 100%)',
            }}
          />
          {/* Subtle accent halo */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full opacity-50"
            style={{
              background:
                'radial-gradient(closest-side, hsl(var(--primary) / 0.18), transparent 70%)',
              filter: 'blur(24px)',
            }}
          />
          {/* Brand — height matches topbar (56px) for perfect cross-axis alignment */}
          <div className={cn('relative flex h-[56px] shrink-0 items-center gap-3 px-4 border-b border-white/[0.04]', collapsed && 'lg:justify-center lg:px-0')}>
            <Link to="/projects" className="group flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-[hsl(var(--primary)/0.35)] to-[hsl(var(--accent)/0.15)] opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500" />
                <div className="relative w-9 h-9 rounded-2xl bg-gradient-to-br from-white/[0.07] to-white/[0.015] flex items-center justify-center overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.4),inset_0_1px_0_hsla(0,0%,100%,0.06)]">
                  <img src={logoImage} alt="Apex-Studio" className="w-[22px] h-[22px] object-contain opacity-90 group-hover:scale-105 transition-transform duration-300" />
                </div>
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0 lg:flex">
                  <span className="text-[15px] font-semibold text-white/95 tracking-[-0.03em] leading-none font-display truncate">
                    Apex<span className="display-serif text-white/85 mx-[1px] text-[15px]">-</span><span className="display-serif text-white/85 text-[15px]">Studio</span>
                  </span>
                  <span className="text-[9px] font-light uppercase tracking-[0.22em] text-white/30 mt-[4px]">
                    Creative Suite
                  </span>
                </div>
              )}
            </Link>
            <button
              className="ml-auto lg:hidden w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.06] text-white/45 hover:text-white/80 transition-colors duration-200"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Workspace switcher */}
          <WorkspaceSwitcher collapsed={collapsed} />

          {/* Create CTA */}
          <div className={cn('px-3 pt-1 pb-4', collapsed && 'lg:px-2')}>
            <button
              onClick={() => navigateTo('/create')}
              className={cn(
                'group relative w-full overflow-hidden rounded-full flex items-center justify-center gap-2 h-10 text-[12.5px] font-medium tracking-[-0.01em] transition-all duration-500',
                'bg-gradient-to-b from-white/[0.10] to-white/[0.04] hover:from-white/[0.14] hover:to-white/[0.06]',
                'shadow-[0_10px_32px_-12px_hsl(215_100%_55%/0.45),inset_0_1px_0_hsla(0,0%,100%,0.10)] hover:shadow-[0_16px_44px_-12px_hsl(215_100%_55%/0.65),inset_0_1px_0_hsla(0,0%,100%,0.14)]',
                'hover:scale-[1.015] active:scale-[0.985]',
              )}
              style={{ color: 'hsl(var(--foreground))' }}
            >
              <span
                aria-hidden
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{
                  background:
                    'radial-gradient(180px 80px at 50% 120%, hsl(215, 100%, 60%, 0.5), transparent 70%)',
                }}
              />
              <Sparkles
                className="relative w-3.5 h-3.5 text-[hsl(215,100%,72%)] drop-shadow-[0_0_10px_hsl(215,100%,55%,0.7)] transition-transform duration-500 group-hover:rotate-12"
                strokeWidth={1.75}
              />
              {!collapsed && <span className="relative font-light tracking-[0.01em]">New Project</span>}
            </button>
          </div>

          {/* Section label */}
          {!collapsed && (
            <div className="px-5 mb-2 text-[9.5px] font-light uppercase tracking-[0.28em] text-white/25">
              Workspace
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-hide">
            <ul className="space-y-1">
              {PRIMARY_NAV.map((item) => {
                const active = isItemActive(item);
                const Icon = item.icon;
                const hue = item.hue;
                const tint = (a: number) => `hsla(${hue}, 90%, 62%, ${a})`;
                const link = (
                  <NavLink
                    to={item.to}
                    onClick={handleNavClick(item.to)}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-2xl px-3 h-[40px] text-[13px] font-light tracking-[-0.005em] transition-all duration-300',
                      active
                      ? 'text-white'
                        : 'text-white/55 hover:text-white',
                      collapsed && 'lg:justify-center lg:px-0 lg:gap-0',
                    )}
                    style={
                      active
                        ? {
                          background: `linear-gradient(90deg, ${tint(0.10)} 0%, ${tint(0.025)} 60%, transparent 100%)`,
                          }
                        : undefined
                    }
                  >
                    {/* Hover wash — colored, faint */}
                    {!active && (
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                        style={{
                        background: `linear-gradient(90deg, ${tint(0.06)} 0%, ${tint(0.015)} 60%, transparent 100%)`,
                        }}
                      />
                    )}
                    {active && (
                      <span
                        aria-hidden
                      className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-[2px] rounded-r-full"
                        style={{
                          background: `linear-gradient(180deg, hsl(${hue}, 100%, 72%) 0%, hsl(${hue}, 95%, 55%) 100%)`,
                        boxShadow: `0 0 12px ${tint(0.65)}`,
                        }}
                      />
                    )}
                    <Icon
                      className={cn(
                      'relative w-[18px] h-[18px] shrink-0 transition-colors duration-300',
                      )}
                      strokeWidth={1.5}
                      style={{
                      color: active ? `hsl(${hue}, 100%, 72%)` : tint(0.55),
                      }}
                    />
                    {!collapsed && (
                    <span className="relative truncate">
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                );
                return (
                  <li key={item.to}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8} className="bg-card/95 border-white/10 text-[12px] font-medium">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>

            {isAdmin && (
              <>
                <div className={cn('mt-6 mb-2 px-3 text-[9.5px] font-light uppercase tracking-[0.28em] text-white/25', collapsed && 'lg:hidden')}>
                  Admin
                </div>
                <ul className="space-y-1">
                  <li>
                    {(() => {
                      const active = location.pathname.startsWith('/admin');
                      const link = (
                        <NavLink
                          to="/admin"
                          onClick={handleNavClick('/admin')}
                          className={cn(
                            'group relative flex items-center gap-3 rounded-2xl px-3 h-[40px] text-[13px] font-light tracking-[-0.005em] transition-all duration-300',
                            active
                              ? 'text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.07)]'
                              : 'text-white/55 hover:text-white hover:bg-white/[0.03]',
                            collapsed && 'lg:justify-center lg:px-0',
                          )}
                        >
                          <Shield strokeWidth={1.5} className={cn('w-[18px] h-[18px] shrink-0 transition-colors duration-300', active ? 'text-[hsl(var(--warning))]' : 'text-white/45 group-hover:text-white/80')} />
                          {!collapsed && <span>Admin Panel</span>}
                        </NavLink>
                      );
                      return collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right" sideOffset={8}>Admin Panel</TooltipContent>
                        </Tooltip>
                      ) : link;
                    })()}
                  </li>
                </ul>
              </>
            )}
          </nav>

          {/* Seedance 2.0 promo — calmer surface, single-blue accent, no drifting glow */}
          {!collapsed ? (
            <div className="px-3 pb-2">
              <NavLink
                to="/?ref=sidebar#seedance"
                className="group relative block overflow-hidden rounded-2xl p-3 transition-colors duration-300"
                style={{
                  background: 'linear-gradient(180deg, hsla(220,14%,7%,0.55) 0%, hsla(220,14%,4%,0.35) 100%)',
                  border: '1px solid hsla(0,0%,100%,0.05)',
                }}
              >
                <div className="relative flex items-center gap-2 mb-1.5">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inset-0 rounded-full animate-ping bg-[hsl(215,100%,60%)] opacity-60" />
                    <span className="relative w-1.5 h-1.5 rounded-full bg-[hsl(215,100%,60%)]" />
                  </span>
                  <span className="text-[9px] font-light tracking-[0.28em] uppercase text-white/40">
                    Now Live
                  </span>
                </div>
                <div className="relative font-display text-[15px] leading-tight font-medium tracking-[-0.01em] text-white/90">
                  Seedance <span className="italic font-light text-white/70">2.0</span>
                </div>
                <p className="relative text-[11px] text-white/40 font-light leading-snug mt-1">
                  4× faster cinematic motion.
                </p>
                <div className="relative mt-2 inline-flex items-center gap-1 text-[10.5px] font-light text-[hsl(215,100%,72%)]">
                  Explore
                  <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.75} />
                </div>
              </NavLink>
            </div>
          ) : (
            <div className="px-3 pb-2 hidden lg:flex justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink
                    to="/?ref=sidebar#seedance"
                    aria-label="Seedance 2.0"
                    className="relative w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300"
                    style={{
                      background: 'hsla(220,14%,7%,0.55)',
                      border: '1px solid hsla(0,0%,100%,0.05)',
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-[hsl(215,100%,72%)]" strokeWidth={1.5} />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[hsl(215,100%,60%)] ring-2 ring-black" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="bg-card/95 border-white/10">
                  <div className="text-[12px] font-medium">Seedance 2.0 · Now Live</div>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Sidebar footer: credits + collapse */}
          <div className={cn('px-3 pb-3 pt-3 space-y-1.5 border-t border-white/[0.04]')}>
            <button
              onClick={() => setShowBuyCredits(true)}
              className={cn(
                'w-full group relative overflow-hidden flex items-center gap-2.5 h-11 rounded-full px-3.5 transition-colors duration-300',
                'bg-white/[0.03] hover:bg-white/[0.05] shadow-[inset_0_1px_0_hsla(0,0%,100%,0.05)]',
                collapsed && 'lg:justify-center lg:px-0',
              )}
            >
              <div className="relative shrink-0">
                <div className={cn(
                  'absolute inset-0 rounded-full blur-[6px] opacity-60',
                  isZeroCredits ? 'bg-[hsl(0_100%_55%/0.35)]' : 'bg-[hsl(215_100%_55%/0.35)]',
                )} />
                <div className={cn(
                  'relative w-[20px] h-[20px] rounded-full flex items-center justify-center',
                  isZeroCredits
                    ? 'bg-gradient-to-br from-[hsl(0_100%_60%)] to-[hsl(0_85%_45%)]'
                    : 'bg-gradient-to-br from-[hsl(215_100%_68%)] to-[hsl(215_100%_48%)]',
                )}>
                  <Zap className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="text-[9.5px] uppercase tracking-[0.24em] text-white/40 font-light">Credits</span>
                  <span className={cn(
                    'text-[14px] font-light tabular-nums tracking-[-0.01em]',
                    isZeroCredits ? 'text-[hsl(0_100%_72%)]' : 'text-white/85',
                  )}>
                    {credits}
                  </span>
                </div>
              )}
            </button>

            <button
              onClick={() => setCollapsed((c) => !c)}
              className={cn(
                'hidden lg:flex w-full items-center gap-2 h-8 rounded-full px-3 text-[11px] font-light text-white/35 hover:text-white/75 hover:bg-white/[0.03] transition-colors duration-300',
                collapsed && 'lg:justify-center lg:px-0',
              )}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeft className="w-3.5 h-3.5" strokeWidth={1.5} /> : (
                <>
                  <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
          </div>
        </aside>

        {/* ── Main column ── */}
        <div className="flex flex-1 min-w-0 flex-col min-h-screen lg:h-screen lg:overflow-hidden overflow-x-hidden">
          {/* Top bar */}
          <header
            className="sticky top-0 z-30 h-[56px] shrink-0 flex items-center gap-2 px-3 sm:px-5 border-b border-white/[0.04] relative"
            style={{
              background:
                'linear-gradient(180deg, hsla(220, 14%, 3%, 0.55) 0%, hsla(220, 14%, 3%, 0.15) 100%)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            }}
          >
            {/* Top-edge platinum shine — jewelry-box detail */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, hsla(0,0%,100%,0.10) 30%, hsla(212,100%,68%,0.18) 50%, hsla(0,0%,100%,0.10) 70%, transparent 100%)',
              }}
            />
            {/* Soft underglow under the bar */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-12 -bottom-px h-px opacity-60"
              style={{
                background:
                  'linear-gradient(90deg, transparent, hsla(212,100%,60%,0.20), transparent)',
              }}
            />
            {/* Mobile menu */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.06] transition-all duration-300"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" strokeWidth={1.5} />
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Language switcher */}
            <LanguageSwitcher size="sm" variant="ghost" showLabel={false} className="text-white/55 hover:text-white" />

            {/* Notifications */}
            <NotificationBell />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-full bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-500 shadow-[inset_0_1px_0_hsla(0,0%,100%,0.05)] hover:shadow-[inset_0_1px_0_hsla(0,0%,100%,0.08),0_8px_24px_-12px_rgba(0,0,0,0.5)] hover:scale-[1.02]">
                  <div className="relative">
                    <div className="absolute -inset-[2px] rounded-full bg-gradient-to-br from-[hsl(var(--primary)/0.4)] to-[hsl(var(--accent)/0.2)] opacity-0 group-hover:opacity-100 blur-[2px] transition-opacity duration-500" />
                    <div className="relative w-7 h-7 rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-white/[0.10] to-white/[0.03] shadow-[inset_0_1px_0_hsla(0,0%,100%,0.08)]">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-3.5 h-3.5 text-white/45" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="absolute -bottom-[1px] -right-[1px] w-[9px] h-[9px] rounded-full bg-[hsl(var(--success))] shadow-[0_0_0_2px_hsl(220_14%_3%),0_0_8px_hsl(var(--success)/0.6)]" />
                  </div>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-[12px] font-light tracking-[-0.005em] text-white/85 leading-none truncate max-w-[100px]">
                      {profile?.display_name || profile?.full_name || 'Creator'}
                    </span>
                    <span className="text-[9px] font-light text-white/30 leading-none mt-[3px] uppercase tracking-[0.22em]">
                      {isAdmin ? 'Admin' : 'Pro'}
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-white/25 group-hover:text-white/55 transition-all duration-300 group-hover:translate-y-[1px]" strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="w-60 rounded-3xl p-2"
                style={{
                  background: 'linear-gradient(180deg, hsla(220,14%,5%,0.97) 0%, hsla(220,14%,4%,0.98) 100%)',
                  backdropFilter: 'blur(56px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(56px) saturate(180%)',
                  boxShadow: '0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 hsla(0,0%,100%,0.06)',
                }}
              >
                <div className="px-3 py-3 mb-1 rounded-xl bg-gradient-to-r from-white/[0.03] to-transparent">
                  <p className="text-[13px] font-semibold text-white/90 truncate leading-tight">
                    {profile?.display_name || profile?.full_name || 'Creator'}
                  </p>
                  <p className="text-[11px] text-white/30 truncate leading-tight mt-0.5">
                    {profile?.email}
                  </p>
                </div>
                <DropdownMenuSeparator className="bg-white/[0.05] mx-1 my-1" />
                {(isBusiness
                  ? [
                      { icon: SettingsIcon, label: 'Workspace', path: '/workspace/general' },
                      { icon: HelpCircle, label: 'Help & FAQ', path: '/help' },
                    ]
                  : [
                      { icon: UserIcon, label: 'Profile', path: '/profile' },
                      { icon: SettingsIcon, label: 'Settings', path: '/settings' },
                      { icon: HelpCircle, label: 'Help & FAQ', path: '/help' },
                    ]
                ).map(({ icon: Icon, label, path }) => (
                  <DropdownMenuItem
                    key={path}
                    onClick={() => navigateTo(path)}
                    className="text-[12px] text-white/55 hover:text-white focus:text-white focus:bg-white/[0.06] rounded-xl py-2.5 px-3 gap-2.5 cursor-pointer"
                  >
                    <Icon className="w-3.5 h-3.5 opacity-70" />
                    {label}
                  </DropdownMenuItem>
                ))}
                {isAdmin && (
                  <DropdownMenuItem
                    onClick={() => navigateTo('/admin')}
                    className="text-[12px] text-[hsl(var(--warning))] hover:text-[hsl(var(--warning))] focus:bg-[hsl(var(--warning)/0.06)] rounded-xl py-2.5 px-3 gap-2.5 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 opacity-80" />
                    Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-white/[0.05] mx-1 my-1" />
                <SignOutDialog>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-[12px] text-[hsl(var(--destructive)/0.85)] hover:text-[hsl(var(--destructive))] focus:bg-[hsl(var(--destructive)/0.06)] rounded-xl py-2.5 px-3 gap-2.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 opacity-80" />
                    Sign Out
                  </DropdownMenuItem>
                </SignOutDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* Page content with expressive transition */}
          <main
            key={location.pathname}
            className="relative flex-1 animate-fade-in lg:overflow-y-auto lg:overflow-x-hidden premium-scroll"
          >
            {/* Cinematic ambient stage — landing-page deep-space vibe behind
                every in-app surface. Pure CSS, fixed to viewport, GPU-light. */}
            <div
              aria-hidden
              className="pointer-events-none fixed inset-0 z-0 hidden md:block"
              style={{
                background:
                  'radial-gradient(60% 50% at 18% 22%, hsla(215, 90%, 18%, 0.22), transparent 70%),' +
                  'radial-gradient(50% 45% at 88% 78%, hsla(200, 80%, 18%, 0.18), transparent 70%),' +
                  'radial-gradient(80% 60% at 50% 110%, hsla(215, 70%, 12%, 0.18), transparent 70%)',
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay hidden md:block"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
              }}
            />
            <div className="relative z-10">
            {children}
            </div>
          </main>
        </div>

        {showBuyCredits && (
          <BuyCreditsModal open={showBuyCredits} onOpenChange={setShowBuyCredits} />
        )}
      </div>
    </TooltipProvider>
  );
}

export default AppShell;
