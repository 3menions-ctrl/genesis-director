import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingNav } from '@/components/landing/LandingNav';

/**
 * Public marketing shell — used for unauthenticated pages like /pricing.
 * Renders ONLY the public landing nav (no sidebar, no account UI, no credits).
 * Critical: this shell must never expose authenticated UI primitives.
 */
export function PublicMarketingShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const handleScroll = (target: string) => {
    // On non-landing routes scroll targets resolve to landing sections.
    navigate(`/#${target}`);
  };

  const handleNavigate = (path: string) => navigate(path);

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground overflow-x-hidden">
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
      </div>
      <LandingNav onScrollToSection={handleScroll} onNavigate={handleNavigate} />
      <main className="relative z-10">{children}</main>
    </div>
  );
}

export default PublicMarketingShell;