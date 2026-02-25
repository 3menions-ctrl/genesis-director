import { useState, memo, forwardRef, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  Plus, Coins, User, Settings, HelpCircle, 
  Menu, X, Shield, LogOut, Sparkles, ChevronDown,
  Zap, Film, Scissors, GitBranch, Users, MessageCircle
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
  icon: typeof Film;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Library', path: '/projects', icon: Film },
  { label: 'Editor', path: '/editor', icon: Scissors },
  { label: 'Pipeline', path: '/production', icon: GitBranch },
  { label: 'Creators', path: '/creators', icon: Users },
  { label: 'Chat', path: '/chat', icon: MessageCircle },
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
      {/* ── Animated gradient accent line ── */}
      <div className="absolute inset-x-0 top-0 h-[1px] overflow-hidden">
        <div 
          className="absolute inset-0 animate-[shimmer-bg_6s_ease-in-out_infinite]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.4) 20%, hsl(var(--accent) / 0.3) 50%, hsl(var(--primary) / 0.4) 80%, transparent 100%)',
            backgroundSize: '200% 100%',
          }}
        />
      </div>

      {/* ── Main surface ── */}
      <div
        className="relative"
        style={{
          background: 'linear-gradient(180deg, rgba(10, 10, 18, 0.92) 0%, rgba(8, 8, 14, 0.88) 100%)',
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
        }}
      >
        <div className="relative max-w-[1440px] mx-auto px-3 sm:px-4 lg:px-6">
          <div className="h-[60px] flex items-center justify-between gap-2">

            {/* ── Logo ── */}
            <Link
              to="/projects"
              className="flex items-center gap-3 group shrink-0"
            >
              <div className="relative">
                {/* Glow ring */}
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-[hsl(var(--primary)/0.3)] to-[hsl(var(--accent)/0.15)] opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500" />
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.1] group-hover:border-white/[0.18] flex items-center justify-center transition-all duration-400 overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
                  <img
                    src={logoImage}
                    alt="Apex Studio"
                    className="w-[22px] h-[22px] object-contain opacity-90 group-hover:opacity-100 transition-all duration-300 group-hover:scale-105"
                  />
                </div>
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-[14px] font-bold text-white/90 tracking-[-0.02em] leading-none font-display">
                  Apex<span className="text-[hsl(var(--primary))]">·</span>Studio
                </span>
                <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-white/20 mt-[2px]">
                  Creative Suite
                </span>
              </div>
            </Link>

            {/* ── Centre Nav ── */}
            <div className="hidden md:flex items-center">
              <div className="flex items-center gap-[2px] p-[3px] rounded-2xl bg-white/[0.03] border border-white/[0.05] shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;
                  return (
                    <NavigationLink
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "relative px-3 py-[7px] text-[13px] font-medium rounded-[14px] transition-all duration-300 select-none flex items-center gap-1.5",
                        active
                          ? "text-background"
                          : "text-white/35 hover:text-white/70"
                      )}
                    >
                      {active && (
                        <span 
                          className="absolute inset-0 rounded-[14px] animate-fade-in-scale"
                          style={{
                            background: 'linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(var(--foreground) / 0.85) 100%)',
                            boxShadow: '0 2px 12px rgba(255,255,255,0.1), 0 0 20px rgba(255,255,255,0.05)',
                          }}
                        />
                      )}
                      <Icon className={cn(
                        "relative z-10 w-3.5 h-3.5 transition-all duration-300",
                        active ? "opacity-70" : "opacity-40 group-hover:opacity-60"
                      )} />
                      <span className="relative z-10">{item.label}</span>
                    </NavigationLink>
                  );
                })}
              </div>
            </div>

            {/* ── Mobile hamburger ── */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/[0.06] transition-colors duration-200 border border-transparent hover:border-white/[0.08]"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4 text-white/50" />
              ) : (
                <Menu className="w-4 h-4 text-white/50" />
              )}
            </button>

            {/* ── Right Actions ── */}
            <div className="hidden md:flex items-center gap-1 shrink-0">

              {/* Credits pill */}
              {showCredits && (
                <button
                  onClick={() => setShowBuyCreditsModal(true)}
                  className="group flex items-center gap-2 h-9 px-3.5 rounded-xl bg-gradient-to-r from-[hsl(42_30%_8%/0.6)] to-[hsl(42_20%_6%/0.4)] border border-[hsl(42_100%_55%/0.12)] hover:border-[hsl(42_100%_55%/0.3)] transition-all duration-300 hover:shadow-[0_0_16px_hsl(42_100%_50%/0.08)]"
                >
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-[hsl(42_100%_55%/0.3)] blur-[6px] group-hover:blur-[8px] transition-all" />
                    <div className="relative w-[18px] h-[18px] rounded-full bg-gradient-to-br from-[hsl(42_100%_65%)] via-[hsl(38_100%_55%)] to-[hsl(30_100%_45%)] flex items-center justify-center shadow-[0_0_8px_hsl(42_100%_55%/0.5)]">
                      <Zap className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </div>
                  </div>
                  <span className="text-[13px] font-bold text-[hsl(42_100%_70%/0.9)] tabular-nums group-hover:text-[hsl(42_100%_75%)] transition-colors">
                    {profile?.credits_balance?.toLocaleString() || 0}
                  </span>
                </button>
              )}

              {/* Notifications */}
              <div className="flex items-center">
                <NotificationBell />
              </div>

              {/* Create CTA */}
              {showCreate && (
                <Button
                  onClick={handleCreate}
                  size="sm"
                  className="h-9 px-5 text-[12px] font-bold rounded-xl border-0 transition-all duration-300 relative overflow-hidden group"
                  style={{
                    background: 'linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(0 0% 92%) 100%)',
                    color: '#08080e',
                    boxShadow: '0 2px 16px rgba(255,255,255,0.1), 0 0 24px rgba(255,255,255,0.04)',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--primary)/0.15)] to-[hsl(var(--accent)/0.1)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Sparkles className="relative z-10 w-3.5 h-3.5 mr-1.5 opacity-50" />
                  <span className="relative z-10">Create</span>
                </Button>
              )}

              {/* Divider */}
              <div className="w-px h-6 bg-white/[0.06] mx-1" />

              {/* User avatar + dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="group flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.05] transition-all duration-300">
                    <div className="relative">
                      {/* Avatar glow ring */}
                      <div className="absolute -inset-[2px] rounded-full bg-gradient-to-br from-[hsl(var(--primary)/0.4)] to-[hsl(var(--accent)/0.2)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-[2px]" />
                      <div className="relative w-7 h-7 rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-white/[0.1] to-white/[0.04] border border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-white/40" />
                        )}
                      </div>
                      {/* Online indicator */}
                      <div className="absolute -bottom-[1px] -right-[1px] w-[10px] h-[10px] rounded-full bg-[hsl(var(--success))] border-2 border-[#0a0a0f] shadow-[0_0_6px_hsl(var(--success)/0.5)]" />
                    </div>
                    <div className="hidden lg:flex flex-col items-start">
                      <span className="text-[12px] font-semibold text-white/70 leading-none truncate max-w-[80px]">
                        {profile?.display_name || profile?.full_name || 'Creator'}
                      </span>
                      <span className="text-[9px] text-white/25 leading-none mt-[2px] uppercase tracking-wider">
                        {isAdmin ? 'Admin' : 'Pro'}
                      </span>
                    </div>
                    <ChevronDown className="w-3 h-3 text-white/20 group-hover:text-white/40 transition-colors" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  sideOffset={10}
                  className="w-56 rounded-2xl p-2"
                  style={{
                    background: 'linear-gradient(180deg, rgba(16, 16, 24, 0.97) 0%, rgba(12, 12, 18, 0.98) 100%)',
                    backdropFilter: 'blur(40px)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04), 0 0 40px rgba(124,58,237,0.03)',
                  }}
                >
                  {/* Profile header */}
                  <div className="px-3 py-3 mb-1 rounded-xl bg-gradient-to-r from-white/[0.03] to-transparent">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden bg-gradient-to-br from-white/[0.1] to-white/[0.04] border border-white/[0.08]">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-white/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-white/90 truncate leading-tight">
                          {profile?.display_name || profile?.full_name || 'Creator'}
                        </p>
                        <p className="text-[11px] text-white/25 truncate leading-tight mt-0.5">
                          {profile?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Credits inline */}
                  <div className="mx-1 mb-2 rounded-xl px-3 py-2.5 flex items-center justify-between bg-gradient-to-r from-[hsl(42_30%_7%/0.8)] to-[hsl(42_20%_5%/0.4)] border border-[hsl(42_100%_55%/0.08)]">
                    <span className="text-[11px] text-white/30 font-medium">Credits</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-[hsl(42_100%_65%)] to-[hsl(30_100%_45%)] flex items-center justify-center shadow-[0_0_6px_hsl(42_100%_55%/0.4)]">
                        <Zap className="w-2 h-2 text-white" strokeWidth={3} />
                      </div>
                      <span className="text-[13px] font-bold text-[hsl(42_100%_68%)] tabular-nums">
                        {profile?.credits_balance?.toLocaleString() || 0}
                      </span>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-white/[0.05] mx-1 my-1" />

                  <div className="space-y-0.5">
                    {[
                      { icon: User, label: 'Profile', path: '/profile' },
                      { icon: Settings, label: 'Settings', path: '/settings' },
                      { icon: HelpCircle, label: 'Help & FAQ', path: '/help' },
                    ].map(({ icon: Icon, label, path }) => (
                      <DropdownMenuItem
                        key={path}
                        onClick={() => navigateTo(path)}
                        className="text-[12px] text-white/45 hover:text-white focus:text-white focus:bg-white/[0.06] rounded-xl py-2.5 px-3 gap-2.5 cursor-pointer transition-all duration-200"
                      >
                        <Icon className="w-3.5 h-3.5 opacity-60" />
                        {label}
                      </DropdownMenuItem>
                    ))}

                    {isAdmin && (
                      <DropdownMenuItem
                        onClick={() => navigateTo('/admin')}
                        className="text-[12px] text-[hsl(var(--warning))] hover:text-[hsl(var(--warning))] focus:text-[hsl(var(--warning))] focus:bg-[hsl(var(--warning)/0.06)] rounded-xl py-2.5 px-3 gap-2.5 cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 opacity-80" />
                        Admin Panel
                      </DropdownMenuItem>
                    )}
                  </div>

                  <DropdownMenuSeparator className="bg-white/[0.05] mx-1 my-1" />

                  <SignOutDialog>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-[12px] text-[hsl(var(--destructive)/0.8)] hover:text-[hsl(var(--destructive))] focus:text-[hsl(var(--destructive))] focus:bg-[hsl(var(--destructive)/0.06)] rounded-xl py-2.5 px-3 gap-2.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 opacity-70" />
                      Sign Out
                    </DropdownMenuItem>
                  </SignOutDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom hairline with gradient */}
      <div className="absolute inset-x-0 bottom-0 h-px">
        <div className="absolute inset-0 bg-white/[0.04]" />
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            background: 'linear-gradient(90deg, transparent 10%, hsl(var(--primary) / 0.2) 50%, transparent 90%)',
          }}
        />
      </div>

      {/* ── Mobile Menu ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden border-b border-white/[0.06] animate-in slide-in-from-top-2 duration-200"
          style={{
            background: 'linear-gradient(180deg, rgba(10, 10, 18, 0.97) 0%, rgba(8, 8, 14, 0.98) 100%)',
            backdropFilter: 'blur(40px)',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavigationLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center w-full px-4 py-3 rounded-xl text-[13px] font-medium transition-all gap-3",
                    isActive(item.path)
                      ? "bg-white text-[#080810] shadow-[0_2px_16px_rgba(255,255,255,0.1)]"
                      : "text-white/35 hover:text-white/70 hover:bg-white/[0.04]"
                  )}
                >
                  <Icon className={cn(
                    "w-4 h-4",
                    isActive(item.path) ? "opacity-60" : "opacity-40"
                  )} />
                  {item.label}
                </NavigationLink>
              );
            })}

            <div className="pt-3 mt-2 border-t border-white/[0.06] flex items-center gap-2">
              {showCreate && (
                <Button
                  onClick={() => { handleCreate(); setMobileMenuOpen(false); }}
                  size="sm"
                  className="flex-1 h-10 rounded-xl border-0 font-bold text-[12px] bg-white text-[#080810] hover:bg-white/90 shadow-[0_2px_16px_rgba(255,255,255,0.1)]"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 opacity-50" />
                  Create
                </Button>
              )}
              {showCredits && (
                <button
                  onClick={() => { setShowBuyCreditsModal(true); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(42_30%_8%/0.8)] border border-[hsl(42_100%_55%/0.12)]"
                >
                  <Zap className="w-3 h-3 text-[hsl(42_100%_60%)]" />
                  <span className="text-[12px] font-bold text-[hsl(42_100%_70%)]">
                    {profile?.credits_balance?.toLocaleString() || 0}
                  </span>
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-white/[0.06] space-y-0.5">
              {[
                { to: '/profile', icon: User, label: 'Profile' },
                { to: '/settings', icon: Settings, label: 'Settings' },
                { to: '/help', icon: HelpCircle, label: 'Help' },
              ].map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[12px] font-medium text-white/35 hover:text-white/70 hover:bg-white/[0.04] transition-all"
                >
                  <Icon className="w-3.5 h-3.5 opacity-50" /> {label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[12px] font-medium text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.06)] transition-all"
                >
                  <Shield className="w-3.5 h-3.5" /> Admin
                </Link>
              )}
              <SignOutDialog>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[12px] font-medium text-[hsl(var(--destructive)/0.8)] hover:bg-[hsl(var(--destructive)/0.06)] transition-all">
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
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
