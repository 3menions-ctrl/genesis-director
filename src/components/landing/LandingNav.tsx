import { memo, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/Logo';

const SCROLL_ITEMS = ['Features', 'Pricing', 'FAQ'] as const;

interface NavigationProps {
  onScrollToSection: (target: string) => void;
  onNavigate: (path: string) => void;
  signUpButtonRef?: React.RefObject<HTMLButtonElement>;
}

export const LandingNav = memo(forwardRef<HTMLElement, NavigationProps>(
  function LandingNav({ onScrollToSection, onNavigate, signUpButtonRef }, ref) {
    return (
      <nav
        ref={ref}
        className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12"
      >
        {/* Frosted glass bar */}
        <div className="max-w-7xl mx-auto mt-4 flex items-center justify-between h-14 px-6 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.06] shadow-[0_2px_24px_rgba(0,0,0,0.25)]">
          <Logo size="md" showText textClassName="text-base" />

          <div className="hidden md:flex items-center gap-1">
            {SCROLL_ITEMS.map((item) => (
              <button
                key={item}
                onClick={() => onScrollToSection(item.toLowerCase())}
                className="px-4 py-1.5 text-[13px] text-white/45 hover:text-white rounded-lg hover:bg-white/[0.06] transition-all duration-200 font-medium tracking-wide"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => onNavigate('/auth')}
              className="h-8 px-4 text-[13px] text-white/50 hover:text-white hover:bg-white/[0.06] rounded-lg font-medium"
            >
              Sign in
            </Button>
            <Button
              ref={signUpButtonRef}
              onClick={() => onNavigate('/auth?mode=signup')}
              className="h-8 px-5 text-[13px] font-semibold rounded-lg bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.08)] transition-all duration-300"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>
    );
  }
));

LandingNav.displayName = 'LandingNav';
