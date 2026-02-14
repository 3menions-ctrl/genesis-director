import { useState, memo, forwardRef, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  Plus, Coins, User, Settings, HelpCircle, 
  Menu, X, Shield, LogOut, Sparkles
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
  { label: 'Clips', path: '/clips' },
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
      {/* Cinematic top edge glow */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      {/* Bottom separator */}
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      
      {/* Main bar with deep glass */}
      <div className="relative bg-[hsl(250_15%_4%/0.85)] backdrop-blur-2xl">
        {/* Subtle violet ambient glow behind the bar */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-primary/[0.03] pointer-events-none" />
        
        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[60px] flex items-center justify-between gap-4">
            
            {/* Logo — with ambient glow */}
            <Link 
              to="/projects"
              className="flex items-center gap-3 group shrink-0"
            >
              <div className="relative">
                <div className="absolute -inset-2 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img 
                  src={logoImage} 
                  alt="Apex Studio" 
                  className="relative w-9 h-9 object-contain group-hover:scale-110 transition-transform duration-300"
                />
              </div>
              <span className="text-base font-bold text-foreground tracking-tight hidden sm:block">
                Apex<span className="text-primary">·</span>Studio
              </span>
            </Link>

            {/* Center Navigation — Cinematic pill bar */}
            <div className="hidden md:flex items-center">
              <div className="relative flex items-center gap-0.5 rounded-full p-1 bg-[hsl(var(--surface-1)/0.6)] border border-[hsl(var(--glass-border))] backdrop-blur-sm">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <NavigationLink
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "relative px-5 py-2 text-sm font-medium rounded-full transition-all duration-300 overflow-hidden",
                        active
                          ? "text-primary-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {/* Active pill background with glow */}
                      {active && (
                        <span className="absolute inset-0 rounded-full bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.4)] animate-fade-in-scale" />
                      )}
                      {/* Hover fill for inactive items */}
                      {!active && (
                        <span className="absolute inset-0 rounded-full bg-white/0 hover:bg-white/[0.04] transition-colors duration-300" />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </NavigationLink>
                  );
                })}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Menu className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            {/* Right Actions */}
            <div className="hidden md:flex items-center gap-2">
              {/* Create CTA — cinematic gradient button */}
              {showCreate && (
                <Button 
                  onClick={handleCreate}
                  size="sm"
                  className="h-9 px-5 text-sm font-semibold rounded-full bg-gradient-to-r from-primary to-[hsl(280_70%_60%)] hover:from-primary/90 hover:to-[hsl(280_70%_55%)] text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.35)] hover:shadow-[0_0_32px_hsl(var(--primary)/0.5)] transition-all duration-300 border-0"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Create
                </Button>
              )}

              {/* Credits pill — refined glass */}
              {showCredits && (
                <button
                  onClick={() => setShowBuyCreditsModal(true)}
                  className="flex items-center gap-2 h-9 px-3.5 rounded-full bg-[hsl(var(--surface-1)/0.5)] border border-[hsl(var(--glass-border))] hover:border-[hsl(var(--glass-border-hover))] hover:bg-[hsl(var(--surface-2)/0.5)] transition-all duration-200 group"
                >
                  <div className="w-4.5 h-4.5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-[0_0_8px_hsl(42_100%_55%/0.3)]">
                    <Coins className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="text-sm font-bold text-foreground tabular-nums">{profile?.credits_balance?.toLocaleString() || 0}</span>
                </button>
              )}

              {/* Notifications */}
              <NotificationBell />

              {/* User Menu — refined avatar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center p-1 rounded-full hover:bg-white/[0.05] transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-[hsl(280_70%_60%/0.3)] border border-[hsl(var(--glass-border))] group-hover:border-primary/30 flex items-center justify-center overflow-hidden transition-all duration-300">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-[hsl(var(--surface-1))] backdrop-blur-2xl border-[hsl(var(--glass-border))] rounded-xl p-1.5 shadow-xl">
                  <div className="px-3 py-3 border-b border-[hsl(var(--border))]">
                    <p className="text-sm font-semibold text-foreground truncate">{profile?.display_name || profile?.full_name || 'Creator'}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                  </div>
                  <div className="py-1.5">
                    <DropdownMenuItem onClick={() => navigateTo('/profile')} className="text-sm text-muted-foreground hover:text-foreground focus:text-foreground focus:bg-white/[0.06] rounded-lg py-2.5 px-3 gap-2.5">
                      <User className="w-4 h-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateTo('/settings')} className="text-sm text-muted-foreground hover:text-foreground focus:text-foreground focus:bg-white/[0.06] rounded-lg py-2.5 px-3 gap-2.5">
                      <Settings className="w-4 h-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateTo('/help')} className="text-sm text-muted-foreground hover:text-foreground focus:text-foreground focus:bg-white/[0.06] rounded-lg py-2.5 px-3 gap-2.5">
                      <HelpCircle className="w-4 h-4" />
                      Help Center
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigateTo('/admin')} className="text-sm text-warning hover:text-warning focus:text-warning focus:bg-warning/10 rounded-lg py-2.5 px-3 gap-2.5">
                        <Shield className="w-4 h-4" />
                        Admin Panel
                      </DropdownMenuItem>
                    )}
                  </div>
                  <DropdownMenuSeparator className="bg-[hsl(var(--border))]" />
                  <SignOutDialog>
                    <DropdownMenuItem 
                      onSelect={(e) => e.preventDefault()}
                      className="text-sm text-destructive hover:text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg py-2.5 px-3 gap-2.5 cursor-pointer flex items-center justify-center"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </SignOutDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[hsl(var(--surface-1)/0.95)] backdrop-blur-2xl border-b border-[hsl(var(--border))]">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
            {NAV_ITEMS.map((item) => (
              <NavigationLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block w-full px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  isActive(item.path)
                    ? "text-primary-foreground bg-primary/80" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                )}
              >
                {item.label}
              </NavigationLink>
            ))}
            
            {/* Create & Credits Row */}
            <div className="pt-2 border-t border-[hsl(var(--border))] flex items-center gap-3">
              {showCreate && (
                <Button 
                  onClick={() => {
                    handleCreate();
                    setMobileMenuOpen(false);
                  }}
                  size="sm"
                  className="flex-1 h-10 bg-gradient-to-r from-primary to-[hsl(280_70%_60%)] text-primary-foreground hover:opacity-90 font-semibold rounded-xl border-0"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create
                </Button>
              )}
              
              {showCredits && (
                <button
                  onClick={() => {
                    setShowBuyCreditsModal(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(var(--surface-2)/0.5)] border border-[hsl(var(--glass-border))]"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Coins className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-foreground">{profile?.credits_balance?.toLocaleString() || 0}</span>
                </button>
              )}
            </div>

            {/* User Menu Items */}
            <div className="pt-2 border-t border-[hsl(var(--border))] space-y-1">
              <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all">
                <User className="w-4 h-4" /> Profile
              </Link>
              <Link to="/settings" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all">
                <Settings className="w-4 h-4" /> Settings
              </Link>
              <Link to="/help" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all">
                <HelpCircle className="w-4 h-4" /> Help Center
              </Link>
              {isAdmin && (
                <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-warning hover:bg-warning/10 transition-all">
                  <Shield className="w-4 h-4" /> Admin Panel
                </Link>
              )}
              <SignOutDialog>
                <button className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </SignOutDialog>
            </div>
          </div>
        </div>
      )}

      {/* Buy Credits Modal */}
      <BuyCreditsModal 
        open={showBuyCreditsModal} 
        onOpenChange={setShowBuyCreditsModal} 
      />
    </nav>
  );
}));
