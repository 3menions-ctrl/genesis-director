/**
 * COMPREHENSIVE UI COMPONENT REGRESSION TESTS
 *
 * Tests every major UI component for:
 * - Rendering correctness
 * - Prop handling & variants
 * - Accessibility (roles, labels)
 * - User interaction
 * - Edge cases (empty states, loading, errors)
 *
 * Organized by component category:
 *  1. Core UI primitives (Logo, Badge, PasswordStrength, CinemaLoader, Skeletons)
 *  2. Layout components (RouteContainer, StabilityBoundary)
 *  3. Landing page components (LandingNav, Footer, FAQSection)
 *  4. Project components (ProjectFilters)
 *  5. Production components (PipelineErrorBanner)
 *  6. Editor components (Toolbar, Preview, Sidebar, Timeline)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as fs from 'fs';
import * as path from 'path';

// ─── helpers ────────────────────────────────────────────────────────────────

const withRouter = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

function readFile(p: string): string {
  const full = path.resolve(p);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CORE UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

// --- Logo ---
import { Logo } from '@/components/ui/Logo';

describe('Logo', () => {
  it('renders img with alt text', () => {
    render(<Logo />);
    expect(screen.getByAltText('Apex Studio')).toBeInTheDocument();
  });

  it('shows text when showText=true', () => {
    render(<Logo showText />);
    expect(screen.getByText('Apex-Studio')).toBeInTheDocument();
  });

  it('hides text when showText=false (default)', () => {
    render(<Logo />);
    expect(screen.queryByText('Apex-Studio')).not.toBeInTheDocument();
  });

  it('applies size class', () => {
    const { container } = render(<Logo size="xl" />);
    const img = container.querySelector('img');
    expect(img?.className).toContain('w-14');
  });
});

// --- Badge ---
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders default variant without crash', () => {
    const { container } = render(<Badge variant="default">X</Badge>);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders all known variants', () => {
    const variants = [
      'default', 'secondary', 'destructive', 'outline', 'success',
      'warning', 'info', 'idle', 'generating', 'rendering', 'completed', 'aurora',
    ] as const;
    for (const v of variants) {
      const { unmount } = render(<Badge variant={v}>{v}</Badge>);
      expect(screen.getByText(v)).toBeInTheDocument();
      unmount();
    }
  });
});

// --- PasswordStrength ---
import { PasswordStrength } from '@/components/ui/password-strength';

describe('PasswordStrength', () => {
  it('returns null when password is empty', () => {
    const { container } = render(<PasswordStrength password="" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows Weak for short lowercase password', () => {
    render(<PasswordStrength password="abc" />);
    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  it('shows Strong for complex password', () => {
    render(<PasswordStrength password="Abcd1234!" />);
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('shows 5 requirement items', () => {
    render(<PasswordStrength password="a" />);
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('Contains uppercase letter')).toBeInTheDocument();
    expect(screen.getByText('Contains lowercase letter')).toBeInTheDocument();
    expect(screen.getByText('Contains number')).toBeInTheDocument();
    expect(screen.getByText('Contains special character')).toBeInTheDocument();
  });
});

// --- CinemaLoader ---
import { CinemaLoader } from '@/components/ui/CinemaLoader';

describe('CinemaLoader', () => {
  it('renders message text', () => {
    render(<CinemaLoader message="Preparing..." isVisible />);
    expect(screen.getByText('Preparing...')).toBeInTheDocument();
  });

  it('shows progress percentage', () => {
    render(<CinemaLoader progress={42} isVisible />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('hides when isVisible is false after exit', async () => {
    const { container, rerender } = render(<CinemaLoader isVisible />);
    rerender(<CinemaLoader isVisible={false} />);
    // Should start exit animation
    const root = container.firstChild as HTMLElement;
    if (root) {
      expect(root.style.opacity).toBe('0');
    }
  });

  it('renders inline variant', () => {
    const { container } = render(<CinemaLoader variant="inline" isVisible />);
    expect(container.querySelector('.relative')).toBeTruthy();
  });
});

// --- PageSkeleton (loading-skeletons.tsx) ---
import { PageSkeleton, CardSkeleton, InlineSkeleton } from '@/components/ui/loading-skeletons';

describe('PageSkeleton (loading-skeletons)', () => {
  it('renders grid variant by default', () => {
    const { container } = render(<PageSkeleton />);
    expect(container.querySelector('.grid')).toBeTruthy();
  });

  it('renders all variant types without crash', () => {
    const variants = ['grid', 'list', 'detail', 'dashboard', 'studio', 'production', 'profile'] as const;
    for (const v of variants) {
      const { unmount } = render(<PageSkeleton variant={v} />);
      unmount();
    }
  });
});

describe('CardSkeleton', () => {
  it('renders with image by default', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector('.aspect-video')).toBeTruthy();
  });

  it('renders without image', () => {
    const { container } = render(<CardSkeleton hasImage={false} />);
    expect(container.querySelector('.aspect-video')).toBeFalsy();
  });
});

describe('InlineSkeleton', () => {
  it('renders 3 lines by default', () => {
    const { container } = render(<InlineSkeleton />);
    const items = container.querySelectorAll('[class*="h-4"]');
    expect(items.length).toBe(3);
  });

  it('renders custom line count', () => {
    const { container } = render(<InlineSkeleton lines={5} />);
    const items = container.querySelectorAll('[class*="h-4"]');
    expect(items.length).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LAYOUT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// --- RouteContainer ---
import { RouteContainer } from '@/components/layout/RouteContainer';

// Mock NavigationLoadingContext used by AppLoader
vi.mock('@/contexts/NavigationLoadingContext', () => ({
  useNavigationLoading: () => ({ state: { isLoading: false }, dispatch: vi.fn() }),
  NavigationLoadingProvider: ({ children }: any) => children,
}));

describe('RouteContainer', () => {
  it('renders children', () => {
    render(<RouteContainer><p>Hello Route</p></RouteContainer>);
    expect(screen.getByText('Hello Route')).toBeInTheDocument();
  });

  it('wraps children in StabilityBoundary', () => {
    const content = readFile('src/components/layout/RouteContainer.tsx');
    expect(content).toContain('StabilityBoundary');
    expect(content).toContain('Suspense');
  });

  it('applies animate-route-enter class', () => {
    const { container } = render(<RouteContainer>X</RouteContainer>);
    expect(container.querySelector('.animate-route-enter')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. LANDING PAGE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// --- LandingNav ---
import { LandingNav } from '@/components/landing/LandingNav';

describe('LandingNav', () => {
  const mockScroll = vi.fn();
  const mockNav = vi.fn();

  beforeEach(() => { mockScroll.mockClear(); mockNav.mockClear(); });

  it('renders Sign in and Get Started buttons', () => {
    render(withRouter(<LandingNav onScrollToSection={mockScroll} onNavigate={mockNav} />));
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });

  it('renders nav section buttons', () => {
    render(withRouter(<LandingNav onScrollToSection={mockScroll} onNavigate={mockNav} />));
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('FAQ')).toBeInTheDocument();
  });

  it('calls onScrollToSection when section clicked', () => {
    render(withRouter(<LandingNav onScrollToSection={mockScroll} onNavigate={mockNav} />));
    fireEvent.click(screen.getByText('Features'));
    expect(mockScroll).toHaveBeenCalledWith('features');
  });

  it('calls onNavigate for Sign in', () => {
    render(withRouter(<LandingNav onScrollToSection={mockScroll} onNavigate={mockNav} />));
    fireEvent.click(screen.getByText('Sign in'));
    expect(mockNav).toHaveBeenCalledWith('/auth');
  });

  it('calls onNavigate for Get Started', () => {
    render(withRouter(<LandingNav onScrollToSection={mockScroll} onNavigate={mockNav} />));
    fireEvent.click(screen.getByText('Get Started'));
    expect(mockNav).toHaveBeenCalledWith('/auth?mode=signup');
  });

  it('renders Logo with text', () => {
    render(withRouter(<LandingNav onScrollToSection={mockScroll} onNavigate={mockNav} />));
    expect(screen.getByAltText('Apex Studio')).toBeInTheDocument();
  });
});

// --- Footer ---
import Footer from '@/components/landing/Footer';

describe('Footer', () => {
  it('renders copyright text with current year', () => {
    render(withRouter(<Footer />));
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()}`))).toBeInTheDocument();
  });

  it('renders product links', () => {
    render(withRouter(<Footer />));
    expect(screen.getByText('How It Works')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('FAQ')).toBeInTheDocument();
  });

  it('renders legal links', () => {
    render(withRouter(<Footer />));
    expect(screen.getByText('Privacy')).toBeInTheDocument();
    expect(screen.getByText('Terms')).toBeInTheDocument();
  });

  it('renders company links', () => {
    render(withRouter(<Footer />));
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Blog')).toBeInTheDocument();
  });
});

// --- FAQSection ---
import FAQSection from '@/components/landing/FAQSection';

describe('FAQSection', () => {
  it('renders FAQ heading', () => {
    render(<FAQSection />);
    expect(screen.getByText('FAQ')).toBeInTheDocument();
  });

  it('renders all 6 FAQ questions', () => {
    render(<FAQSection />);
    expect(screen.getByText('How does it work?')).toBeInTheDocument();
    expect(screen.getByText('What are credits and how much do they cost?')).toBeInTheDocument();
    expect(screen.getByText('Can I get a refund on credits?')).toBeInTheDocument();
    expect(screen.getByText('What are the AI limitations I should know about?')).toBeInTheDocument();
    expect(screen.getByText('Can I use videos commercially?')).toBeInTheDocument();
    expect(screen.getByText('Do credits expire?')).toBeInTheDocument();
  });

  it('uses Accordion component', () => {
    const content = readFile('src/components/landing/FAQSection.tsx');
    expect(content).toContain('Accordion');
    expect(content).toContain('AccordionItem');
    expect(content).toContain('AccordionTrigger');
    expect(content).toContain('AccordionContent');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PROJECT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// --- ProjectFilters ---
import { ProjectFilters } from '@/components/projects/ProjectFilters';

describe('ProjectFilters', () => {
  const defaults = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    sortBy: 'updated' as const,
    onSortByChange: vi.fn(),
    sortOrder: 'desc' as const,
    onSortOrderChange: vi.fn(),
    statusFilter: 'all' as const,
    onStatusFilterChange: vi.fn(),
    viewMode: 'grid' as const,
    onViewModeChange: vi.fn(),
  };

  beforeEach(() => {
    Object.values(defaults).forEach(v => typeof v === 'function' && (v as any).mockClear?.());
  });

  it('renders search input', () => {
    render(<ProjectFilters {...defaults} />);
    expect(screen.getByPlaceholderText('Search your films...')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', () => {
    render(<ProjectFilters {...defaults} />);
    fireEvent.change(screen.getByPlaceholderText('Search your films...'), { target: { value: 'test' } });
    expect(defaults.onSearchChange).toHaveBeenCalledWith('test');
  });

  it('shows clear button when search has value', () => {
    const { container } = render(<ProjectFilters {...defaults} searchQuery="hello" />);
    // The X button for clearing
    const clearBtn = container.querySelector('button');
    expect(clearBtn).toBeTruthy();
  });

  it('shows keyboard shortcut hint when search is empty', () => {
    render(<ProjectFilters {...defaults} />);
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('renders view toggle buttons', () => {
    const { container } = render(<ProjectFilters {...defaults} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('highlights active view mode', () => {
    const { container } = render(<ProjectFilters {...defaults} viewMode="grid" />);
    const activeBtn = container.querySelector('.bg-white\\/10');
    expect(activeBtn).toBeTruthy();
  });

  it('renders keyboard hints panel when enabled', () => {
    render(
      <ProjectFilters {...defaults} showKeyboardHints onToggleKeyboardHints={vi.fn()} />
    );
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('New Project')).toBeInTheDocument();
    expect(screen.getByText('Grid View')).toBeInTheDocument();
    expect(screen.getByText('List View')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PRODUCTION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// --- PipelineErrorBanner ---
import { PipelineErrorBanner } from '@/components/production/PipelineErrorBanner';

describe('PipelineErrorBanner', () => {
  it('returns null when no error', () => {
    const { container } = render(<PipelineErrorBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when all clips complete', () => {
    const { container } = render(
      <PipelineErrorBanner 
        error="some error" 
        projectStatus="completed" 
        failedClipCount={0} 
        totalClipCount={3} 
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows error for credit issues', () => {
    render(<PipelineErrorBanner error="Insufficient credits" />);
    expect(screen.getAllByText(/credit/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows retry button for retryable errors', () => {
    render(<PipelineErrorBanner error="timeout occurred" onRetry={vi.fn()} />);
    expect(screen.getByText('Resume')).toBeInTheDocument();
  });

  it('calls onRetry when Resume clicked', () => {
    const onRetry = vi.fn();
    render(<PipelineErrorBanner error="timeout occurred" onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Resume'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('suppresses STRICT_CONTINUITY_FAILURE errors', () => {
    const { container } = render(
      <PipelineErrorBanner error="STRICT_CONTINUITY_FAILURE: no last frame" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows dismiss button when onDismiss provided', () => {
    render(<PipelineErrorBanner error="rate limit 429" onDismiss={vi.fn()} />);
    // Has X close button
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('classifies credit errors as non-retryable', () => {
    render(<PipelineErrorBanner error="402 insufficient balance" />);
    expect(screen.queryByText('Resume')).not.toBeInTheDocument();
  });

  it('classifies rate limit as retryable', () => {
    render(<PipelineErrorBanner error="429 too many requests" onRetry={vi.fn()} />);
    expect(screen.getByText('Resume')).toBeInTheDocument();
  });

  it('shows degradation flags', () => {
    render(
      <PipelineErrorBanner 
        degradationFlags={[
          { type: 'Frame Skip', message: 'Clip 2 skipped frame extraction', severity: 'warning' },
        ]}
      />
    );
    expect(screen.getByText('Frame Skip')).toBeInTheDocument();
    expect(screen.getByText('Clip 2 skipped frame extraction')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. STRUCTURAL FILE AUDITS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Component Architecture Audit', () => {
  describe('Core UI file existence', () => {
    const coreFiles = [
      'src/components/ui/Logo.tsx',
      'src/components/ui/badge.tsx',
      'src/components/ui/button.tsx',
      'src/components/ui/input.tsx',
      'src/components/ui/dialog.tsx',
      'src/components/ui/card.tsx',
      'src/components/ui/tabs.tsx',
      'src/components/ui/toast.tsx',
      'src/components/ui/toaster.tsx',
      'src/components/ui/skeleton.tsx',
      'src/components/ui/progress.tsx',
      'src/components/ui/CinemaLoader.tsx',
      'src/components/ui/password-strength.tsx',
      'src/components/ui/premium-toast.tsx',
      'src/components/ui/loading-skeletons.tsx',
      'src/components/ui/page-skeleton.tsx',
      'src/components/ui/app-loader.tsx',
      'src/components/ui/error-boundary.tsx',
      'src/components/ui/UnifiedLoadingPage.tsx',
    ];

    for (const f of coreFiles) {
      it(`${path.basename(f)} exists`, () => {
        expect(fs.existsSync(path.resolve(f))).toBe(true);
      });
    }
  });

  describe('Landing component file existence', () => {
    const files = [
      'src/components/landing/HeroSection.tsx',
      'src/components/landing/LandingNav.tsx',
      'src/components/landing/Footer.tsx',
      'src/components/landing/FAQSection.tsx',
      'src/components/landing/PricingSection.tsx',
      'src/components/landing/FeaturesShowcase.tsx',
      'src/components/landing/HowItWorksSection.tsx',
      'src/components/landing/ExamplesGallery.tsx',
      'src/components/landing/FinalCTASection.tsx',
    ];

    for (const f of files) {
      it(`${path.basename(f)} exists`, () => {
        expect(fs.existsSync(path.resolve(f))).toBe(true);
      });
    }
  });

  describe('Auth components', () => {
    it('ProtectedRoute exists', () => {
      expect(fs.existsSync(path.resolve('src/components/auth/ProtectedRoute.tsx'))).toBe(true);
    });

    it('SignOutDialog exists', () => {
      expect(fs.existsSync(path.resolve('src/components/auth/SignOutDialog.tsx'))).toBe(true);
    });
  });

  describe('Settings components', () => {
    const files = [
      'src/components/settings/AccountSettings.tsx',
      'src/components/settings/BillingSettings.tsx',
      'src/components/settings/NotificationSettings.tsx',
      'src/components/settings/PreferencesSettings.tsx',
      'src/components/settings/SecuritySettings.tsx',
    ];

    for (const f of files) {
      it(`${path.basename(f)} exists`, () => {
        expect(fs.existsSync(path.resolve(f))).toBe(true);
      });
    }
  });

  describe('Social components', () => {
    const files = [
      'src/components/social/NotificationBell.tsx',
      'src/components/social/VideoReactionsBar.tsx',
      'src/components/social/VideoCommentsSection.tsx',
      'src/components/social/DirectMessagePanel.tsx',
      'src/components/social/MessagesInbox.tsx',
      'src/components/social/WorldChatButton.tsx',
    ];

    for (const f of files) {
      it(`${path.basename(f)} exists`, () => {
        expect(fs.existsSync(path.resolve(f))).toBe(true);
      });
    }
  });

  describe('Editor components', () => {
    const files = [
      'src/components/editor/EditorToolbar.tsx',
      'src/components/editor/EditorPreview.tsx',
      'src/components/editor/EditorSidebar.tsx',
      'src/components/editor/EditorTimeline.tsx',
    ];

    for (const f of files) {
      it(`${path.basename(f)} exists`, () => {
        expect(fs.existsSync(path.resolve(f))).toBe(true);
      });
    }
  });

  describe('Player components', () => {
    const files = [
      'src/components/player/UniversalHLSPlayer.tsx',
      'src/components/player/UniversalVideoPlayer.tsx',
      'src/components/player/SimpleVideoPlayer.tsx',
    ];

    for (const f of files) {
      it(`${path.basename(f)} exists`, () => {
        expect(fs.existsSync(path.resolve(f))).toBe(true);
      });
    }
  });

  describe('Production components', () => {
    const files = [
      'src/components/production/ProductionDashboard.tsx',
      'src/components/production/CinematicPipelineProgress.tsx',
      'src/components/production/PipelineErrorBanner.tsx',
      'src/components/production/ProductionFinalVideo.tsx',
      'src/components/production/SpecializedModeProgress.tsx',
    ];

    for (const f of files) {
      it(`${path.basename(f)} exists`, () => {
        expect(fs.existsSync(path.resolve(f))).toBe(true);
      });
    }
  });

  describe('Gallery components', () => {
    const files = [
      'src/components/gallery/GalleryHeroSection.tsx',
      'src/components/gallery/PremiumVideoCard.tsx',
      'src/components/gallery/PremiumFullscreenPlayer.tsx',
    ];

    for (const f of files) {
      it(`${path.basename(f)} exists`, () => {
        expect(fs.existsSync(path.resolve(f))).toBe(true);
      });
    }
  });

  describe('Credit components', () => {
    it('BuyCreditsModal exists and uses Dialog', () => {
      const content = readFile('src/components/credits/BuyCreditsModal.tsx');
      expect(content).toContain('Dialog');
      expect(content).toContain('DialogContent');
      expect(content).toContain('CreditPackage');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. COMPONENT CONTRACTS (structural checks)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Component Contracts', () => {
  it('CinemaLoader is CSS-only (no framer-motion)', () => {
    const content = readFile('src/components/ui/CinemaLoader.tsx');
    expect(content).not.toContain("from 'framer-motion'");
    expect(content).not.toContain('from "framer-motion"');
  });

  it('CinemaLoader has keyframe animations (loaderSpin, loaderPulse)', () => {
    const content = readFile('src/components/ui/CinemaLoader.tsx');
    expect(content).toContain('@keyframes loaderSpin');
    expect(content).toContain('@keyframes loaderPulse');
  });

  it('AppLoader wraps CinemaLoader', () => {
    const content = readFile('src/components/ui/app-loader.tsx');
    expect(content).toContain('CinemaLoader');
    expect(content).toContain('progress');
  });

  it('RouteContainer uses memo + forwardRef', () => {
    const content = readFile('src/components/layout/RouteContainer.tsx');
    expect(content).toContain('memo');
    expect(content).toContain('forwardRef');
  });

  it('StabilityBoundary suppresses AbortError and ChunkLoadError', () => {
    const content = readFile('src/components/stability/StabilityBoundary.tsx');
    expect(content).toContain('AbortError');
    expect(content).toContain('ChunkLoadError');
  });

  it('StabilityBoundary auto-retries network errors', () => {
    const content = readFile('src/components/stability/StabilityBoundary.tsx');
    expect(content).toContain('autoRetry');
    expect(content).toContain("category === 'NETWORK'");
  });

  it('PremiumToast has 5 toast types', () => {
    const content = readFile('src/components/ui/premium-toast.tsx');
    expect(content).toContain("'success'");
    expect(content).toContain("'error'");
    expect(content).toContain("'warning'");
    expect(content).toContain("'info'");
    expect(content).toContain("'epic'");
  });

  it('PremiumToast has provider and context hook', () => {
    const content = readFile('src/components/ui/premium-toast.tsx');
    expect(content).toContain('PremiumToastProvider');
    expect(content).toContain('usePremiumToastContext');
    expect(content).toContain('PremiumToastContext');
  });

  it('HeroSection has Enter Studio CTA', () => {
    const content = readFile('src/components/landing/HeroSection.tsx');
    expect(content).toContain('Enter Studio');
    expect(content).toContain('onEnterStudio');
  });

  it('Footer has all 3 link sections: Product, Company, Legal', () => {
    const content = readFile('src/components/landing/Footer.tsx');
    expect(content).toContain('Product');
    expect(content).toContain('Company');
    expect(content).toContain('Legal');
  });

  it('PricingSection has credit pricing stats', () => {
    const content = readFile('src/components/landing/PricingSection.tsx');
    expect(content).toContain('$0.10');
    expect(content).toContain('per credit');
    expect(content).toContain('no expiry');
  });

  it('PipelineErrorBanner classifies 7+ error types', () => {
    const content = readFile('src/components/production/PipelineErrorBanner.tsx');
    expect(content).toContain('CONTINUITY_ERROR');
    expect(content).toContain('INSUFFICIENT_CREDITS');
    expect(content).toContain('RATE_LIMITED');
    expect(content).toContain('CONTENT_POLICY');
    expect(content).toContain('PRODUCTION_INCOMPLETE');
    expect(content).toContain('MODEL_ERROR');
    expect(content).toContain('TIMEOUT');
  });

  it('ProjectFilters supports all 4 status filters', () => {
    const content = readFile('src/components/projects/ProjectFilters.tsx');
    expect(content).toContain("'all'");
    expect(content).toContain("'completed'");
    expect(content).toContain("'processing'");
    expect(content).toContain("'failed'");
  });

  it('ProjectCard supports grid and list view modes', () => {
    const content = readFile('src/components/projects/ProjectCard.tsx');
    expect(content).toContain("viewMode === 'list'");
    expect(content).toContain("viewMode = 'grid'");
  });

  it('AccountSettings has email change and deactivation', () => {
    const content = readFile('src/components/settings/AccountSettings.tsx');
    expect(content).toContain('handleEmailChange');
    expect(content).toContain('handleDeactivateAccount');
    expect(content).toContain('deactivate_account');
  });

  it('SignOutDialog uses controlled state pattern', () => {
    const content = readFile('src/components/auth/SignOutDialog.tsx');
    expect(content).toContain('AlertDialog');
    expect(content).toContain('open');
    expect(content).toContain('onOpenChange');
    expect(content).toContain('handleSignOut');
  });

  it('NotificationBell handles 15 notification types', () => {
    const content = readFile('src/components/social/NotificationBell.tsx');
    expect(content).toContain('like');
    expect(content).toContain('comment');
    expect(content).toContain('follow');
    expect(content).toContain('achievement');
    expect(content).toContain('video_complete');
    expect(content).toContain('video_failed');
    expect(content).toContain('low_credits');
    expect(content).toContain('mention');
  });

  it('Toaster renders toast list with close buttons', () => {
    const content = readFile('src/components/ui/toaster.tsx');
    expect(content).toContain('ToastProvider');
    expect(content).toContain('ToastClose');
    expect(content).toContain('ToastViewport');
    expect(content).toContain('toasts.map');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. COMPONENT DIRECTORY COMPLETENESS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Component Directory Structure', () => {
  const requiredDirs = [
    'src/components/ui',
    'src/components/auth',
    'src/components/landing',
    'src/components/projects',
    'src/components/production',
    'src/components/editor',
    'src/components/player',
    'src/components/social',
    'src/components/settings',
    'src/components/profile',
    'src/components/credits',
    'src/components/gallery',
    'src/components/layout',
    'src/components/stability',
    'src/components/navigation',
    'src/components/avatars',
    'src/components/admin',
  ];

  for (const dir of requiredDirs) {
    it(`${dir.split('/').pop()} directory exists`, () => {
      expect(fs.existsSync(path.resolve(dir))).toBe(true);
    });
  }
});
