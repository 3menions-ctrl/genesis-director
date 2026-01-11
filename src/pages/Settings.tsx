import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/layout/AppHeader';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, CreditCard, Shield, Settings as SettingsIcon, Bell,
  ChevronRight, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { BillingSettings } from '@/components/settings/BillingSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { PreferencesSettings } from '@/components/settings/PreferencesSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';

const SECTIONS = [
  { id: 'account', label: 'Account', icon: User, description: 'Profile, avatar, and personal info' },
  { id: 'billing', label: 'Billing & Credits', icon: CreditCard, description: 'Credits, purchases, and usage' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Password, sessions, and safety' },
  { id: 'preferences', label: 'Preferences', icon: SettingsIcon, description: 'Defaults and display options' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email and alert settings' },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

export default function Settings() {
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[400px] bg-gradient-to-b from-white/[0.015] to-transparent blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-to-tl from-white/[0.01] to-transparent blur-[100px]" />
      </div>

      <AppHeader showCreate={false} />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm text-white/50">Manage your account and preferences</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <nav className="sticky top-24 space-y-1">
              {SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => handleSectionChange(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all",
                      isActive
                        ? "bg-white text-black"
                        : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                    )}
                  >
                    <section.icon className={cn("w-5 h-5", isActive ? "text-black" : "text-white/40")} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{section.label}</p>
                      <p className={cn(
                        "text-xs truncate",
                        isActive ? "text-black/60" : "text-white/30"
                      )}>
                        {section.description}
                      </p>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-black/40" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Mobile Navigation */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.05] border border-white/10"
            >
              <div className="flex items-center gap-3">
                {currentSection && <currentSection.icon className="w-5 h-5 text-white/60" />}
                <span className="font-medium text-white">{currentSection?.label}</span>
              </div>
              <ChevronRight className={cn(
                "w-5 h-5 text-white/40 transition-transform",
                isMobileMenuOpen && "rotate-90"
              )} />
            </button>

            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <nav className="mt-2 space-y-1 p-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    {SECTIONS.map((section) => {
                      const isActive = activeSection === section.id;
                      return (
                        <button
                          key={section.id}
                          onClick={() => handleSectionChange(section.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
                            isActive
                              ? "bg-white/10 text-white"
                              : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                          )}
                        >
                          <section.icon className="w-5 h-5" />
                          <span className="font-medium">{section.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
