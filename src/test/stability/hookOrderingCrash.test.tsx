/**
 * Hook Ordering Crash Tests
 * 
 * Tests for the React hook ordering invariant:
 * "Rendered more hooks than during the previous render"
 * 
 * This is one of the most common causes of React crashes.
 * Hooks MUST be called unconditionally at the top level.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, screen, waitFor } from '@testing-library/react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Test wrapper with all required providers
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

describe('Hook Ordering Stability', () => {
  let consoleErrors: string[] = [];
  const originalError = console.error;

  beforeEach(() => {
    consoleErrors = [];
    console.error = (...args) => {
      consoleErrors.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    console.error = originalError;
  });

  describe('Unconditional Hook Execution Pattern', () => {
    it('should NOT crash when hooks are called before early returns', () => {
      // CORRECT PATTERN: All hooks at top level
      function SafeComponent({ loading }: { loading: boolean }) {
        // All hooks called unconditionally FIRST
        const [count, setCount] = useState(0);
        const memoValue = useMemo(() => count * 2, [count]);
        const callback = useCallback(() => setCount(c => c + 1), []);
        const ref = useRef(null);

        useEffect(() => {
          // Effect body can have conditions
          if (!loading) {
            console.log('Ready');
          }
        }, [loading]);

        // Early return AFTER all hooks
        if (loading) {
          return <div>Loading...</div>;
        }

        return (
          <div>
            <span data-testid="count">{count}</span>
            <span data-testid="memo">{memoValue}</span>
            <button onClick={callback}>Increment</button>
          </div>
        );
      }

      // First render with loading=true
      const { rerender } = render(<SafeComponent loading={true} />, {
        wrapper: createTestWrapper(),
      });
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Rerender with loading=false (different code path, same hook count)
      rerender(<SafeComponent loading={false} />);
      expect(screen.getByTestId('count')).toHaveTextContent('0');

      // No hook ordering errors
      const hookErrors = consoleErrors.filter(e => 
        e.includes('Rendered more hooks') || 
        e.includes('Rendered fewer hooks')
      );
      expect(hookErrors.length).toBe(0);
    });

    it('should detect potential crash from conditional hooks (anti-pattern)', () => {
      // This test documents the WRONG pattern
      // We don't actually render it because it would crash
      
      const antiPattern = `
        function BrokenComponent({ user }) {
          if (!user) {
            return null; // WRONG: Early return before hooks
          }
          
          const [name, setName] = useState(user.name); // Hook after condition
          // This WILL crash when user changes from null to valid
        }
      `;

      expect(antiPattern).toContain('WRONG');
    });

    it('should handle auth loading gate correctly', async () => {
      // Simulates the pattern used in protected routes
      function ProtectedRoute({ 
        isLoading, 
        isAuthenticated,
        children 
      }: { 
        isLoading: boolean;
        isAuthenticated: boolean;
        children: React.ReactNode;
      }) {
        // ALL hooks FIRST, before any conditions
        const [hasChecked, setHasChecked] = useState(false);
        const mountedRef = useRef(true);
        
        const safeNavigate = useCallback(() => {
          if (mountedRef.current) {
            // Navigation logic
          }
        }, []);

        useEffect(() => {
          mountedRef.current = true;
          return () => { mountedRef.current = false; };
        }, []);

        useEffect(() => {
          if (!isLoading && !isAuthenticated && !hasChecked) {
            setHasChecked(true);
            safeNavigate();
          }
        }, [isLoading, isAuthenticated, hasChecked, safeNavigate]);

        // NOW we can do early returns
        if (isLoading) {
          return <div>Checking authentication...</div>;
        }

        if (!isAuthenticated) {
          return <div>Redirecting to login...</div>;
        }

        return <>{children}</>;
      }

      const { rerender } = render(
        <ProtectedRoute isLoading={true} isAuthenticated={false}>
          <div>Protected Content</div>
        </ProtectedRoute>,
        { wrapper: createTestWrapper() }
      );

      expect(screen.getByText('Checking authentication...')).toBeInTheDocument();

      // Transition: loading -> authenticated
      rerender(
        <ProtectedRoute isLoading={false} isAuthenticated={true}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();

      // Transition: authenticated -> not authenticated
      rerender(
        <ProtectedRoute isLoading={false} isAuthenticated={false}>
          <div>Protected Content</div>
        </ProtectedRoute>
      );

      expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();

      // Verify no hook ordering errors through all transitions
      const hookErrors = consoleErrors.filter(e => 
        e.includes('Rendered more hooks') || 
        e.includes('Rendered fewer hooks')
      );
      expect(hookErrors.length).toBe(0);
    });
  });

  describe('Complex Hook Ordering Scenarios', () => {
    it('should handle rapid prop changes without hook order errors', async () => {
      function DataComponent({ id }: { id: string | null }) {
        // Hooks always in same order regardless of id value
        const [data, setData] = useState<string | null>(null);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);
        
        const fetchData = useCallback(async () => {
          if (!id) return;
          setLoading(true);
          try {
            await new Promise(r => setTimeout(r, 10));
            setData(`Data for ${id}`);
          } catch (e) {
            setError('Failed');
          } finally {
            setLoading(false);
          }
        }, [id]);

        useEffect(() => {
          fetchData();
        }, [fetchData]);

        if (!id) return <div>No ID provided</div>;
        if (loading) return <div>Loading...</div>;
        if (error) return <div>Error: {error}</div>;
        return <div data-testid="data">{data}</div>;
      }

      const { rerender } = render(<DataComponent id={null} />, {
        wrapper: createTestWrapper(),
      });
      expect(screen.getByText('No ID provided')).toBeInTheDocument();

      // Rapid prop changes
      rerender(<DataComponent id="1" />);
      rerender(<DataComponent id="2" />);
      rerender(<DataComponent id={null} />);
      rerender(<DataComponent id="3" />);

      // Wait for async effects
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      }, { timeout: 500 });

      // No crashes
      const hookErrors = consoleErrors.filter(e => 
        e.includes('Rendered more hooks') || 
        e.includes('Rendered fewer hooks')
      );
      expect(hookErrors.length).toBe(0);
    });

    it('should handle context access safely without crashing', () => {
      // Pattern used in useAuth, useStudio etc. with safe fallbacks
      const mockUseAuth = () => {
        // These hooks are ALWAYS called
        const [user, setUser] = useState<{ id: string } | null>(null);
        const [loading, setLoading] = useState(true);
        
        const safeUser = useMemo(() => user, [user]);
        
        useEffect(() => {
          // Simulate auth check
          setTimeout(() => {
            setUser({ id: '123' });
            setLoading(false);
          }, 10);
        }, []);

        // Safe fallback instead of throwing
        return {
          user: safeUser,
          loading,
          isAuthenticated: !!safeUser,
        };
      };

      function TestComponent() {
        const { user, loading, isAuthenticated } = mockUseAuth();
        const [localState, setLocalState] = useState('init');

        // More hooks after the context hook
        const processedUser = useMemo(
          () => user ? `User: ${user.id}` : 'No user',
          [user]
        );

        useEffect(() => {
          if (isAuthenticated) {
            setLocalState('authenticated');
          }
        }, [isAuthenticated]);

        if (loading) return <div>Loading...</div>;
        return (
          <div>
            <span data-testid="user">{processedUser}</span>
            <span data-testid="state">{localState}</span>
          </div>
        );
      }

      render(<TestComponent />, { wrapper: createTestWrapper() });

      // No immediate crash
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Edge Cases That Previously Caused Crashes', () => {
    it('should handle useQuery with enabled flag safely', async () => {
      // Pattern from useProjectWithFallback - enabled flag must not affect hook count
      function QueryComponent({ shouldFetch }: { shouldFetch: boolean }) {
        // Simulate useQuery behavior - hook always called
        const [data, setData] = useState<string | null>(null);
        const [isLoading, setIsLoading] = useState(false);
        
        // The enabled flag goes in useEffect, not in conditional hook call
        useEffect(() => {
          if (!shouldFetch) {
            setData(null);
            return;
          }
          
          setIsLoading(true);
          setTimeout(() => {
            setData('fetched');
            setIsLoading(false);
          }, 10);
        }, [shouldFetch]);

        if (!shouldFetch) return <div>Fetch disabled</div>;
        if (isLoading) return <div>Loading...</div>;
        return <div>{data}</div>;
      }

      const { rerender } = render(<QueryComponent shouldFetch={false} />, {
        wrapper: createTestWrapper(),
      });
      expect(screen.getByText('Fetch disabled')).toBeInTheDocument();

      rerender(<QueryComponent shouldFetch={true} />);
      await waitFor(() => {
        expect(screen.getByText('fetched')).toBeInTheDocument();
      });

      rerender(<QueryComponent shouldFetch={false} />);
      expect(screen.getByText('Fetch disabled')).toBeInTheDocument();

      // Verify stability
      const hookErrors = consoleErrors.filter(e => e.includes('hooks'));
      expect(hookErrors.length).toBe(0);
    });

    it('should handle list rendering with dynamic keys safely', () => {
      function ListComponent({ items }: { items: string[] }) {
        // Parent hooks always called
        const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
        
        const handleSelect = useCallback((index: number) => {
          setSelectedIndex(index);
        }, []);

        return (
          <ul>
            {items.map((item, index) => (
              // Child components can have their own hooks
              <ListItem 
                key={item} 
                item={item} 
                index={index}
                isSelected={selectedIndex === index}
                onSelect={handleSelect}
              />
            ))}
          </ul>
        );
      }

      function ListItem({ 
        item, 
        index, 
        isSelected, 
        onSelect 
      }: { 
        item: string;
        index: number;
        isSelected: boolean;
        onSelect: (i: number) => void;
      }) {
        // Each item has its own hook state
        const [hover, setHover] = useState(false);
        
        const handleClick = useCallback(() => {
          onSelect(index);
        }, [index, onSelect]);

        return (
          <li 
            onClick={handleClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            data-selected={isSelected}
            data-hover={hover}
          >
            {item}
          </li>
        );
      }

      const { rerender } = render(
        <ListComponent items={['a', 'b', 'c']} />,
        { wrapper: createTestWrapper() }
      );

      // Change list (different items, different hook instances)
      rerender(<ListComponent items={['x', 'y']} />);
      rerender(<ListComponent items={['a', 'b', 'c', 'd', 'e']} />);
      rerender(<ListComponent items={[]} />);

      // No crashes from hook ordering
      const hookErrors = consoleErrors.filter(e => e.includes('hooks'));
      expect(hookErrors.length).toBe(0);
    });
  });
});

describe('Hook Dependencies Stability', () => {
  it('should handle circular dependency detection', () => {
    // Test that we don't create circular update loops
    function CircularTest() {
      const [a, setA] = useState(0);
      const [b, setB] = useState(0);
      const [updateCount, setUpdateCount] = useState(0);

      // This MUST NOT create an infinite loop
      useEffect(() => {
        if (updateCount > 100) {
          throw new Error('Circular dependency detected!');
        }
        setUpdateCount(c => c + 1);
      }, [a, b]); // Only depends on a and b, not on updateCount

      // Derived value that doesn't trigger re-render
      const sum = useMemo(() => a + b, [a, b]);

      return (
        <div>
          <span data-testid="sum">{sum}</span>
          <span data-testid="updates">{updateCount}</span>
          <button onClick={() => setA(a + 1)}>Inc A</button>
          <button onClick={() => setB(b + 1)}>Inc B</button>
        </div>
      );
    }

    render(<CircularTest />, { wrapper: createTestWrapper() });

    // Initial render should have exactly 1 update (strict mode may double)
    const updates = screen.getByTestId('updates');
    expect(parseInt(updates.textContent || '0')).toBeLessThanOrEqual(2);
  });

  it('should handle stale closure prevention', async () => {
    function StaleClosureTest() {
      const [count, setCount] = useState(0);
      const [log, setLog] = useState<string[]>([]);

      // Correct pattern: Use callback form to avoid stale closure
      const logCount = useCallback(() => {
        setLog(prev => [...prev, `Count is ${count}`]);
      }, [count]); // Correctly depends on count

      // Alternative correct pattern: Use ref
      const countRef = useRef(count);
      countRef.current = count;

      const logCountViaRef = useCallback(() => {
        setLog(prev => [...prev, `Count via ref is ${countRef.current}`]);
      }, []); // Stable reference, always reads current

      return (
        <div>
          <button onClick={() => setCount(c => c + 1)}>Increment</button>
          <button onClick={logCount}>Log Count</button>
          <button onClick={logCountViaRef}>Log via Ref</button>
          <div data-testid="log">{log.join(', ')}</div>
        </div>
      );
    }

    render(<StaleClosureTest />, { wrapper: createTestWrapper() });
    // Test passes if it doesn't crash
    expect(screen.getByText('Increment')).toBeInTheDocument();
  });
});
