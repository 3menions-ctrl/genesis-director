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
  { label: 'Editor', path: '/editor' },
  { label: 'Pipeline', path: '/production' },
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
      {/* Ultra-thin top accent — barely visible */}
      <div className="absolute inset-x-0 top-0 h-px bg-white/[0.04]" />

      {/* Main surface — deep black glass, Apple-esque */}
      <div
        className="relative"
        style={{
          background: 'rgba(8, 8, 12, 0.82)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        }}
      >
        <div className="relative max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center justify-between gap-3">

            {/* ── Logo — minimal, confident ──────────────────── */}
            <Link
              to="/projects"
              className="flex items-center gap-2.5 group shrink-0"
            >
              <div className="relative w-8 h-8 rounded-[10px] bg-white/[0.06] border border-white/[0.08] group-hover:border-white/[0.14] flex items-center justify-center transition-all duration-300 overflow-hidden">
                <img
                  src={logoImage}
                  alt="Apex Studio"
                  className="w-5 h-5 object-contain opacity-90 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <span className="hidden sm:block text-[13px] font-semibold text-white/80 tracking-tight">
                Apex<span className="text-white/25">·</span>Studio
              </span>
            </Link>

            {/* ── Centre Nav — pill bar ───────────────────────── */}
            <div className="hidden md:flex items-center">
              <div className="flex items-center gap-0.5 p-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <NavigationLink
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "relative px-3.5 py-[5px] text-[13px] font-medium rounded-full transition-all duration-200 select-none",
                        active
                          ? "text-[#080810]"
                          : "text-white/40 hover:text-white/70"
                      )}
                    >
                      {active && (
                        <span className="absolute inset-0 rounded-full bg-white animate-fade-in-scale" />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </NavigationLink>
                  );
                })}
              </div>
            </div>

            {/* ── Mobile hamburger ────────────────────────────── */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors duration-200"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4 text-white/50" />
              ) : (
                <Menu className="w-4 h-4 text-white/50" />
              )}
            </button>

            {/* ── Right Actions — tight, clean ─────────────────── */}
            <div className="hidden md:flex items-center gap-1">

              {/* Credits pill — gold accent */}
              {showCredits && (
                <button
                  onClick={() => setShowBuyCreditsModal(true)}
                  className="group flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-[hsl(42_100%_55%/0.25)] hover:bg-[hsl(42_40%_8%/0.5)] transition-all duration-200"
                >
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[hsl(42_100%_60%)] to-[hsl(30_100%_45%)] flex items-center justify-center shadow-[0_0_6px_hsl(42_100%_55%/0.4)]">
                    <Zap className="w-2 h-2 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-[12px] font-semibold text-white/80 tabular-nums">
                    {profile?.credits_balance?.toLocaleString() || 0}
                  </span>
                </button>
              )}

              {/* Notifications */}
              <div className="flex items-center">
                <NotificationBell />
              </div>

              {/* Create CTA — white, confident */}
              {showCreate && (
                <Button
                  onClick={handleCreate}
                  size="sm"
                  className="h-8 px-4 text-[12px] font-semibold rounded-full bg-white text-[#080810] hover:bg-white/90 border-0 shadow-[0_0_20px_rgba(255,255,255,0.08)] transition-all duration-200 hover:shadow-[0_0_24px_rgba(255,255,255,0.12)]"
                >
                  <Sparkles className="w-3 h-3 mr-1.5 opacity-60" />
                  Create
                </Button>
              )}

              {/* User avatar + dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="group flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-full bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden bg-white/[0.08]">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-3 h-3 text-white/40" />
                      )}
                    </div>
                    <ChevronDown className="w-3 h-3 text-white/30 group-hover:text-white/50 transition-colors" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-52 rounded-2xl p-1.5"
                  style={{
                    background: 'rgba(14, 14, 20, 0.96)',
                    backdropFilter: 'blur(32px)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04)',
                  }}
                >
                  {/* Profile header */}
                  <div className="px-3 py-2.5 mb-1">
                    <p className="text-[13px] font-medium text-white/90 truncate leading-tight">
                      {profile?.display_name || profile?.full_name || 'Creator'}
                    </p>
                    <p className="text-[11px] text-white/30 truncate leading-tight mt-0.5">
                      {profile?.email}
                    </p>
                  </div>

                  {/* Credits inline */}
                  <div className="mx-1.5 mb-1.5 rounded-xl px-3 py-2 flex items-center justify-between bg-[hsl(42_40%_6%/0.8)] border border-[hsl(42_100%_55%/0.1)]">
                    <span className="text-[11px] text-white/30">Credits</span>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[hsl(42_100%_60%)] to-[hsl(30_100%_45%)] flex items-center justify-center">
                        <Zap className="w-1.5 h-1.5 text-white" strokeWidth={3} />
                      </div>
                      <span className="text-[12px] font-bold text-[hsl(42_100%_65%)] tabular-nums">
                        {profile?.credits_balance?.toLocaleString() || 0}
                      </span>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="bg-white/[0.06] mx-1.5 my-1" />

                  <div className="space-y-0.5">
                    {[
                      { icon: User, label: 'Profile', path: '/profile' },
                      { icon: Settings, label: 'Settings', path: '/settings' },
                      { icon: HelpCircle, label: 'Help', path: '/help' },
                    ].map(({ icon: Icon, label, path }) => (
                      <DropdownMenuItem
                        key={path}
                        onClick={() => navigateTo(path)}
                        className="text-[12px] text-white/50 hover:text-white focus:text-white focus:bg-white/[0.06] rounded-lg py-2 px-2.5 gap-2 cursor-pointer"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </DropdownMenuItem>
                    ))}

                    {isAdmin && (
                      <DropdownMenuItem
                        onClick={() => navigateTo('/admin')}
                        className="text-[12px] text-[hsl(var(--warning))] hover:text-[hsl(var(--warning))] focus:text-[hsl(var(--warning))] focus:bg-[hsl(var(--warning)/0.08)] rounded-lg py-2 px-2.5 gap-2 cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Admin
                      </DropdownMenuItem>
                    )}
                  </div>

                  <DropdownMenuSeparator className="bg-white/[0.06] mx-1.5 my-1" />

                  <SignOutDialog>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-[12px] text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] focus:text-[hsl(var(--destructive))] focus:bg-[hsl(var(--destructive)/0.06)] rounded-lg py-2 px-2.5 gap-2 cursor-pointer"
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
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/[0.04]" />

      {/* ── Mobile Menu ──────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden border-b border-white/[0.06]"
          style={{
            background: 'rgba(8, 8, 12, 0.96)',
            backdropFilter: 'blur(32px)',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <NavigationLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center w-full px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all",
                  isActive(item.path)
                    ? "bg-white text-[#080810]"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                )}
              >
                {item.label}
              </NavigationLink>
            ))}

            <div className="pt-3 mt-2 border-t border-white/[0.06] flex items-center gap-2">
              {showCreate && (
                <Button
                  onClick={() => { handleCreate(); setMobileMenuOpen(false); }}
                  size="sm"
                  className="flex-1 h-9 rounded-xl border-0 font-semibold text-[12px] bg-white text-[#080810] hover:bg-white/90"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                  Create
                </Button>
              )}
              {showCredits && (
                <button
                  onClick={() => { setShowBuyCreditsModal(true); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[hsl(42_40%_6%/0.8)] border border-[hsl(42_100%_55%/0.12)]"
                >
                  <Zap className="w-3 h-3 text-[hsl(42_100%_60%)]" />
                  <span className="text-[12px] font-bold text-white/80">
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
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[12px] font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[12px] font-medium text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.06)] transition-all"
                >
                  <Shield className="w-3.5 h-3.5" /> Admin
                </Link>
              )}
              <SignOutDialog>
                <button className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[12px] font-medium text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.06)] transition-all">
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
