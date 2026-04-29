import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import {
  Film, Sparkles, Users, Scissors, Layers, GraduationCap,
  User as UserIcon, Settings as SettingsIcon, HelpCircle, Shield, LogOut,
  Zap, ChevronDown, Menu, X, Bell, PanelLeftClose, PanelLeft,
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
import { useNavigationWithLoading } from '@/components/navigation';
import logoImage from '@/assets/apex-studio-logo.png';
import { CinemaBackdrop } from '@/components/ui/CinemaBackdrop';

interface NavItem {
  label: string;
  to: string;
  icon: typeof Film;
  match?: (pathname: string) => boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { label: 'Library', to: '/projects', icon: Film, match: (p) => p === '/projects' || p.startsWith('/projects') },
  { label: 'Create', to: '/create', icon: Sparkles },
  { label: 'Editor', to: '/editor', icon: Scissors },
  { label: 'Avatars', to: '/avatars', icon: UserIcon },
  { label: 'Templates', to: '/templates', icon: Layers },
  { label: 'Training', to: '/training-video', icon: GraduationCap },
  { label: 'Creators', to: '/creators', icon: Users },
];

interface AppShellProps {
  children: ReactNode;
}

const SIDEBAR_KEY = 'apex.sidebar.collapsed';
const SIDEBAR_HIDDEN_KEY = 'apex.sidebar.hidden';

export function AppShell({ children }: AppShellProps) {
  const { profile, isAdmin } = useAuth();
  const { navigateTo } = useNavigationWithLoading();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_HIDDEN_KEY) === '1'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_HIDDEN_KEY, hidden ? '1' : '0'); } catch {}
  }, [hidden]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const isZeroCredits = (profile?.credits_balance ?? 0) === 0;
  const credits = profile?.credits_balance?.toLocaleString() || '0';

  const isItemActive = (item: NavItem) => {
    if (item.match) return item.match(location.pathname);
    return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
  };

  // Total rail width INCLUDING the surrounding gutter (so the inset panel
  // visually floats and content has breathing room).
  const railWidth = collapsed ? 'lg:w-[80px]' : 'lg:w-[244px]';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="relative flex min-h-screen w-full bg-background text-foreground overflow-x-hidden">
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
            // Desktop: in-flow flex sibling with surrounding gutter
            'lg:static lg:translate-x-0 lg:shrink-0 lg:sticky lg:top-0',
            'lg:h-screen lg:p-3',
            'lg:transition-[width] lg:duration-300 lg:ease-out',
            'lg:bg-transparent lg:!border-r-0 lg:!shadow-none lg:!backdrop-blur-0',
            railWidth,
            hidden && 'lg:hidden',
          )}
          style={{
            background:
              'linear-gradient(180deg, hsla(220, 14%, 5%, 0.85) 0%, hsla(220, 14%, 3%, 0.92) 100%)',
            backdropFilter: 'blur(48px) saturate(200%)',
            WebkitBackdropFilter: 'blur(48px) saturate(200%)',
            borderRight: '1px solid hsla(0, 0%, 100%, 0.05)',
            boxShadow: 'inset -1px 0 0 hsla(0, 0%, 100%, 0.02)',
          }}
        >
          {/* Inset floating panel (only on lg+) */}
          <div
            className={cn(
              'relative flex flex-1 flex-col min-h-0',
              'lg:rounded-2xl lg:overflow-hidden',
            )}
            style={{
              background:
                'linear-gradient(180deg, hsla(220, 14%, 6%, 0.85) 0%, hsla(220, 14%, 4%, 0.92) 100%)',
              backdropFilter: 'blur(48px) saturate(200%)',
              WebkitBackdropFilter: 'blur(48px) saturate(200%)',
              border: '1px solid hsla(0, 0%, 100%, 0.06)',
              boxShadow:
                '0 24px 48px -24px rgba(0,0,0,0.6), 0 0 0 1px hsla(0,0%,100%,0.02), inset 0 1px 0 hsla(0,0%,100%,0.04)',
            }}
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
          {/* Brand */}
          <div className={cn('relative flex h-[60px] shrink-0 items-center gap-3 px-4', collapsed && 'lg:justify-center lg:px-0')}>
            <Link to="/projects" className="group flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-[hsl(var(--primary)/0.35)] to-[hsl(var(--accent)/0.15)] opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500" />
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.1] flex items-center justify-center overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
                  <img src={logoImage} alt="Apex Studio" className="w-[22px] h-[22px] object-contain opacity-90 group-hover:scale-105 transition-transform duration-300" />
                </div>
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0 lg:flex">
                  <span className="text-[14px] font-bold text-white/90 tracking-[-0.02em] leading-none font-display truncate">
                    Apex<span className="text-[hsl(var(--primary))]">·</span>Studio
                  </span>
                  <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/25 mt-[3px]">
                    Creative Suite
                  </span>
                </div>
              )}
            </Link>
            <button
              className="ml-auto lg:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] text-white/50"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              className={cn(
                'ml-auto hidden lg:flex w-8 h-8 rounded-lg items-center justify-center hover:bg-white/[0.06] text-white/50 hover:text-white transition-colors',
                collapsed && 'lg:hidden',
              )}
              onClick={() => setHidden(true)}
              aria-label="Hide sidebar"
              title="Hide sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Create CTA */}
          <div className={cn('px-3 pt-1 pb-4', collapsed && 'lg:px-2')}>
            <button
              onClick={() => navigateTo('/create')}
              className={cn(
                'group relative w-full overflow-hidden rounded-xl flex items-center justify-center gap-2 h-10 text-[12.5px] font-semibold tracking-[-0.01em] transition-all duration-300',
                'border border-[hsl(var(--primary)/0.25)] hover:border-[hsl(var(--primary)/0.45)]',
                'bg-gradient-to-b from-[hsl(var(--primary)/0.16)] to-[hsl(var(--primary)/0.06)] hover:from-[hsl(var(--primary)/0.22)] hover:to-[hsl(var(--primary)/0.08)]',
                'shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.6),inset_0_1px_0_hsl(0_0%_100%/0.06)] hover:shadow-[0_12px_32px_-12px_hsl(var(--primary)/0.75),inset_0_1px_0_hsl(0_0%_100%/0.08)]',
              )}
              style={{ color: 'hsl(var(--foreground))' }}
            >
              <span
                aria-hidden
                className="absolute -top-1/2 left-0 right-0 h-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    'radial-gradient(140px 60px at 50% 100%, hsl(var(--primary) / 0.35), transparent 70%)',
                }}
              />
              <Sparkles className="relative w-4 h-4 text-[hsl(var(--primary))] drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
              {!collapsed && <span className="relative">New Project</span>}
            </button>
          </div>

          {/* Section label */}
          {!collapsed && (
            <div className="px-5 mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
              Workspace
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-hide">
            <ul className="space-y-1">
              {PRIMARY_NAV.map((item) => {
                const active = isItemActive(item);
                const Icon = item.icon;
                const link = (
                  <NavLink
                    to={item.to}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 h-[38px] text-[13px] font-medium tracking-[-0.005em] transition-all duration-200',
                      'border border-transparent',
                      active
                        ? 'text-white bg-gradient-to-r from-white/[0.08] to-white/[0.03] border-white/[0.07] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05)]'
                        : 'text-white/55 hover:text-white hover:bg-white/[0.035]',
                      collapsed && 'lg:justify-center lg:px-0 lg:gap-0',
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-gradient-to-b from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.6)] shadow-[0_0_12px_hsl(var(--primary)/0.7)]"
                      />
                    )}
                    <Icon
                      className={cn(
                        'w-[18px] h-[18px] shrink-0 transition-all duration-200',
                        active
                          ? 'text-[hsl(var(--primary))] drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]'
                          : 'text-white/45 group-hover:text-white/85 group-hover:scale-[1.06]',
                      )}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {active && !collapsed && (
                      <span
                        aria-hidden
                        className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))] shadow-[0_0_8px_hsl(var(--primary)/0.8)]"
                      />
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
                <div className={cn('mt-6 mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30', collapsed && 'lg:hidden')}>
                  Admin
                </div>
                <ul className="space-y-1">
                  <li>
                    {(() => {
                      const active = location.pathname.startsWith('/admin');
                      const link = (
                        <NavLink
                          to="/admin"
                          className={cn(
                            'group relative flex items-center gap-3 rounded-xl px-3 h-[38px] text-[13px] font-medium transition-all duration-200 border border-transparent',
                            active
                              ? 'text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.08)] border-[hsl(var(--warning)/0.18)] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]'
                              : 'text-white/55 hover:text-white hover:bg-white/[0.035]',
                            collapsed && 'lg:justify-center lg:px-0',
                          )}
                        >
                          <Shield className={cn('w-[18px] h-[18px] shrink-0 transition-transform duration-200', active ? 'text-[hsl(var(--warning))] drop-shadow-[0_0_6px_hsl(var(--warning)/0.5)]' : 'text-white/45 group-hover:text-white/80 group-hover:scale-[1.06]')} />
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

          {/* Sidebar footer: credits + collapse */}
          <div className={cn('px-3 pb-3 space-y-1.5 border-t border-white/[0.04] pt-3 bg-gradient-to-t from-black/30 to-transparent')}>
            <button
              onClick={() => setShowBuyCredits(true)}
              className={cn(
                'w-full group flex items-center gap-2.5 h-10 rounded-xl px-3 transition-all duration-300',
                isZeroCredits
                  ? 'bg-gradient-to-r from-[hsl(0_40%_10%/0.7)] to-[hsl(0_30%_8%/0.5)] border border-[hsl(0_100%_50%/0.25)] hover:border-[hsl(0_100%_50%/0.5)]'
                  : 'bg-gradient-to-r from-[hsl(42_30%_8%/0.6)] to-[hsl(42_20%_6%/0.4)] border border-[hsl(42_100%_55%/0.12)] hover:border-[hsl(42_100%_55%/0.3)]',
                collapsed && 'lg:justify-center lg:px-0',
              )}
            >
              <div className="relative shrink-0">
                <div className={cn('absolute inset-0 rounded-full blur-[6px]', isZeroCredits ? 'bg-[hsl(0_100%_50%/0.4)]' : 'bg-[hsl(42_100%_55%/0.3)]')} />
                <div className={cn('relative w-[18px] h-[18px] rounded-full flex items-center justify-center',
                  isZeroCredits
                    ? 'bg-gradient-to-br from-[hsl(0_100%_60%)] via-[hsl(0_90%_50%)] to-[hsl(0_80%_40%)]'
                    : 'bg-gradient-to-br from-[hsl(42_100%_65%)] via-[hsl(38_100%_55%)] to-[hsl(30_100%_45%)]')}>
                  <Zap className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                </div>
              </div>
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/45 font-semibold">Credits</span>
                  <span className={cn('text-[13px] font-bold tabular-nums', isZeroCredits ? 'text-[hsl(0_100%_70%)]' : 'text-[hsl(42_100%_70%)]')}>
                    {credits}
                  </span>
                </div>
              )}
            </button>

            <button
              onClick={() => setCollapsed((c) => !c)}
              className={cn(
                'hidden lg:flex w-full items-center gap-2 h-8 rounded-lg px-3 text-[10px] uppercase tracking-[0.16em] font-semibold text-white/35 hover:text-white/70 hover:bg-white/[0.04] transition-colors',
                collapsed && 'lg:justify-center lg:px-0',
              )}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeft className="w-4 h-4" /> : (
                <>
                  <PanelLeftClose className="w-4 h-4" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
          </div>
        </aside>

        {/* ── Main column ── */}
        <div className="flex flex-1 min-w-0 flex-col min-h-screen">
          {/* Top bar */}
          <header
            className="sticky top-0 z-30 h-[56px] flex items-center gap-2 px-3 sm:px-5"
            style={{
              background:
                'linear-gradient(180deg, hsla(220, 14%, 3%, 0.78) 0%, hsla(220, 14%, 3%, 0.55) 100%)',
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              borderBottom: '1px solid hsla(0, 0%, 100%, 0.05)',
            }}
          >
            {/* Mobile menu */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Desktop: show menu button when sidebar is hidden */}
            {hidden && (
              <button
                onClick={() => setHidden(false)}
                className="hidden lg:flex items-center gap-2 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.07] text-white/70 hover:text-white transition-all"
                aria-label="Show sidebar"
                title="Show sidebar"
              >
                <PanelLeft className="w-4 h-4" />
                <span className="text-[12px] font-medium">Menu</span>
              </button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Notifications */}
            <NotificationBell />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.05] transition-all duration-300">
                  <div className="relative">
                    <div className="absolute -inset-[2px] rounded-full bg-gradient-to-br from-[hsl(var(--primary)/0.4)] to-[hsl(var(--accent)/0.2)] opacity-0 group-hover:opacity-100 blur-[2px] transition-opacity duration-500" />
                    <div className="relative w-7 h-7 rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-white/[0.1] to-white/[0.04] border border-white/[0.08]">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-3.5 h-3.5 text-white/45" />
                      )}
                    </div>
                    <div className="absolute -bottom-[1px] -right-[1px] w-[10px] h-[10px] rounded-full bg-[hsl(var(--success))] border-2 border-[hsl(220_14%_3%)]" />
                  </div>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-[12px] font-semibold text-white/75 leading-none truncate max-w-[100px]">
                      {profile?.display_name || profile?.full_name || 'Creator'}
                    </span>
                    <span className="text-[9px] text-white/30 leading-none mt-[2px] uppercase tracking-wider">
                      {isAdmin ? 'Admin' : 'Pro'}
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-white/25 group-hover:text-white/50 transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="w-56 rounded-2xl p-2"
                style={{
                  background: 'linear-gradient(180deg, hsla(220,14%,5%,0.97) 0%, hsla(220,14%,4%,0.98) 100%)',
                  backdropFilter: 'blur(40px)',
                  border: '1px solid hsla(0,0%,100%,0.07)',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
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
                {[
                  { icon: UserIcon, label: 'Profile', path: '/profile' },
                  { icon: SettingsIcon, label: 'Settings', path: '/settings' },
                  { icon: HelpCircle, label: 'Help & FAQ', path: '/help' },
                ].map(({ icon: Icon, label, path }) => (
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
          <main key={location.pathname} className="flex-1 animate-fade-in">
            {children}
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
