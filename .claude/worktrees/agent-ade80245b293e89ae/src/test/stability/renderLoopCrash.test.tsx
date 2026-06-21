/**
 * Render Loop / Infinite Re-render Crash Tests
 * 
 * Tests for detecting and preventing:
 * - Infinite re-render loops
 * - useEffect dependency array issues
 * - State updates during render
 * - useMemo/useCallback missing dependencies
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen, waitFor } from '@testing-library/react';
import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Infinite Render Loop Prevention', () => {
  let consoleErrors: string[] = [];
  let renderCount = 0;
  const originalError = console.error;

  beforeEach(() => {
    consoleErrors = [];
    renderCount = 0;
    console.error = (...args) => {
      consoleErrors.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    console.error = originalError;
  });

  describe('Object Reference Stability', () => {
    it('should NOT re-render infinitely when passing object props', () => {
      // WRONG: Creates new object on every render
      // function Parent() {
      //   const config = { theme: 'dark' }; // New reference each render!
      //   return <Child config={config} />;
      // }

      // CORRECT: Memoize object props
      function Parent() {
        const config = useMemo(() => ({ theme: 'dark' }), []);
        return <Child config={config} />;
      }

      const Child = memo(function Child({ config }: { config: { theme: string } }) {
        renderCount++;
        if (renderCount > 10) {
          throw new Error('Infinite render loop detected!');
        }
        return <div>Theme: {config.theme}</div>;
      });

      render(<Parent />, { wrapper: createTestWrapper() });

      // Should only render once (or twice in StrictMode)
      expect(renderCount).toBeLessThanOrEqual(2);
    });

    it('should NOT re-render infinitely with array props', () => {
      function Parent() {
        // CORRECT: Stable array reference
        const items = useMemo(() => ['a', 'b', 'c'], []);
        return <Child items={items} />;
      }

      const Child = memo(function Child({ items }: { items: string[] }) {
        renderCount++;
        if (renderCount > 10) {
          throw new Error('Infinite render loop detected!');
        }
        return <div>Items: {items.join(', ')}</div>;
      });

      render(<Parent />, { wrapper: createTestWrapper() });
      expect(renderCount).toBeLessThanOrEqual(2);
    });

    it('should NOT re-render infinitely with callback props', () => {
      function Parent() {
        const [count, setCount] = useState(0);
        
        // CORRECT: Stable callback reference
        const handleClick = useCallback(() => {
          setCount(c => c + 1);
        }, []);

        return (
          <div>
            <span data-testid="count">{count}</span>
            <Child onClick={handleClick} />
          </div>
        );
      }

      const Child = memo(function Child({ onClick }: { onClick: () => void }) {
        renderCount++;
        if (renderCount > 10) {
          throw new Error('Infinite render loop detected!');
        }
        return <button onClick={onClick}>Click</button>;
      });

      render(<Parent />, { wrapper: createTestWrapper() });
      expect(renderCount).toBeLessThanOrEqual(2);
    });
  });

  describe('useEffect Dependency Issues', () => {
    it('should NOT trigger infinite loop from state set in effect', () => {
      function BrokenPattern() {
        const [data, setData] = useState<{ id: number } | null>(null);
        const effectRunCount = useRef(0);

        useEffect(() => {
          effectRunCount.current++;
          if (effectRunCount.current > 20) {
            throw new Error('Infinite effect loop!');
          }
          
          // WRONG pattern that would cause loop:
          // setData({ id: 1 }); // New object reference every time
          
          // CORRECT: Only set if actually different
          setData(prev => {
            if (prev?.id === 1) return prev;
            return { id: 1 };
          });
        }, []); // Empty deps = run once

        return <div>{data?.id}</div>;
      }

      render(<BrokenPattern />, { wrapper: createTestWrapper() });
      // Test passes if no infinite loop error
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should handle complex object dependencies correctly', async () => {
      function ComplexDepsComponent({ 
        options 
      }: { 
        options: { page: number; limit: number } 
      }) {
        const [data, setData] = useState<string | null>(null);
        const effectCount = useRef(0);

        // Destructure to primitives for stable deps
        const { page, limit } = options;

        useEffect(() => {
          effectCount.current++;
          if (effectCount.current > 10) {
            throw new Error('Too many effect runs!');
          }
          
          setData(`Page ${page}, Limit ${limit}`);
        }, [page, limit]); // Primitive deps are stable

        return <div data-testid="data">{data}</div>;
      }

      const { rerender } = render(
        <ComplexDepsComponent options={{ page: 1, limit: 10 }} />,
        { wrapper: createTestWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('Page 1, Limit 10');
      });

      // Same values, different object reference - should NOT re-run effect
      rerender(<ComplexDepsComponent options={{ page: 1, limit: 10 }} />);
      
      // Values change - should re-run effect
      rerender(<ComplexDepsComponent options={{ page: 2, limit: 10 }} />);

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('Page 2, Limit 10');
      });
    });

    it('should prevent fetch loop with proper cleanup', async () => {
      function FetchComponent({ id }: { id: string }) {
        const [data, setData] = useState<string | null>(null);
        const [loading, setLoading] = useState(true);
        const fetchCount = useRef(0);

        useEffect(() => {
          let cancelled = false;
          fetchCount.current++;
          
          if (fetchCount.current > 5) {
            throw new Error('Fetch loop detected!');
          }

          setLoading(true);
          
          // Simulate fetch
          const timeout = setTimeout(() => {
            if (!cancelled) {
              setData(`Data for ${id}`);
              setLoading(false);
            }
          }, 50);

          return () => {
            cancelled = true;
            clearTimeout(timeout);
          };
        }, [id]); // Only re-fetch when id changes

        if (loading) return <div>Loading...</div>;
        return <div data-testid="data">{data}</div>;
      }

      const { rerender } = render(
        <FetchComponent id="1" />,
        { wrapper: createTestWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('Data for 1');
      });

      // Different id = new fetch
      rerender(<FetchComponent id="2" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('Data for 2');
      });
    });
  });

  describe('State Updates During Render', () => {
    it('should NOT update state during render phase', () => {
      function BadRenderUpdate() {
        const [count, setCount] = useState(0);
        const [derived, setDerived] = useState(0);

        // WRONG: State update during render
        // if (count > derived) {
        //   setDerived(count); // This causes a warning/error
        // }

        // CORRECT: Use useMemo for derived state
        const correctDerived = useMemo(() => count * 2, [count]);

        // Or use useEffect for side effects
        useEffect(() => {
          setDerived(count);
        }, [count]);

        return (
          <div>
            <span data-testid="count">{count}</span>
            <span data-testid="derived">{correctDerived}</span>
          </div>
        );
      }

      render(<BadRenderUpdate />, { wrapper: createTestWrapper() });

      // No "Cannot update component while rendering" errors
      const renderErrors = consoleErrors.filter(e => 
        e.includes('Cannot update') || 
        e.includes('during rendering')
      );
      expect(renderErrors.length).toBe(0);
    });
  });

  describe('Memo Dependency Stability', () => {
    it('should handle useMemo with object creation', () => {
      function MemoComponent({ filter }: { filter: string }) {
        const [items] = useState(['apple', 'banana', 'cherry']);

        // CORRECT: Memoize expensive computation
        const filteredItems = useMemo(() => {
          renderCount++;
          if (renderCount > 10) {
            throw new Error('Memo recalculating too often!');
          }
          return items.filter(i => i.includes(filter));
        }, [items, filter]);

        return (
          <ul>
            {filteredItems.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        );
      }

      const { rerender } = render(
        <MemoComponent filter="a" />,
        { wrapper: createTestWrapper() }
      );

      // Same filter = no recalculation
      rerender(<MemoComponent filter="a" />);
      rerender(<MemoComponent filter="a" />);
      
      // Different filter = recalculation
      rerender(<MemoComponent filter="b" />);

      // Should not have excessive recalculations
      expect(renderCount).toBeLessThan(10);
    });
  });
});

describe('Animation Frame Stability', () => {
  it('should cleanup requestAnimationFrame on unmount', async () => {
    let animationFrameCount = 0;
    const maxFrames = 50;

    function AnimationComponent() {
      const [position, setPosition] = useState(0);
      const frameRef = useRef<number | null>(null);
      const mountedRef = useRef(true);

      useEffect(() => {
        mountedRef.current = true;
        
        const animate = () => {
          animationFrameCount++;
          
          if (animationFrameCount > maxFrames) {
            throw new Error('Animation not cleaned up!');
          }
          
          if (mountedRef.current) {
            setPosition(p => (p + 1) % 100);
            frameRef.current = requestAnimationFrame(animate);
          }
        };

        frameRef.current = requestAnimationFrame(animate);

        return () => {
          mountedRef.current = false;
          if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
          }
        };
      }, []);

      return <div style={{ transform: `translateX(${position}px)` }}>Moving</div>;
    }

    const { unmount } = render(<AnimationComponent />, {
      wrapper: createTestWrapper(),
    });

    // Let some frames run
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    // Unmount should stop animation
    unmount();

    const framesAtUnmount = animationFrameCount;

    // Wait and verify no more frames
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    // Animation should have stopped at unmount
    expect(animationFrameCount).toBe(framesAtUnmount);
  });
});

describe('Timer Cleanup Stability', () => {
  it('should cleanup setInterval on unmount', async () => {
    let intervalTicks = 0;

    function IntervalComponent() {
      const [count, setCount] = useState(0);

      useEffect(() => {
        const interval = setInterval(() => {
          intervalTicks++;
          if (intervalTicks > 100) {
            throw new Error('Interval not cleaned up!');
          }
          setCount(c => c + 1);
        }, 10);

        return () => clearInterval(interval);
      }, []);

      return <div>Count: {count}</div>;
    }

    const { unmount } = render(<IntervalComponent />, {
      wrapper: createTestWrapper(),
    });

    // Let some ticks happen
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    const ticksAtUnmount = intervalTicks;
    unmount();

    // Wait and verify no more ticks
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(intervalTicks).toBe(ticksAtUnmount);
  });

  it('should cleanup setTimeout chains on unmount', async () => {
    let timeoutCount = 0;

    function TimeoutChainComponent() {
      const [count, setCount] = useState(0);
      const mountedRef = useRef(true);

      useEffect(() => {
        mountedRef.current = true;
        
        const scheduleNext = () => {
          timeoutCount++;
          if (timeoutCount > 100) {
            throw new Error('Timeout chain not cleaned up!');
          }
          
          if (mountedRef.current) {
            setCount(c => c + 1);
            setTimeout(scheduleNext, 10);
          }
        };

        const id = setTimeout(scheduleNext, 10);

        return () => {
          mountedRef.current = false;
          clearTimeout(id);
        };
      }, []);

      return <div>Count: {count}</div>;
    }

    const { unmount } = render(<TimeoutChainComponent />, {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    const countAtUnmount = timeoutCount;
    unmount();

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Should have stopped near unmount
    expect(timeoutCount).toBeLessThanOrEqual(countAtUnmount + 1);
  });
});

describe('Subscription Cleanup Stability', () => {
  it('should cleanup event listeners on unmount', () => {
    const listeners: Function[] = [];
    const originalAdd = window.addEventListener;
    const originalRemove = window.removeEventListener;

    window.addEventListener = vi.fn((event, handler) => {
      listeners.push(handler as Function);
      originalAdd.call(window, event, handler as EventListener);
    });

    window.removeEventListener = vi.fn((event, handler) => {
      const idx = listeners.indexOf(handler as Function);
      if (idx !== -1) listeners.splice(idx, 1);
      originalRemove.call(window, event, handler as EventListener);
    });

    function EventListenerComponent() {
      const [windowWidth, setWindowWidth] = useState(window.innerWidth);

      useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
      }, []);

      return <div>Width: {windowWidth}</div>;
    }

    const { unmount } = render(<EventListenerComponent />, {
      wrapper: createTestWrapper(),
    });

    const listenersBeforeUnmount = listeners.length;
    
    unmount();

    // Listener should be removed
    expect(listeners.length).toBeLessThan(listenersBeforeUnmount);

    // Restore
    window.addEventListener = originalAdd;
    window.removeEventListener = originalRemove;
  });
});
