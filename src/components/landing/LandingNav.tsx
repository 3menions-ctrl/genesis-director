import { memo, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/Logo';

const NAV_ITEMS = ['Features', 'Pricing', 'FAQ'] as const;

interface NavigationProps {
  onScrollToSection: (target: string) => void;
  onNavigate: (path: string) => void;
  signUpButtonRef?: React.RefObject<HTMLButtonElement>;
}

export const LandingNav = memo(forwardRef<HTMLElement, NavigationProps>(
  function LandingNav({ onScrollToSection, onNavigate, signUpButtonRef }, ref) {
    return (
      <nav ref={ref} className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-12 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="md" showText textClassName="text-base" />

          <div className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) => (
              <button 
                key={item}
                onClick={() => onScrollToSection(item.toLowerCase())}
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => onNavigate('/auth')}
              className="h-9 px-4 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-full"
            >
              Sign in
            </Button>
            <Button
              ref={signUpButtonRef}
              onClick={() => onNavigate('/auth?mode=signup')}
              className="h-9 px-5 text-sm font-medium rounded-full bg-white text-black hover:bg-white/90"
            >
              Start Free
            </Button>
          </div>
        </div>
      </nav>
    );
  }
));

LandingNav.displayName = 'LandingNav';
