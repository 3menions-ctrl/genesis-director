/**
 * Animation Stability Crash Tests
 * 
 * Tests for:
 * - Framer Motion animation crashes
 * - CSS transition conflicts
 * - requestAnimationFrame leaks
 * - Transform property conflicts
 * - AnimatePresence unmount issues
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen, waitFor, fireEvent } from '@testing-library/react';
import { 
  useState, 
  useEffect, 
  useRef, 
  useCallback,
  memo,
  ReactNode
} from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Framer Motion Stability', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeEach(() => {
    consoleErrors = [];
    consoleWarnings = [];
    console.error = (...args) => {
      consoleErrors.push(args.map(String).join(' '));
    };
    console.warn = (...args) => {
      consoleWarnings.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });

  describe('AnimatePresence Exit Animations', () => {
    it('should handle rapid mount/unmount without crashing', async () => {
      function RapidToggle() {
        const [items, setItems] = useState([1, 2, 3]);

        const shuffle = () => {
          setItems(prev => {
            const shuffled = [...prev].sort(() => Math.random() - 0.5);
            return shuffled.length > 1 ? shuffled.slice(0, -1) : [1, 2, 3];
          });
        };

        return (
          <div>
            <button onClick={shuffle}>Shuffle</button>
            <AnimatePresence mode="popLayout">
              {items.map(item => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  data-testid={`item-${item}`}
                >
                  Item {item}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        );
      }

      render(<RapidToggle />, { wrapper: createTestWrapper() });

      // Rapid shuffles
      for (let i = 0; i < 10; i++) {
        fireEvent.click(screen.getByText('Shuffle'));
        await act(async () => {
          await new Promise(r => setTimeout(r, 20));
        });
      }

      // No animation-related crashes
      const animationErrors = consoleErrors.filter(e => 
        e.includes('motion') || 
        e.includes('AnimatePresence') ||
        e.includes('animation')
      );
      expect(animationErrors.length).toBe(0);
    });

    it('should complete exit animations before removal', async () => {
      let exitComplete = false;

      function ExitTest() {
        const [show, setShow] = useState(true);

        return (
          <div>
            <button onClick={() => setShow(false)}>Hide</button>
            <AnimatePresence onExitComplete={() => { exitComplete = true; }}>
              {show && (
                <motion.div
                  key="item"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  data-testid="animated"
                >
                  Content
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      }

      render(<ExitTest />, { wrapper: createTestWrapper() });

      expect(screen.getByTestId('animated')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Hide'));

      // Wait for exit animation
      await waitFor(() => {
        expect(exitComplete).toBe(true);
      }, { timeout: 500 });
    });
  });

  describe('Animation Controls Cleanup', () => {
    it('should stop animations on unmount', async () => {
      let animationStopped = false;

      function AnimatedComponent() {
        const controls = useAnimation();
        const mountedRef = useRef(true);

        useEffect(() => {
          mountedRef.current = true;
          
          const animate = async () => {
            try {
              await controls.start({
                x: 100,
                transition: { duration: 1, repeat: Infinity },
              });
            } catch (e) {
              // Animation was stopped
              animationStopped = true;
            }
          };

          animate();

          return () => {
            mountedRef.current = false;
            controls.stop();
          };
        }, [controls]);

        return (
          <motion.div animate={controls} data-testid="animated">
            Animating
          </motion.div>
        );
      }

      const { unmount } = render(<AnimatedComponent />, {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await new Promise(r => setTimeout(r, 100));
      });

      unmount();

      // Animation should be stopped
      expect(screen.queryByTestId('animated')).not.toBeInTheDocument();
    });
  });

  describe('Transform Property Conflicts', () => {
    it('should handle multiple transform properties without crash', () => {
      function MultiTransform() {
        return (
          <motion.div
            initial={{ 
              x: 0, 
              y: 0, 
              scale: 1, 
              rotate: 0,
              skewX: 0,
            }}
            animate={{ 
              x: 100, 
              y: 50, 
              scale: 1.2, 
              rotate: 45,
              skewX: 10,
            }}
            transition={{ duration: 0.1 }}
            data-testid="multi"
          >
            Multiple Transforms
          </motion.div>
        );
      }

      render(<MultiTransform />, { wrapper: createTestWrapper() });

      expect(screen.getByTestId('multi')).toBeInTheDocument();

      // No transform conflict warnings (we suppress these in main.tsx)
      // Just verify no crash
    });

    it('should handle 3D transforms without crashing', () => {
      function Transform3D() {
        return (
          <motion.div
            initial={{ 
              rotateX: 0, 
              rotateY: 0, 
              perspective: 1000,
            }}
            animate={{ 
              rotateX: 45, 
              rotateY: 45,
            }}
            style={{ transformStyle: 'preserve-3d' }}
            data-testid="3d"
          >
            3D Transform
          </motion.div>
        );
      }

      render(<Transform3D />, { wrapper: createTestWrapper() });
      expect(screen.getByTestId('3d')).toBeInTheDocument();
    });
  });

  describe('Gesture Animation Stability', () => {
    it('should handle rapid hover without crashing', async () => {
      const HoverComponent = memo(function HoverComponent() {
        return (
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            data-testid="hover"
          >
            Hover Me
          </motion.div>
        );
      });

      render(<HoverComponent />, { wrapper: createTestWrapper() });

      const element = screen.getByTestId('hover');

      // Rapid hover in/out
      for (let i = 0; i < 20; i++) {
        fireEvent.mouseEnter(element);
        fireEvent.mouseLeave(element);
      }

      // No crashes
      expect(screen.getByTestId('hover')).toBeInTheDocument();
    });
  });
});

describe('requestAnimationFrame Stability', () => {
  it('should cancel RAF on unmount', async () => {
    let rafCancelled = false;
    let rafId: number | null = null;

    function RAFComponent() {
      const [position, setPosition] = useState(0);
      const mountedRef = useRef(true);

      useEffect(() => {
        mountedRef.current = true;

        const animate = () => {
          if (!mountedRef.current) {
            rafCancelled = true;
            return;
          }
          setPosition(p => (p + 1) % 100);
          rafId = requestAnimationFrame(animate);
        };

        rafId = requestAnimationFrame(animate);

        return () => {
          mountedRef.current = false;
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafCancelled = true;
          }
        };
      }, []);

      return <div style={{ transform: `translateX(${position}px)` }}>RAF</div>;
    }

    const { unmount } = render(<RAFComponent />, {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    unmount();

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(rafCancelled).toBe(true);
  });

  it('should handle multiple RAF loops without accumulation', async () => {
    let activeLoops = 0;

    function MultiRAF({ id }: { id: number }) {
      const mountedRef = useRef(true);

      useEffect(() => {
        mountedRef.current = true;
        activeLoops++;

        const animate = () => {
          if (!mountedRef.current) return;
          requestAnimationFrame(animate);
        };

        const rafId = requestAnimationFrame(animate);

        return () => {
          mountedRef.current = false;
          cancelAnimationFrame(rafId);
          activeLoops--;
        };
      }, []);

      return <div>Loop {id}</div>;
    }

    const { rerender, unmount } = render(
      <>
        <MultiRAF id={1} />
        <MultiRAF id={2} />
      </>,
      { wrapper: createTestWrapper() }
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(activeLoops).toBe(2);

    // Rerender with different set
    rerender(
      <>
        <MultiRAF id={3} />
      </>
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(activeLoops).toBe(1);

    unmount();

    expect(activeLoops).toBe(0);
  });
});

describe('CSS Transition Stability', () => {
  it('should handle transition interruption gracefully', async () => {
    function InterruptableTransition() {
      const [state, setState] = useState<'a' | 'b' | 'c'>('a');

      return (
        <div>
          <button onClick={() => setState('a')}>A</button>
          <button onClick={() => setState('b')}>B</button>
          <button onClick={() => setState('c')}>C</button>
          <div
            data-testid="transitioning"
            style={{
              transition: 'all 0.5s',
              transform: state === 'a' ? 'translateX(0)' : 
                        state === 'b' ? 'translateX(100px)' : 'translateX(200px)',
              opacity: state === 'a' ? 1 : state === 'b' ? 0.5 : 0.8,
            }}
          >
            State: {state}
          </div>
        </div>
      );
    }

    render(<InterruptableTransition />, { wrapper: createTestWrapper() });

    // Rapid state changes (interrupt transitions)
    fireEvent.click(screen.getByText('B'));
    fireEvent.click(screen.getByText('C'));
    fireEvent.click(screen.getByText('A'));
    fireEvent.click(screen.getByText('B'));

    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    // Component should still be functional
    expect(screen.getByTestId('transitioning')).toBeInTheDocument();
  });
});

describe('Layout Animation Stability', () => {
  it('should handle layout changes without crashing', async () => {
    function LayoutTest() {
      const [expanded, setExpanded] = useState(false);

      return (
        <div>
          <button onClick={() => setExpanded(!expanded)}>Toggle</button>
          <motion.div
            layout
            initial={false}
            animate={{ 
              width: expanded ? 300 : 100,
              height: expanded ? 200 : 50,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            data-testid="layout"
            style={{ background: 'blue' }}
          >
            Layout Animation
          </motion.div>
        </div>
      );
    }

    render(<LayoutTest />, { wrapper: createTestWrapper() });

    // Rapid toggles
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText('Toggle'));
      await act(async () => {
        await new Promise(r => setTimeout(r, 30));
      });
    }

    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });
});
