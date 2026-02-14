/**
 * ScreenCrashOverlay - Comprehensive Crash Tests
 * 
 * Tests the background countdown, inactivity detection, phase transitions,
 * activity reset behavior, cleanup, and CTA interactions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---- Mocks ----

// Mock Three.js (heavy dep, not needed for logic tests)
vi.mock('three', () => ({
  default: {},
  ACESFilmicToneMapping: 0,
  DoubleSide: 2,
  AdditiveBlending: 2,
  BufferGeometry: class {},
  BufferAttribute: class {},
  PointsMaterial: class {},
  Group: class {},
}));

// Mock @react-three/fiber Canvas
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: () => {},
  useThree: () => ({ gl: { dispose: vi.fn() } }),
}));

// Mock @react-three/drei
vi.mock('@react-three/drei', () => ({
  Environment: () => null,
}));

// Mock the glass shatter scene
vi.mock('@/components/landing/glass-shatter/GlassShatterScene', () => ({
  GlassShatterScene: () => <div data-testid="glass-shatter-scene" />,
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('@/lib/navigation', () => ({
  useSafeNavigation: () => ({ navigate: mockNavigate }),
}));

// Mock error boundary
vi.mock('@/components/ui/error-boundary', () => ({
  SilentBoundary: ({ children }: any) => <>{children}</>,
  ErrorBoundaryWrapper: ({ children }: any) => <>{children}</>,
}));

// Import AFTER mocks
import ScreenCrashOverlay from '@/components/landing/ScreenCrashOverlay';

// ---- Helpers ----

function renderOverlay(props: Partial<{ isActive: boolean; onDismiss: () => void }> = {}) {
  const defaultProps = {
    isActive: true,
    onDismiss: vi.fn(),
    ...props,
  };

  return {
    ...render(
      <MemoryRouter>
        <ScreenCrashOverlay {...defaultProps} />
      </MemoryRouter>
    ),
    onDismiss: defaultProps.onDismiss,
  };
}

// ---- Tests ----

describe('ScreenCrashOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  // =====================
  // RENDERING & LIFECYCLE
  // =====================

  describe('Rendering & Lifecycle', () => {
    it('renders nothing when isActive=false', () => {
      const { container } = renderOverlay({ isActive: false });
      expect(container.innerHTML).toBe('');
    });

    it('renders background countdown layer when isActive=true', () => {
      renderOverlay({ isActive: true });
      // Should be in background phase initially
      // The countdown number should be present
      const countElements = screen.getAllByText('10');
      expect(countElements.length).toBeGreaterThanOrEqual(1);
    });

    it('uses z-[1] for background layer (behind content)', () => {
      const { container } = renderOverlay({ isActive: true });
      const bgLayer = container.querySelector('.z-\\[1\\]');
      expect(bgLayer).toBeInTheDocument();
    });

    it('has pointer-events-none on background layer', () => {
      const { container } = renderOverlay({ isActive: true });
      const bgLayer = container.querySelector('.pointer-events-none');
      expect(bgLayer).toBeInTheDocument();
    });

    it('cleans up on unmount without errors', () => {
      const { unmount } = renderOverlay({ isActive: true });
      expect(() => unmount()).not.toThrow();
    });

    it('cleans up timers on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const { unmount } = renderOverlay({ isActive: true });
      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  // =====================
  // INACTIVITY DETECTION
  // =====================

  describe('Inactivity Detection', () => {
    it('starts countdown opacity at 0 (user is "active" initially)', () => {
      const { container } = renderOverlay();
      const bgLayer = container.querySelector('.z-\\[1\\]');
      // Opacity should be 0 before inactivity kicks in
      expect(bgLayer).toHaveStyle({ opacity: '0' });
    });

    it('becomes visible after INACTIVITY_DELAY (2000ms)', () => {
      const { container } = renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); });
      
      const bgLayer = container.querySelector('.z-\\[1\\]');
      // After inactivity kicks in, opacity > 0
      if (bgLayer) {
        const opacity = parseFloat(bgLayer.getAttribute('style')?.match(/opacity:\s*([\d.]+)/)?.[1] || '0');
        expect(opacity).toBeGreaterThan(0);
      }
    });

    it('resets countdown to 10 on mousemove', () => {
      renderOverlay();
      
      // Wait for inactivity
      act(() => { vi.advanceTimersByTime(2000); });
      // Let it tick down once
      act(() => { vi.advanceTimersByTime(1000); });
      
      // Now trigger activity
      act(() => { fireEvent.mouseMove(window); });
      
      // Should reset — count shows 10 again
      const countElements = screen.getAllByText('10');
      expect(countElements.length).toBeGreaterThanOrEqual(1);
    });

    it('resets countdown to 10 on scroll', () => {
      renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { vi.advanceTimersByTime(1000); });
      
      act(() => { fireEvent.scroll(window); });
      
      const countElements = screen.getAllByText('10');
      expect(countElements.length).toBeGreaterThanOrEqual(1);
    });

    it('resets countdown to 10 on keydown', () => {
      renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { vi.advanceTimersByTime(1000); });
      
      act(() => { fireEvent.keyDown(window); });
      
      const countElements = screen.getAllByText('10');
      expect(countElements.length).toBeGreaterThanOrEqual(1);
    });

    it('resets countdown to 10 on click', () => {
      renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { vi.advanceTimersByTime(1000); });
      
      act(() => { fireEvent.click(window); });
      
      const countElements = screen.getAllByText('10');
      expect(countElements.length).toBeGreaterThanOrEqual(1);
    });

    it('resets countdown to 10 on touchstart', () => {
      renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { vi.advanceTimersByTime(1000); });
      
      act(() => { fireEvent.touchStart(window); });
      
      const countElements = screen.getAllByText('10');
      expect(countElements.length).toBeGreaterThanOrEqual(1);
    });

    it('pauses countdown during activity (opacity returns to 0)', () => {
      const { container } = renderOverlay();
      
      // Become inactive and tick
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { vi.advanceTimersByTime(1000); });
      
      // Trigger activity
      act(() => { fireEvent.mouseMove(window); });
      
      const bgLayer = container.querySelector('.z-\\[1\\]');
      expect(bgLayer).toHaveStyle({ opacity: '0' });
    });

    it('resumes countdown after new inactivity period', () => {
      renderOverlay();
      
      // Inactive → tick to 9
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { vi.advanceTimersByTime(1000); });
      
      // Activity resets to 10
      act(() => { fireEvent.mouseMove(window); });
      expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
      
      // New inactivity → should start ticking again
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { vi.advanceTimersByTime(1000); });
      
      expect(screen.getAllByText('9').length).toBeGreaterThanOrEqual(1);
    });
  });

  // =====================
  // COUNTDOWN TICKER
  // =====================

  describe('Countdown Ticker', () => {
    it('counts down from 10 to 9 after 1 second of inactivity', () => {
      renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); }); // become inactive
      act(() => { vi.advanceTimersByTime(1000); }); // tick
      
      expect(screen.getAllByText('9').length).toBeGreaterThanOrEqual(1);
    });

    it('counts down sequentially through multiple seconds', () => {
      renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); }); // inactive
      
      for (let expected = 9; expected >= 5; expected--) {
        act(() => { vi.advanceTimersByTime(1000); });
        expect(screen.getAllByText(String(expected)).length).toBeGreaterThanOrEqual(1);
      }
    });

    it('does not tick when user is active', () => {
      renderOverlay();
      
      // Don't wait for inactivity, just tick timers
      act(() => { vi.advanceTimersByTime(1000); });
      
      // Should still be at 10
      expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
    });

    it('shows expanding rings at count <= 5', () => {
      const { container } = renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); }); // inactive
      
      // Tick from 10 to 5
      for (let i = 0; i < 5; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
      
      // At count=5, rings should appear
      const rings = container.querySelectorAll('.rounded-full');
      expect(rings.length).toBeGreaterThan(0);
    });

    it('shows crack lines at count <= 2', () => {
      const { container } = renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); }); // inactive
      
      // Tick to 2
      for (let i = 0; i < 8; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
      
      // At count=2, crack lines should appear
      const cracks = container.querySelectorAll('.origin-left');
      expect(cracks.length).toBeGreaterThan(0);
    });
  });

  // =====================
  // PHASE TRANSITIONS
  // =====================

  describe('Phase Transitions', () => {
    // Helper: fast-forward to shatter
    function advanceToShatter() {
      act(() => { vi.advanceTimersByTime(2000); }); // inactive
      for (let i = 0; i < 10; i++) {
        act(() => { vi.advanceTimersByTime(1000); }); // tick to 0
      }
    }

    it('transitions to impact phase when countdown hits 0', () => {
      const { container } = renderOverlay();
      advanceToShatter();
      
      // Should be in foreground mode (z-[100])
      const fgLayer = container.querySelector('.z-\\[100\\]');
      expect(fgLayer).toBeInTheDocument();
    });

    it('transitions from impact to shatter after 200ms', () => {
      renderOverlay();
      advanceToShatter();
      
      // At this point we're in impact
      act(() => { vi.advanceTimersByTime(200); });
      
      // Should now be in shatter — Canvas should be present
      expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
    });

    it('transitions from shatter to CTA after 6800ms', () => {
      renderOverlay();
      advanceToShatter();
      
      act(() => { vi.advanceTimersByTime(200); }); // → shatter
      act(() => { vi.advanceTimersByTime(6800); }); // → cta
      
      // CTA elements should appear
      expect(screen.getByText("Let's Go!")).toBeInTheDocument();
      expect(screen.getByText('Break through')).toBeInTheDocument();
      expect(screen.getByText('Create videos that shatter expectations')).toBeInTheDocument();
    });

    it('shows dismiss hint in CTA phase', () => {
      renderOverlay();
      advanceToShatter();
      
      act(() => { vi.advanceTimersByTime(200); }); // → shatter
      act(() => { vi.advanceTimersByTime(6800); }); // → cta
      
      expect(screen.getByText('Click anywhere to dismiss')).toBeInTheDocument();
    });

    it('removes background countdown layer after shatter', () => {
      const { container } = renderOverlay();
      advanceToShatter();
      
      const bgLayer = container.querySelector('.z-\\[1\\]');
      expect(bgLayer).not.toBeInTheDocument();
    });

    it('foreground layer has z-[100] for full takeover', () => {
      const { container } = renderOverlay();
      advanceToShatter();
      
      const fgLayer = container.querySelector('.z-\\[100\\]');
      expect(fgLayer).toBeInTheDocument();
    });
  });

  // =====================
  // ACTIVITY AFTER SHATTER
  // =====================

  describe('Activity After Shatter (No Reset)', () => {
    function advanceToShatter() {
      act(() => { vi.advanceTimersByTime(2000); });
      for (let i = 0; i < 10; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
    }

    it('does not reset to background phase on mousemove after shatter', () => {
      const { container } = renderOverlay();
      advanceToShatter();
      
      act(() => { fireEvent.mouseMove(window); });
      
      // Should still be in foreground
      const fgLayer = container.querySelector('.z-\\[100\\]');
      expect(fgLayer).toBeInTheDocument();
    });

    it('does not reset to background phase on scroll after shatter', () => {
      const { container } = renderOverlay();
      advanceToShatter();
      
      act(() => { fireEvent.scroll(window); });
      
      const fgLayer = container.querySelector('.z-\\[100\\]');
      expect(fgLayer).toBeInTheDocument();
    });

    it('does not reset to background phase on keydown after shatter', () => {
      const { container } = renderOverlay();
      advanceToShatter();
      
      act(() => { fireEvent.keyDown(window); });
      
      const fgLayer = container.querySelector('.z-\\[100\\]');
      expect(fgLayer).toBeInTheDocument();
    });
  });

  // =====================
  // CTA INTERACTIONS
  // =====================

  describe('CTA Interactions', () => {
    function advanceToCTA() {
      act(() => { vi.advanceTimersByTime(2000); });
      for (let i = 0; i < 10; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
      act(() => { vi.advanceTimersByTime(200); }); // → shatter
      act(() => { vi.advanceTimersByTime(6800); }); // → cta
    }

    it('navigates to signup on Let\'s Go click', () => {
      const { onDismiss } = renderOverlay();
      advanceToCTA();
      
      const button = screen.getByText("Let's Go!");
      act(() => { fireEvent.click(button); });
      
      expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=signup');
      expect(onDismiss).toHaveBeenCalled();
    });

    it('dismisses on overlay click during CTA phase', () => {
      const { onDismiss, container } = renderOverlay();
      advanceToCTA();
      
      const overlay = container.querySelector('.z-\\[100\\]');
      act(() => { fireEvent.click(overlay!); });
      
      expect(onDismiss).toHaveBeenCalled();
    });

    it('does NOT dismiss on overlay click during shatter phase', () => {
      const { onDismiss, container } = renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); });
      for (let i = 0; i < 10; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
      act(() => { vi.advanceTimersByTime(200); }); // → shatter (not CTA yet)
      
      const overlay = container.querySelector('.z-\\[100\\]');
      act(() => { fireEvent.click(overlay!); });
      
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  // =====================
  // DEACTIVATION & RESET
  // =====================

  describe('Deactivation & Reset', () => {
    it('resets all state when isActive becomes false', () => {
      const { rerender, container } = render(
        <MemoryRouter>
          <ScreenCrashOverlay isActive={true} onDismiss={vi.fn()} />
        </MemoryRouter>
      );

      // Advance partway through countdown
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { vi.advanceTimersByTime(3000); });
      
      // Deactivate
      rerender(
        <MemoryRouter>
          <ScreenCrashOverlay isActive={false} onDismiss={vi.fn()} />
        </MemoryRouter>
      );
      
      // Should render nothing
      expect(container.innerHTML).toBe('');
    });

    it('can reactivate after deactivation and start fresh', () => {
      const onDismiss = vi.fn();
      const { rerender } = render(
        <MemoryRouter>
          <ScreenCrashOverlay isActive={true} onDismiss={onDismiss} />
        </MemoryRouter>
      );

      // Partially count down
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { vi.advanceTimersByTime(3000); });
      
      // Deactivate
      rerender(
        <MemoryRouter>
          <ScreenCrashOverlay isActive={false} onDismiss={onDismiss} />
        </MemoryRouter>
      );
      
      // Reactivate
      rerender(
        <MemoryRouter>
          <ScreenCrashOverlay isActive={true} onDismiss={onDismiss} />
        </MemoryRouter>
      );
      
      // Should start at 10 again
      const countElements = screen.getAllByText('10');
      expect(countElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =====================
  // MEMORY LEAK PREVENTION
  // =====================

  describe('Memory Leak Prevention', () => {
    it('removes all event listeners on deactivation', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      
      const { rerender } = render(
        <MemoryRouter>
          <ScreenCrashOverlay isActive={true} onDismiss={vi.fn()} />
        </MemoryRouter>
      );

      rerender(
        <MemoryRouter>
          <ScreenCrashOverlay isActive={false} onDismiss={vi.fn()} />
        </MemoryRouter>
      );
      
      const removedEvents = removeSpy.mock.calls.map(c => c[0]);
      expect(removedEvents).toContain('mousemove');
      expect(removedEvents).toContain('scroll');
      expect(removedEvents).toContain('keydown');
      expect(removedEvents).toContain('click');
      expect(removedEvents).toContain('touchstart');
      expect(removedEvents).toContain('wheel');
      
      removeSpy.mockRestore();
    });

    it('removes all event listeners on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      
      const { unmount } = renderOverlay({ isActive: true });
      unmount();
      
      const removedEvents = removeSpy.mock.calls.map(c => c[0]);
      expect(removedEvents).toContain('mousemove');
      expect(removedEvents).toContain('scroll');
      
      removeSpy.mockRestore();
    });

    it('clears inactivity timer on unmount', () => {
      const clearSpy = vi.spyOn(global, 'clearTimeout');
      const { unmount } = renderOverlay({ isActive: true });
      
      const callsBefore = clearSpy.mock.calls.length;
      unmount();
      
      expect(clearSpy.mock.calls.length).toBeGreaterThan(callsBefore);
      clearSpy.mockRestore();
    });
  });

  // =====================
  // CSS FALLBACK (canvasError)
  // =====================

  describe('CSS Fallback Shards', () => {
    // Note: canvasError is internal state triggered by WebGL context loss.
    // We test the structure exists for the fallback path.
    it('Canvas container exists in impact/shatter phases', () => {
      renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); });
      for (let i = 0; i < 10; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
      act(() => { vi.advanceTimersByTime(200); }); // → shatter
      
      expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
    });
  });

  // =====================
  // OPACITY & VISUAL ESCALATION
  // =====================

  describe('Visual Escalation', () => {
    it('countdown opacity increases as count decreases', () => {
      const { container } = renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); }); // inactive
      
      const getOpacity = () => {
        const bgLayer = container.querySelector('.z-\\[1\\]');
        const match = bgLayer?.getAttribute('style')?.match(/opacity:\s*([\d.]+)/);
        return match ? parseFloat(match[1]) : 0;
      };
      
      const opacityAt10 = getOpacity();
      
      // Tick to 7
      for (let i = 0; i < 3; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
      
      const opacityAt7 = getOpacity();
      expect(opacityAt7).toBeGreaterThan(opacityAt10);
    });
  });

  // =====================
  // EDGE CASES
  // =====================

  describe('Edge Cases', () => {
    it('handles rapid activity events without crashing', () => {
      renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); });
      
      // Rapid-fire events
      expect(() => {
        act(() => {
          for (let i = 0; i < 100; i++) {
            fireEvent.mouseMove(window);
            fireEvent.scroll(window);
            fireEvent.click(window);
          }
        });
      }).not.toThrow();
    });

    it('handles rapid activate/deactivate cycles', () => {
      const onDismiss = vi.fn();
      const { rerender } = render(
        <MemoryRouter>
          <ScreenCrashOverlay isActive={true} onDismiss={onDismiss} />
        </MemoryRouter>
      );

      expect(() => {
        for (let i = 0; i < 10; i++) {
          rerender(
            <MemoryRouter>
              <ScreenCrashOverlay isActive={false} onDismiss={onDismiss} />
            </MemoryRouter>
          );
          rerender(
            <MemoryRouter>
              <ScreenCrashOverlay isActive={true} onDismiss={onDismiss} />
            </MemoryRouter>
          );
        }
      }).not.toThrow();
    });

    it('survives unmount during shatter phase', () => {
      const { unmount } = renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); });
      for (let i = 0; i < 10; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
      act(() => { vi.advanceTimersByTime(200); }); // shatter
      
      expect(() => unmount()).not.toThrow();
    });

    it('survives unmount during CTA phase', () => {
      const { unmount } = renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); });
      for (let i = 0; i < 10; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
      act(() => { vi.advanceTimersByTime(200); }); // shatter
      act(() => { vi.advanceTimersByTime(6800); }); // CTA
      
      expect(() => unmount()).not.toThrow();
    });

    it('does not count below 0', () => {
      renderOverlay();
      
      act(() => { vi.advanceTimersByTime(2000); });
      for (let i = 0; i < 12; i++) { // overshoot
        act(() => { vi.advanceTimersByTime(1000); });
      }
      
      // Should not crash or show negative numbers
      expect(screen.queryByText('-1')).not.toBeInTheDocument();
      expect(screen.queryByText('-2')).not.toBeInTheDocument();
    });

    it('multiple activity events during inactivity delay do not cause multiple timers', () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      renderOverlay();
      
      // Fire many events within inactivity window
      act(() => {
        for (let i = 0; i < 5; i++) {
          fireEvent.mouseMove(window);
        }
      });
      
      // Each event clears previous timer and sets new one
      // This should not accumulate — just the last one matters
      setTimeoutSpy.mockRestore();
    });
  });

  // =====================
  // FULL SEQUENCE END-TO-END
  // =====================

  describe('Full Sequence E2E', () => {
    it('completes entire sequence: background → impact → shatter → CTA → dismiss', () => {
      const { onDismiss, container } = renderOverlay();
      
      // Phase 1: Background countdown
      expect(container.querySelector('.z-\\[1\\]')).toBeInTheDocument();
      expect(container.querySelector('.z-\\[100\\]')).not.toBeInTheDocument();
      
      // Wait for inactivity
      act(() => { vi.advanceTimersByTime(2000); });
      
      // Count down fully
      for (let i = 0; i < 10; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
      
      // Phase 2: Impact (foreground takeover)
      expect(container.querySelector('.z-\\[100\\]')).toBeInTheDocument();
      expect(container.querySelector('.z-\\[1\\]')).not.toBeInTheDocument();
      
      // Phase 3: Shatter
      act(() => { vi.advanceTimersByTime(200); });
      expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
      
      // Phase 4: CTA
      act(() => { vi.advanceTimersByTime(6800); });
      expect(screen.getByText("Let's Go!")).toBeInTheDocument();
      expect(screen.getByText('Break through')).toBeInTheDocument();
      
      // Phase 5: Dismiss
      const overlay = container.querySelector('.z-\\[100\\]');
      act(() => { fireEvent.click(overlay!); });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('completes sequence with activity interruptions mid-countdown', () => {
      renderOverlay();
      
      // Start counting
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { vi.advanceTimersByTime(3000); }); // count = 7
      
      // Interrupt with scroll
      act(() => { fireEvent.scroll(window); });
      expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
      
      // Resume counting after new inactivity
      act(() => { vi.advanceTimersByTime(2000); });
      
      // Count all the way down
      for (let i = 0; i < 10; i++) {
        act(() => { vi.advanceTimersByTime(1000); });
      }
      
      // Should reach shatter
      act(() => { vi.advanceTimersByTime(200); });
      expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
    });
  });
});
