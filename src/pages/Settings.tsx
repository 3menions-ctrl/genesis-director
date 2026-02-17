import { useState, useEffect, memo, forwardRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSafeNavigation } from '@/lib/navigation';
import { AppHeader } from '@/components/layout/AppHeader';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, CreditCard, Shield, Settings as SettingsIcon, Bell,
  ChevronRight, ArrowLeft, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { BillingSettings } from '@/components/settings/BillingSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { PreferencesSettings } from '@/components/settings/PreferencesSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { ErrorBoundary } from '@/components/ui/error-boundary';

const SECTIONS = [
  { id: 'account', label: 'Account', icon: User, description: 'Profile & personal info', gradient: 'from-violet-500/20 to-purple-500/20', iconColor: 'text-violet-400' },
  { id: 'billing', label: 'Billing & Credits', icon: CreditCard, description: 'Credits & usage', gradient: 'from-amber-500/20 to-orange-500/20', iconColor: 'text-amber-400' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Password & safety', gradient: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-400' },
  { id: 'preferences', label: 'Preferences', icon: SettingsIcon, description: 'Display & defaults', gradient: 'from-cyan-500/20 to-blue-500/20', iconColor: 'text-cyan-400' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alerts & emails', gradient: 'from-rose-500/20 to-pink-500/20', iconColor: 'text-rose-400' },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

const SettingsContent = memo(function SettingsContent() {
  const { navigate } = useSafeNavigation();
  const { user, loading } = useAuth();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<SectionId>(() => {
    const section = searchParams.get('section') as SectionId;
    return SECTIONS.find(s => s.id === section)?.id || 'account';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSectionChange = (sectionId: SectionId) => {
    setActiveSection(sectionId);
    setSearchParams({ section: sectionId });
    setIsMobileMenuOpen(false);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSettings />;
      case 'billing':
        return <BillingSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'preferences':
        return <PreferencesSettings />;
      case 'notifications':
        return <NotificationSettings />;
      default:
        return <AccountSettings />;
    }
  };

  const currentSection = SECTIONS.find(s => s.id === activeSection);

  return (
    <div className="min-h-screen bg-[#06060a] relative overflow-hidden">
      {/* Premium Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[10%] w-[700px] h-[700px] bg-violet-600/[0.04] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[5%] w-[500px] h-[500px] bg-purple-600/[0.03] rounded-full blur-[120px]" />
        <div className="absolute top-[40%] right-[30%] w-[300px] h-[300px] bg-cyan-500/[0.02] rounded-full blur-[100px]" />
        {/* Subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
      </div>

      <AppHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Premium Page Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8 sm:mb-10"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="h-11 w-11 rounded-2xl border border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.15] backdrop-blur-sm transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Settings</h1>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
                <Sparkles className="w-3 h-3 text-violet-400" />
                <span className="text-[10px] font-semibold text-violet-300 uppercase tracking-wider">Studio</span>
              </div>
            </div>
            <p className="text-sm text-white/30 mt-1">Manage your account, billing, and preferences</p>
          </div>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Premium Sidebar Navigation - Desktop */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <motion.nav 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="sticky top-24 space-y-1.5 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm"
            >
              {SECTIONS.map((section, i) => {
                const isActive = activeSection === section.id;
                return (
                  <motion.button
                    key={section.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    onClick={() => handleSectionChange(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-left transition-all duration-300 group relative overflow-hidden",
                      isActive
                        ? "bg-gradient-to-r from-violet-500/15 to-purple-500/10 border border-violet-500/20 shadow-[0_0_20px_-5px_rgba(139,92,246,0.15)]"
                        : "text-white/50 hover:text-white/80 hover:bg-white/[0.03] border border-transparent"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-violet-400" />
                    )}
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                      isActive
                        ? `bg-gradient-to-br ${section.gradient}`
                        : "bg-white/[0.04]"
                    )}>
                      <section.icon className={cn(
                        "w-4.5 h-4.5 transition-colors",
                        isActive ? section.iconColor : "text-white/30"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium text-sm truncate transition-colors",
                        isActive ? "text-white" : "text-white/60 group-hover:text-white/80"
                      )}>{section.label}</p>
                      <p className={cn(
                        "text-[11px] truncate transition-colors",
                        isActive ? "text-violet-300/60" : "text-white/20"
                      )}>
                        {section.description}
                      </p>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-violet-400/60" />}
                  </motion.button>
                );
              })}
            </motion.nav>
          </aside>

          {/* Mobile Navigation - Premium Dropdown */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm transition-all hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-3.5">
                {currentSection && (
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br", currentSection.gradient)}>
                    <currentSection.icon className={cn("w-4.5 h-4.5", currentSection.iconColor)} />
                  </div>
                )}
                <div>
                  <span className="font-semibold text-white text-sm">{currentSection?.label}</span>
                  <p className="text-[11px] text-white/30">{currentSection?.description}</p>
                </div>
              </div>
              <ChevronRight className={cn(
                "w-5 h-5 text-white/30 transition-transform duration-200",
                isMobileMenuOpen && "rotate-90"
              )} />
            </button>

            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <nav className="mt-2 space-y-1 p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
                    {SECTIONS.map((section) => {
                      const isActive = activeSection === section.id;
                      return (
                        <button
                          key={section.id}
                          onClick={() => handleSectionChange(section.id)}
                          className={cn(
                            "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-left transition-all",
                            isActive
                              ? "bg-violet-500/10 border border-violet-500/20 text-white"
                              : "text-white/50 hover:text-white/80 hover:bg-white/[0.03] border border-transparent"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            isActive ? `bg-gradient-to-br ${section.gradient}` : "bg-white/[0.04]"
                          )}>
                            <section.icon className={cn("w-4 h-4", isActive ? section.iconColor : "text-white/30")} />
                          </div>
                          <span className="font-medium text-sm">{section.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
});

export default function Settings() {
  return (
    <ErrorBoundary>
      <SettingsContent />
    </ErrorBoundary>
  );
}
