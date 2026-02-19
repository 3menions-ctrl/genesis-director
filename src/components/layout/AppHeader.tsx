import { useState, memo, forwardRef, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  Plus, Coins, User, Settings, HelpCircle, 
  Menu, X, Shield, LogOut, Sparkles, ChevronDown,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { SignOutDialog } from '@/components/auth/SignOutDialog';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { NotificationBell } from '@/components/social/NotificationBell';
import { NavigationLink, useNavigationWithLoading } from '@/components/navigation';
import logoImage from '@/assets/apex-studio-logo.png';

interface NavItem {
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Library', path: '/projects' },
  { label: 'Pipeline', path: '/production' },
  { label: 'Editor', path: '/editor' },
  { label: 'Creators', path: '/creators' },
  { label: 'Chat', path: '/chat' },
];

interface AppHeaderProps {
  showCreate?: boolean;
  showCredits?: boolean;
  onCreateClick?: () => void;
  className?: string;
}

export const AppHeader = memo(forwardRef<HTMLElement, AppHeaderProps>(function AppHeader({ 
  showCreate = true, 
  showCredits = true,
  onCreateClick,
  className 
}, ref) {
  const { navigateTo } = useNavigationWithLoading();
  const location = useLocation();
  const { profile, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false);

  const handleCreate = useCallback(() => {
    if (onCreateClick) {
      onCreateClick();
    } else {
      navigateTo('/create');
    }
  }, [onCreateClick, navigateTo]);

  const isActive = (path: string) => {
    if (path === '/projects') {
      return location.pathname === '/projects';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav ref={ref} className={cn("sticky top-0 z-50", className)}>
      {/* Prismatic top edge — iridescent line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[hsl(var(--primary)/0.6)] to-transparent" />

      {/* Main glass surface */}
      <div
        className="relative"
        style={{
          background: 'hsl(250 15% 4% / 0.88)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        }}
      >
        {/* Ambient violet bloom */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-[600px] h-20 bg-[hsl(var(--primary)/0.06)] blur-3xl rounded-full" />
        </div>

        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[62px] flex items-center justify-between gap-4">

            {/* ── Logo ─────────────────────────────────────── */}
            <Link
              to="/projects"
              className="flex items-center gap-3 group shrink-0"
            >
              <div className="relative">
                <div className="absolute -inset-2 bg-[hsl(var(--primary)/0.18)] blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100" />
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(var(--primary)/0.15)] to-[hsl(var(--primary)/0.05)] border border-[hsl(var(--glass-border))] group-hover:border-[hsl(var(--primary)/0.35)] flex items-center justify-center transition-all duration-300 overflow-hidden">
                  <img
                    src={logoImage}
                    alt="Apex Studio"
                    className="w-6 h-6 object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
              </div>
              <div className="hidden sm:flex flex-col -space-y-0.5">
                <span className="text-[13px] font-bold text-[hsl(var(--foreground))] tracking-tight leading-none">
                  Apex<span className="text-[hsl(var(--primary))]">·</span>Studio
                </span>
                <span className="text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-[0.18em] leading-none">
                  AI Cinema
                </span>
              </div>
            </Link>

            {/* ── Centre Nav ──────────────────────────────── */}
            <div className="hidden md:flex items-center">
              <div
                className="relative flex items-center p-[3px] rounded-full"
                style={{
                  background: 'hsl(250 15% 7% / 0.8)',
                  boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.04), 0 1px 12px hsl(250 30% 5% / 0.5)',
                  border: '1px solid hsl(0 0% 100% / 0.07)',
                }}
              >
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <NavigationLink
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "relative px-4 py-[7px] text-[13px] font-medium rounded-full transition-all duration-300 overflow-hidden select-none",
                        active
                          ? "text-[hsl(250_15%_4%)]"
                          : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      )}
                    >
                      {active && (
                        <span
                          className="absolute inset-0 rounded-full animate-fade-in-scale"
                          style={{
                            background: 'hsl(0 0% 96%)',
                            boxShadow: '0 2px 12px hsl(0 0% 100% / 0.25), 0 0 0 1px hsl(0 0% 100% / 0.15)',
                          }}
                        />
                      )}
                      {!active && (
                        <span className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-200 bg-[hsl(0_0%_100%/0.04)]" />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </NavigationLink>
                  );
                })}
              </div>
            </div>

            {/* ── Mobile hamburger ────────────────────────── */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[hsl(var(--glass-bg-hover))] border border-transparent hover:border-[hsl(var(--glass-border))] transition-all duration-200"
            >
              {mobileMenuOpen ? (
                <X className="w-4.5 h-4.5 text-[hsl(var(--muted-foreground))]" />
              ) : (
                <Menu className="w-4.5 h-4.5 text-[hsl(var(--muted-foreground))]" />
              )}
            </button>

            {/* ── Right Actions ───────────────────────────── */}
            <div className="hidden md:flex items-center gap-1.5">

              {/* Credits pill */}
              {showCredits && (
                <button
                  onClick={() => setShowBuyCreditsModal(true)}
                  className="group flex items-center gap-2 h-9 px-3 rounded-full transition-all duration-200"
                  style={{
                    background: 'hsl(250 15% 7% / 0.7)',
                    border: '1px solid hsl(0 0% 100% / 0.07)',
                    boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.04)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(42 100% 55% / 0.3)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'hsl(42 60% 10% / 0.6)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(0 0% 100% / 0.07)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'hsl(250 15% 7% / 0.7)';
                  }}
                >
                  {/* Coin icon with ambient glow */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-[hsl(42_100%_55%/0.35)] blur-md rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative w-5 h-5 rounded-full bg-gradient-to-br from-[hsl(42_100%_60%)] to-[hsl(30_100%_45%)] flex items-center justify-center shadow-[0_0_8px_hsl(42_100%_55%/0.5)]">
                      <Zap className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                  <span className="text-[13px] font-bold text-[hsl(var(--foreground))] tabular-nums">
                    {profile?.credits_balance?.toLocaleString() || 0}
                  </span>
                  <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">cr</span>
                </button>
              )}

              {/* Divider */}
              <div className="h-5 w-px bg-[hsl(var(--glass-border))] mx-0.5" />

              {/* Notifications */}
              <div className="flex items-center">
                <NotificationBell />
              </div>

              {/* Divider */}
              <div className="h-5 w-px bg-[hsl(var(--glass-border))] mx-0.5" />

              {/* Create CTA */}
              {showCreate && (
                <Button
                  onClick={handleCreate}
                  size="sm"
                  className="h-9 px-5 text-[13px] font-semibold rounded-full border-0 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                  style={{
                    background: 'hsl(0 0% 96%)',
                    color: 'hsl(250 15% 6%)',
                    boxShadow: '0 0 0 1px hsl(0 0% 100% / 0.15), 0 4px 16px hsl(0 0% 100% / 0.12), 0 0 40px hsl(0 0% 100% / 0.06)',
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                  Create
                </Button>
              )}

              {/* User avatar + dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="group flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-full transition-all duration-200"
                    style={{
                      background: 'hsl(250 15% 7% / 0.7)',
                      border: '1px solid hsl(0 0% 100% / 0.07)',
                      boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.04)',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(var(--primary) / 0.3)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(0 0% 100% / 0.07)';
                    }}
                  >
                    {/* Avatar ring */}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden transition-all duration-300"
                      style={{
                        background: 'linear-gradient(135deg, hsl(var(--primary)/0.4), hsl(280 70% 60% / 0.3))',
                        boxShadow: '0 0 0 1.5px hsl(var(--primary)/0.25)',
                      }}
                    >
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                      )}
                    </div>
                    <span className="text-[12px] font-medium text-[hsl(var(--foreground))] max-w-[80px] truncate">
                      {profile?.display_name || profile?.full_name?.split(' ')[0] || 'You'}
                    </span>
                    <ChevronDown className="w-3 h-3 text-[hsl(var(--muted-foreground))] opacity-60 group-hover:opacity-100 transition-opacity" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  sideOffset={10}
                  className="w-56 rounded-2xl p-1.5 shadow-2xl"
                  style={{
                    background: 'hsl(250 12% 9% / 0.98)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid hsl(0 0% 100% / 0.08)',
                    boxShadow: '0 24px 64px hsl(250 30% 3% / 0.8), 0 0 0 1px hsl(0 0% 100% / 0.04)',
                  }}
                >
                  {/* Profile header */}
                  <div className="px-3 py-3 mb-1">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                        style={{
                          background: 'linear-gradient(135deg, hsl(var(--primary)/0.5), hsl(280 70% 60% / 0.4))',
                          boxShadow: '0 0 0 1.5px hsl(var(--primary)/0.3)',
                        }}
                      >
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[hsl(var(--foreground))] truncate leading-tight">
                          {profile?.display_name || profile?.full_name || 'Creator'}
                        </p>
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate leading-tight">
                          {profile?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className="mx-1.5 mb-1.5 rounded-xl px-3 py-2.5 flex items-center justify-between"
                    style={{
                      background: 'hsl(42 60% 8% / 0.8)',
                      border: '1px solid hsl(42 100% 55% / 0.12)',
                    }}
                  >
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Credits</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-[hsl(42_100%_60%)] to-[hsl(30_100%_45%)] flex items-center justify-center">
                        <Zap className="w-2 h-2 text-white" strokeWidth={3} />
                      </div>
                      <span className="text-[13px] font-bold text-[hsl(42_100%_68%)] tabular-nums">
                        {profile?.credits_balance?.toLocaleString() || 0}
                      </span>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-[hsl(var(--glass-border))] mx-1.5 my-1" />

                  <div className="space-y-0.5">
                    {[
                      { icon: User, label: 'Profile', path: '/profile' },
                      { icon: Settings, label: 'Settings', path: '/settings' },
                      { icon: HelpCircle, label: 'Help Center', path: '/help' },
                    ].map(({ icon: Icon, label, path }) => (
                      <DropdownMenuItem
                        key={path}
                        onClick={() => navigateTo(path)}
                        className="text-[13px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] focus:text-[hsl(var(--foreground))] focus:bg-[hsl(var(--glass-bg-hover))] rounded-xl py-2.5 px-3 gap-2.5 cursor-pointer"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </DropdownMenuItem>
                    ))}

                    {isAdmin && (
                      <DropdownMenuItem
                        onClick={() => navigateTo('/admin')}
                        className="text-[13px] text-[hsl(var(--warning))] hover:text-[hsl(var(--warning))] focus:text-[hsl(var(--warning))] focus:bg-[hsl(var(--warning)/0.08)] rounded-xl py-2.5 px-3 gap-2.5 cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Admin Panel
                      </DropdownMenuItem>
                    )}
                  </div>

                  <DropdownMenuSeparator className="bg-[hsl(var(--glass-border))] mx-1.5 my-1" />

                  <SignOutDialog>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-[13px] text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] focus:text-[hsl(var(--destructive))] focus:bg-[hsl(var(--destructive)/0.08)] rounded-xl py-2.5 px-3 gap-2.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </DropdownMenuItem>
                  </SignOutDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom hairline */}
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[hsl(var(--glass-border))] to-transparent" />

      {/* ── Mobile Menu ─────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden border-b"
          style={{
            background: 'hsl(250 15% 5% / 0.97)',
            backdropFilter: 'blur(28px)',
            borderColor: 'hsl(var(--glass-border))',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavigationLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center w-full px-4 py-3 rounded-xl text-[13px] font-medium transition-all",
                  isActive(item.path)
                    ? "bg-[hsl(0_0%_96%)] text-[hsl(250_15%_5%)]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--glass-bg-hover))]"
                )}
              >
                {item.label}
              </NavigationLink>
            ))}

            <div className="pt-3 mt-2 border-t border-[hsl(var(--glass-border))] flex items-center gap-2">
              {showCreate && (
                <Button
                  onClick={() => { handleCreate(); setMobileMenuOpen(false); }}
                  size="sm"
                  className="flex-1 h-10 rounded-xl border-0 font-semibold text-[13px]"
                  style={{ background: 'hsl(0 0% 95%)', color: 'hsl(250 15% 5%)' }}
                >
                  <Sparkles className="w-4 h-4 mr-2 opacity-70" />
                  Create
                </Button>
              )}
              {showCredits && (
                <button
                  onClick={() => { setShowBuyCreditsModal(true); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                  style={{
                    background: 'hsl(42 60% 8% / 0.8)',
                    border: '1px solid hsl(42 100% 55% / 0.15)',
                  }}
                >
                  <Zap className="w-3.5 h-3.5 text-[hsl(42_100%_60%)]" />
                  <span className="text-[13px] font-bold text-[hsl(var(--foreground))]">
                    {profile?.credits_balance?.toLocaleString() || 0}
                  </span>
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-[hsl(var(--glass-border))] space-y-0.5">
              {[
                { to: '/profile', icon: User, label: 'Profile' },
                { to: '/settings', icon: Settings, label: 'Settings' },
                { to: '/help', icon: HelpCircle, label: 'Help Center' },
              ].map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--glass-bg-hover))] transition-all"
                >
                  <Icon className="w-4 h-4" /> {label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.08)] transition-all"
                >
                  <Shield className="w-4 h-4" /> Admin Panel
                </Link>
              )}
              <SignOutDialog>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)] transition-all">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </SignOutDialog>
            </div>
          </div>
        </div>
      )}

      <BuyCreditsModal
        open={showBuyCreditsModal}
        onOpenChange={setShowBuyCreditsModal}
      />
    </nav>
  );
}));
