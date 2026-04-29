import { useState, useEffect, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeNavigation } from '@/lib/navigation';
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
import { ErrorBoundary } from '@/components/ui/error-boundary';

const SECTIONS = [
  { id: 'account', label: 'Account', icon: User, description: 'Profile & identity', code: '01' },
  { id: 'billing', label: 'Billing & Credits', icon: CreditCard, description: 'Credits & usage', code: '02' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Password & safety', code: '03' },
  { id: 'preferences', label: 'Preferences', icon: SettingsIcon, description: 'Display & defaults', code: '04' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alerts & emails', code: '05' },
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
  const activeIndex = SECTIONS.findIndex((s) => s.id === activeSection);

  return (
    <div className="min-h-screen bg-[hsl(220_14%_2%)] relative overflow-hidden font-body">
      {/* Cinematic atmosphere — matches CinemaLoader / Pipeline */}
      <style>{`
        @keyframes settingsAurora { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes settingsTick { 0%,100%{opacity:.35} 50%{opacity:1} }
      `}</style>
      <div aria-hidden className="fixed inset-0 pointer-events-none z-0">
        {/* deep base */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(220_14%_5%)_0%,hsl(220_14%_2%)_60%)]" />
        {/* conic aurora sweep */}
        <div
          className="absolute -inset-[20%] opacity-[0.16]"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(215,100%,60%,0.32) 60deg, transparent 130deg, hsla(210,100%,55%,0.2) 220deg, transparent 300deg, hsla(215,100%,60%,0.26) 360deg)',
            filter: 'blur(80px)',
            animation: 'settingsAurora 60s linear infinite',
          }}
        />
        {/* hero halo */}
        <div
          className="absolute top-[-180px] left-1/2 -translate-x-1/2 w-[1100px] h-[520px] rounded-full blur-[180px] opacity-60"
          style={{ background: 'radial-gradient(closest-side, hsl(var(--primary) / 0.18), transparent 70%)' }}
        />
        {/* edge vignette */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, hsl(220 14% 1%) 100%)' }} />
        {/* film grain */}
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }}
        />
        {/* top hairline */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <AppHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14">
        {/* Cinematic header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 sm:mb-14"
        >
          <div className="flex items-center gap-3 mb-5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              className="h-9 w-9 rounded-full border border-white/[0.07] bg-white/[0.02] text-white/55 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.16] backdrop-blur-md transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-[hsl(var(--primary))] animate-ping opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
            </span>
            <span className="text-[11px] uppercase tracking-[0.28em] text-white/50 font-medium">
              Apex Studio · Settings
            </span>
          </div>

          <div className="flex items-end justify-between gap-8 flex-wrap">
            <div className="min-w-0 max-w-3xl">
              <h1 className="font-display text-[clamp(2.5rem,6.5vw,5rem)] leading-[0.95] tracking-[-0.035em] font-medium">
                <span className="text-white/95">Studio</span>{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      'linear-gradient(120deg, hsl(212 100% 70%) 0%, hsl(190 100% 70%) 45%, hsl(212 100% 85%) 100%)',
                  }}
                >
                  controls.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-white/55 mt-5 leading-relaxed font-light max-w-xl">
                Account, billing, security and preferences — every system that powers your stories, in one quiet room.
              </p>
            </div>

            {/* Diagnostic ticker — matches loader signature */}
            <div className="hidden md:flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-white/40 font-medium">
              {['Identity', 'Billing', 'Shield'].map((t, i) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span
                    className="w-1 h-1 rounded-full bg-[hsl(var(--primary))]"
                    style={{ animation: `settingsTick 2.4s ease-in-out ${i * 0.4}s infinite` }}
                  />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* hairline */}
          <div className="mt-10 h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Cinematic sidebar */}
          <aside className="hidden lg:block w-[300px] flex-shrink-0">
            <motion.nav
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="sticky top-24 relative rounded-[28px] p-2.5 overflow-hidden"
              style={{
                background:
                  'linear-gradient(180deg, hsla(0,0%,100%,0.025) 0%, hsla(0,0%,100%,0.005) 100%)',
                border: '1px solid hsla(0,0%,100%,0.06)',
                backdropFilter: 'blur(48px) saturate(180%)',
                WebkitBackdropFilter: 'blur(48px) saturate(180%)',
                boxShadow:
                  '0 30px 80px -30px rgba(0,0,0,0.8), inset 0 1px 0 hsla(0,0%,100%,0.05)',
              }}
            >
              {/* sliding aurora indicator */}
              <motion.div
                aria-hidden
                className="absolute left-2.5 right-2.5 rounded-2xl pointer-events-none"
                animate={{ y: activeIndex * 68 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                style={{
                  top: '10px',
                  height: '64px',
                  background:
                    'linear-gradient(180deg, hsla(215,100%,60%,0.18) 0%, hsla(215,100%,55%,0.06) 100%)',
                  border: '1px solid hsla(215,100%,60%,0.22)',
                  boxShadow:
                    '0 0 24px hsla(215,100%,60%,0.32), 0 0 48px hsla(215,100%,60%,0.16), inset 0 1px 0 hsla(0,0%,100%,0.08)',
                }}
              />
              <div className="relative">
                {SECTIONS.map((section) => {
                  const isActive = activeSection === section.id;
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => handleSectionChange(section.id)}
                      className={cn(
                        'w-full h-16 flex items-center gap-3.5 px-3.5 rounded-2xl text-left transition-colors duration-500 relative',
                        isActive ? 'text-white' : 'text-white/55 hover:text-white/85'
                      )}
                    >
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shrink-0',
                          isActive
                            ? 'bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.25)]'
                            : 'bg-white/[0.03] border border-white/[0.06]'
                        )}
                      >
                        <Icon
                          className={cn(
                            'w-4 h-4 transition-all duration-500',
                            isActive
                              ? 'text-[hsl(215,100%,75%)] drop-shadow-[0_0_8px_hsla(215,100%,60%,0.55)]'
                            : 'text-white/45'
                          )}
                          strokeWidth={1.5}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-medium text-[13.5px] tracking-tight truncate">
                          {section.label}
                        </p>
                        <p className="text-[10.5px] uppercase tracking-[0.22em] text-white/30 truncate mt-0.5">
                          {section.description}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'text-[9px] font-medium tabular-nums tracking-[0.18em] transition-colors',
                          isActive ? 'text-[hsl(215,100%,75%)]' : 'text-white/25'
                        )}
                      >
                        {section.code}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* footer hairline */}
              <div className="mx-3 mt-2 mb-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="px-4 py-3 flex items-center justify-between text-[9.5px] uppercase tracking-[0.28em] text-white/30">
                <span>Apex · v1</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[hsl(var(--primary))]" style={{ animation: 'settingsTick 2.4s ease-in-out infinite' }} />
                  Live
                </span>
              </div>
            </motion.nav>
          </aside>

          {/* Mobile Navigation */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/[0.025] border border-white/[0.07] backdrop-blur-2xl transition-all hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-3.5">
                {currentSection && (
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.25)]">
                    <currentSection.icon className="w-4 h-4 text-[hsl(215,100%,75%)]" strokeWidth={1.5} />
                  </div>
                )}
                <div>
                  <span className="font-display font-medium text-white text-sm tracking-tight">{currentSection?.label}</span>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/30 mt-0.5">{currentSection?.description}</p>
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
                  <nav className="mt-2 space-y-1 p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-2xl">
                    {SECTIONS.map((section) => {
                      const isActive = activeSection === section.id;
                      return (
                        <button
                          key={section.id}
                          onClick={() => handleSectionChange(section.id)}
                          className={cn(
                            "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-left transition-all",
                            isActive
                              ? "bg-[hsla(215,100%,60%,0.12)] border border-[hsla(215,100%,60%,0.22)] text-white"
                              : "text-white/50 hover:text-white/80 hover:bg-white/[0.03] border border-transparent"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            isActive ? 'bg-[hsla(215,100%,60%,0.14)] border border-[hsla(215,100%,60%,0.22)]' : 'bg-white/[0.04]'
                          )}>
                            <section.icon className={cn('w-4 h-4', isActive ? 'text-[hsl(215,100%,75%)]' : 'text-white/35')} strokeWidth={1.5} />
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
                initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
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
