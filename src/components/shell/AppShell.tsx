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

export function AppShell({ children }: AppShellProps) {
  const { profile, isAdmin } = useAuth();
  const { navigateTo } = useNavigationWithLoading();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const isZeroCredits = (profile?.credits_balance ?? 0) === 0;
  const credits = profile?.credits_balance?.toLocaleString() || '0';

  const isItemActive = (item: NavItem) => {
    if (item.match) return item.match(location.pathname);
    return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
  };

  const railWidth = collapsed ? 'lg:w-[68px]' : 'lg:w-[232px]';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="relative min-h-screen w-full bg-background text-foreground overflow-x-hidden">
        {/* Ambient cinematic background */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(900px 600px at 8% -10%, hsl(var(--primary) / 0.10), transparent 60%),' +
                'radial-gradient(700px 500px at 110% 10%, hsl(var(--accent) / 0.08), transparent 60%),' +
                'radial-gradient(800px 600px at 50% 110%, hsl(var(--primary) / 0.05), transparent 70%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
            style={{
              backgroundImage:
                'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%22240%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.6%22/></svg>")',
            }}
          />
        </div>

        {/* Mobile backdrop */}
        {mobileOpen && (
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* ── Sidebar (icon rail) ── */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex flex-col',
            'transition-[width,transform] duration-300 ease-out',
            // Mobile: slide in/out
            'w-[260px] -translate-x-full lg:translate-x-0',
            mobileOpen && 'translate-x-0',
            // Desktop width
            railWidth,
          )}
          style={{
            background:
              'linear-gradient(180deg, hsla(220, 14%, 4%, 0.92) 0%, hsla(220, 14%, 3%, 0.94) 100%)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            borderRight: '1px solid hsla(0, 0%, 100%, 0.06)',
          }}
        >
          {/* Brand */}
          <div className={cn('flex h-[56px] shrink-0 items-center gap-3 px-3', collapsed && 'lg:justify-center lg:px-0')}>
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
          </div>

          {/* Create CTA */}
          <div className={cn('px-3 pt-2 pb-3', collapsed && 'lg:px-2')}>
            <button
              onClick={() => navigateTo('/create')}
              className={cn(
                'group relative w-full overflow-hidden rounded-xl flex items-center justify-center gap-2 h-10 text-[12.5px] font-semibold transition-all duration-300',
                'border border-white/[0.08] hover:border-white/[0.14]',
                'bg-gradient-to-br from-white/[0.04] to-white/[0.01] hover:from-white/[0.07] hover:to-white/[0.02]',
                'shadow-[0_2px_24px_-8px_hsl(var(--primary)/0.4)] hover:shadow-[0_2px_32px_-8px_hsl(var(--primary)/0.55)]',
              )}
              style={{ color: 'hsl(var(--foreground))' }}
            >
              <span
                aria-hidden
                className="absolute inset-0 opacity-60 group-hover:opacity-100 transition-opacity"
                style={{
                  background:
                    'radial-gradient(120px 60px at 30% 0%, hsl(var(--primary) / 0.25), transparent 70%)',
                }}
              />
              <Sparkles className="relative w-4 h-4 text-[hsl(var(--primary))]" />
              {!collapsed && <span className="relative">New Project</span>}
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-2 pt-1 pb-3 scrollbar-hide">
            <ul className="space-y-1">
              {PRIMARY_NAV.map((item) => {
                const active = isItemActive(item);
                const Icon = item.icon;
                const link = (
                  <NavLink
                    to={item.to}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 h-10 text-[13px] font-medium transition-all duration-200',
                      'border border-transparent',
                      active
                        ? 'text-white bg-white/[0.06] border-white/[0.08] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]'
                        : 'text-white/55 hover:text-white hover:bg-white/[0.04]',
                      collapsed && 'lg:justify-center lg:px-0 lg:gap-0',
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r-full bg-[hsl(var(--primary))] shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
                      />
                    )}
                    <Icon className={cn('w-[18px] h-[18px] shrink-0 transition-colors', active ? 'text-[hsl(var(--primary))]' : 'text-white/45 group-hover:text-white/80')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
                return (
                  <li key={item.to}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" className="bg-card/95 border-white/10">
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
                <div className={cn('mt-5 mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25', collapsed && 'lg:hidden')}>
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
                            'group relative flex items-center gap-3 rounded-xl px-3 h-10 text-[13px] font-medium transition-all duration-200 border border-transparent',
                            active
                              ? 'text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.06)] border-[hsl(var(--warning)/0.14)]'
                              : 'text-white/55 hover:text-white hover:bg-white/[0.04]',
                            collapsed && 'lg:justify-center lg:px-0',
                          )}
                        >
                          <Shield className={cn('w-[18px] h-[18px] shrink-0', active ? 'text-[hsl(var(--warning))]' : 'text-white/45 group-hover:text-white/80')} />
                          {!collapsed && <span>Admin Panel</span>}
                        </NavLink>
                      );
                      return collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right">Admin Panel</TooltipContent>
                        </Tooltip>
                      ) : link;
                    })()}
                  </li>
                </ul>
              </>
            )}
          </nav>

          {/* Sidebar footer: credits + collapse */}
          <div className={cn('px-3 pb-3 space-y-2 border-t border-white/[0.05] pt-3')}>
            <button
              onClick={() => setShowBuyCredits(true)}
              className={cn(
                'w-full group flex items-center gap-2 h-10 rounded-xl px-3 transition-all duration-300',
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
                  <span className="text-[11px] uppercase tracking-wider text-white/40 font-medium">Credits</span>
                  <span className={cn('text-[13px] font-bold tabular-nums', isZeroCredits ? 'text-[hsl(0_100%_70%)]' : 'text-[hsl(42_100%_70%)]')}>
                    {credits}
                  </span>
                </div>
              )}
            </button>

            <button
              onClick={() => setCollapsed((c) => !c)}
              className={cn(
                'hidden lg:flex w-full items-center gap-2 h-9 rounded-lg px-3 text-[11px] uppercase tracking-wider text-white/35 hover:text-white/70 hover:bg-white/[0.04] transition-colors',
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
        </aside>

        {/* ── Main column ── */}
        <div className={cn('flex flex-col min-h-screen transition-[padding] duration-300', collapsed ? 'lg:pl-[68px]' : 'lg:pl-[232px]')}>
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
