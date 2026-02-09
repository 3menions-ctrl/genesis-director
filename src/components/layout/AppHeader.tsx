import { useState, memo, forwardRef, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  Plus, Coins, User, Settings, HelpCircle, 
  Menu, X, Shield, LogOut
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
import { UserStatsBar } from '@/components/social/UserStatsBar';
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
    <nav className={cn("sticky top-0 z-50", className)}>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="bg-black/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Logo */}
            <Link 
              to="/projects"
              className="flex items-center gap-3 group"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                <img 
                  src={logoImage} 
                  alt="Apex Studio" 
                  className="relative w-10 h-10 object-contain group-hover:scale-105 transition-transform"
                />
              </div>
              <span className="text-lg font-bold text-white tracking-tight hidden sm:block">Apex-Studio</span>
            </Link>

            {/* Center Navigation - Desktop with Navigation Guards */}
            <div className="hidden md:flex items-center gap-1 bg-white/[0.03] rounded-full p-1 border border-white/[0.05]">
              {NAV_ITEMS.map((item) => (
                <NavigationLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "px-5 py-2 text-sm font-medium rounded-full transition-all duration-300",
                    isActive(item.path)
                      ? "text-white bg-white/[0.1]" 
                      : "text-white/50 hover:text-white hover:bg-white/[0.05]"
                  )}
                >
                  {item.label}
                </NavigationLink>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-white/70" />
              ) : (
                <Menu className="w-5 h-5 text-white/70" />
              )}
            </button>

            {/* Right Actions */}
            <div className="hidden md:flex items-center gap-3">
              {/* User Stats Bar - Gamification */}
              <UserStatsBar />

              {showCreate && (
                <Button 
                  onClick={handleCreate}
                  size="sm"
                  className="h-10 px-5 text-sm bg-white text-black hover:bg-white/90 font-semibold rounded-full shadow-lg shadow-white/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              )}

              {/* Credits pill */}
              {showCredits && (
                <button
                  onClick={() => setShowBuyCreditsModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/15 transition-all"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Coins className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-white">{profile?.credits_balance?.toLocaleString() || 0}</span>
                </button>
              )}

              {/* Notifications */}
              <NotificationBell />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 p-1.5 rounded-full hover:bg-white/[0.05] transition-colors">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-white/60" />
                      )}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-black/95 backdrop-blur-2xl border-white/10 rounded-xl p-1.5">
                  <div className="px-3 py-3 border-b border-white/[0.06]">
                    <p className="text-sm font-semibold text-white truncate">{profile?.display_name || profile?.full_name || 'Creator'}</p>
                    <p className="text-xs text-white/40 truncate">{profile?.email}</p>
                  </div>
                  <div className="py-1.5">
                    <DropdownMenuItem onClick={() => navigateTo('/profile')} className="text-sm text-white/70 hover:text-white focus:text-white focus:bg-white/[0.08] rounded-lg py-2.5 px-3 gap-2.5">
                      <User className="w-4 h-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateTo('/settings')} className="text-sm text-white/70 hover:text-white focus:text-white focus:bg-white/[0.08] rounded-lg py-2.5 px-3 gap-2.5">
                      <Settings className="w-4 h-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateTo('/help')} className="text-sm text-white/70 hover:text-white focus:text-white focus:bg-white/[0.08] rounded-lg py-2.5 px-3 gap-2.5">
                      <HelpCircle className="w-4 h-4" />
                      Help Center
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigateTo('/admin')} className="text-sm text-amber-400 hover:text-amber-300 focus:text-amber-300 focus:bg-amber-500/10 rounded-lg py-2.5 px-3 gap-2.5">
                        <Shield className="w-4 h-4" />
                        Admin Panel
                      </DropdownMenuItem>
                    )}
                  </div>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <SignOutDialog>
                    <DropdownMenuItem 
                      onSelect={(e) => e.preventDefault()}
                      className="text-sm text-rose-400 hover:text-rose-300 focus:text-rose-300 focus:bg-rose-500/10 rounded-lg py-2.5 px-3 gap-2.5 cursor-pointer flex items-center justify-center"
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
        <div className="md:hidden bg-black/95 backdrop-blur-2xl border-b border-white/[0.05]">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
            {NAV_ITEMS.map((item) => (
              <NavigationLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block w-full px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  isActive(item.path)
                    ? "text-white bg-white/[0.1]" 
                    : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                )}
              >
                {item.label}
              </NavigationLink>
            ))}
            
            {/* Create & Credits Row */}
            <div className="pt-2 border-t border-white/[0.06] flex items-center gap-3">
              {showCreate && (
                <Button 
                  onClick={() => {
                    handleCreate();
                    setMobileMenuOpen(false);
                  }}
                  size="sm"
                  className="flex-1 h-10 bg-white text-black hover:bg-white/90 font-semibold rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create
                </Button>
              )}
              
              {showCredits && (
                <button
                  onClick={() => {
                    setShowBuyCreditsModal(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08]"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Coins className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-white">{profile?.credits_balance?.toLocaleString() || 0}</span>
                </button>
              )}
            </div>

            {/* User Menu Items */}
            <div className="pt-2 border-t border-white/[0.06] space-y-1">
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.05] transition-all"
              >
                <User className="w-4 h-4" />
                Profile
              </Link>
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.05] transition-all"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <Link
                to="/help"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.05] transition-all"
              >
                <HelpCircle className="w-4 h-4" />
                Help Center
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all"
                >
                  <Shield className="w-4 h-4" />
                  Admin Panel
                </Link>
              )}
              <SignOutDialog>
                <button
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
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
