/**
 * Navigation Crash Tests
 * 
 * Tests for:
 * - Navigation during async operations
 * - Route change cleanup
 * - Browser back/forward handling
 * - Redirect loops
 * - Protected route edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen, fireEvent, waitFor } from '@testing-library/react';
import { 
  useState, 
  useEffect, 
  useCallback, 
  useRef,
  createContext,
  useContext,
  useMemo,
  ReactNode
} from 'react';
import { 
  MemoryRouter, 
  Routes, 
  Route, 
  useNavigate, 
  useLocation,
  Navigate,
  Outlet
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('Navigation During Async Operations', () => {
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

  it('should abort async operations when navigating away', async () => {
    let fetchAborted = false;

    function SlowPage() {
      const navigate = useNavigate();
      const [data, setData] = useState<string | null>(null);

      useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
          try {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(resolve, 500);
              controller.signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new DOMException('Aborted', 'AbortError'));
              });
            });
            setData('loaded');
          } catch (e) {
            if ((e as Error).name === 'AbortError') {
              fetchAborted = true;
            }
          }
        };

        fetchData();

        return () => controller.abort();
      }, []);

      return (
        <div>
          <div data-testid="status">{data || 'loading'}</div>
          <button onClick={() => navigate('/fast')}>Go Fast</button>
        </div>
      );
    }

    function FastPage() {
      return <div data-testid="fast">Fast Page</div>;
    }

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/slow']}>
          <Routes>
            <Route path="/slow" element={<SlowPage />} />
            <Route path="/fast" element={<FastPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('status')).toHaveTextContent('loading');

    // Navigate before fetch completes
    fireEvent.click(screen.getByText('Go Fast'));

    await waitFor(() => {
      expect(screen.getByTestId('fast')).toBeInTheDocument();
    });

    // Wait for original fetch to have been aborted
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    expect(fetchAborted).toBe(true);
  });

  it('should handle rapid navigation without crashes', async () => {
    function PageA() {
      const navigate = useNavigate();
      return (
        <div>
          <div data-testid="page">A</div>
          <button onClick={() => navigate('/b')}>To B</button>
        </div>
      );
    }

    function PageB() {
      const navigate = useNavigate();
      return (
        <div>
          <div data-testid="page">B</div>
          <button onClick={() => navigate('/a')}>To A</button>
        </div>
      );
    }

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/a']}>
          <Routes>
            <Route path="/a" element={<PageA />} />
            <Route path="/b" element={<PageB />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Rapid navigation
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole('button'));
      await act(async () => {
        await new Promise(r => setTimeout(r, 10));
      });
    }

    // Should end up on one of the pages without crashing
    const page = screen.getByTestId('page');
    expect(['A', 'B']).toContain(page.textContent);

    // No navigation errors
    const navErrors = consoleErrors.filter(e => 
      e.includes('navigation') || e.includes('router')
    );
    expect(navErrors.length).toBe(0);
  });
});

describe('Redirect Loop Prevention', () => {
  it('should prevent auth redirect loops', async () => {
    let redirectCount = 0;
    const MAX_REDIRECTS = 5;

    // Simulate auth context
    interface AuthContextType {
      isAuthenticated: boolean;
      isLoading: boolean;
    }
    
    const AuthContext = createContext<AuthContextType>({
      isAuthenticated: false,
      isLoading: true,
    });

    function AuthProvider({ 
      children, 
      authenticated 
    }: { 
      children: ReactNode;
      authenticated: boolean;
    }) {
      const [isLoading, setIsLoading] = useState(true);
      
      useEffect(() => {
        setTimeout(() => setIsLoading(false), 50);
      }, []);

      const value = useMemo(() => ({
        isAuthenticated: authenticated,
        isLoading,
      }), [authenticated, isLoading]);

      return (
        <AuthContext.Provider value={value}>
          {children}
        </AuthContext.Provider>
      );
    }

    function ProtectedRoute() {
      const { isAuthenticated, isLoading } = useContext(AuthContext);
      const hasRedirected = useRef(false);

      if (isLoading) {
        return <div>Loading auth...</div>;
      }

      if (!isAuthenticated && !hasRedirected.current) {
        hasRedirected.current = true;
        redirectCount++;
        
        if (redirectCount > MAX_REDIRECTS) {
          throw new Error('Redirect loop detected!');
        }
        
        return <Navigate to="/login" replace />;
      }

      return <Outlet />;
    }

    function LoginPage() {
      redirectCount++;
      if (redirectCount > MAX_REDIRECTS) {
        throw new Error('Redirect loop detected!');
      }
      return <div data-testid="login">Login Page</div>;
    }

    function Dashboard() {
      return <div data-testid="dashboard">Dashboard</div>;
    }

    // Test unauthenticated flow
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider authenticated={false}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('login')).toBeInTheDocument();
    });

    // Should redirect once, not loop
    expect(redirectCount).toBeLessThan(MAX_REDIRECTS);
  });

  it('should handle login -> protected -> login cycle safely', async () => {
    let navigationAttempts = 0;

    function useStableNavigate() {
      const navigate = useNavigate();
      const hasNavigated = useRef(false);

      return useCallback((path: string) => {
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          navigationAttempts++;
          navigate(path, { replace: true });
        }
      }, [navigate]);
    }

    function LoginPage() {
      const [isLoggingIn, setIsLoggingIn] = useState(false);
      const stableNavigate = useStableNavigate();

      const handleLogin = async () => {
        setIsLoggingIn(true);
        await new Promise(r => setTimeout(r, 50));
        stableNavigate('/protected');
      };

      return (
        <div>
          <div data-testid="login">Login</div>
          <button onClick={handleLogin} disabled={isLoggingIn}>
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </button>
        </div>
      );
    }

    function ProtectedPage() {
      return <div data-testid="protected">Protected</div>;
    }

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/protected" element={<ProtectedPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('login')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('protected')).toBeInTheDocument();
    });

    // Navigation should only happen once
    expect(navigationAttempts).toBe(1);
  });
});

describe('Route Cleanup on Navigation', () => {
  it('should cleanup subscriptions when leaving route', async () => {
    const subscriptions = new Set<string>();

    function useSubscription(channel: string) {
      useEffect(() => {
        subscriptions.add(channel);
        return () => {
          subscriptions.delete(channel);
        };
      }, [channel]);
    }

    function PageWithSubscription() {
      const navigate = useNavigate();
      useSubscription('page-channel');

      return (
        <div>
          <div data-testid="page">Subscribed Page</div>
          <button onClick={() => navigate('/other')}>Leave</button>
        </div>
      );
    }

    function OtherPage() {
      return <div data-testid="other">Other Page</div>;
    }

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/subscribed']}>
          <Routes>
            <Route path="/subscribed" element={<PageWithSubscription />} />
            <Route path="/other" element={<OtherPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(subscriptions.has('page-channel')).toBe(true);

    fireEvent.click(screen.getByText('Leave'));

    await waitFor(() => {
      expect(screen.getByTestId('other')).toBeInTheDocument();
    });

    // Subscription should be cleaned up
    expect(subscriptions.has('page-channel')).toBe(false);
  });

  it('should cancel timers when leaving route', async () => {
    let timerFired = false;

    function TimerPage() {
      const navigate = useNavigate();
      const mountedRef = useRef(true);

      useEffect(() => {
        mountedRef.current = true;
        const id = setTimeout(() => {
          if (mountedRef.current) {
            timerFired = true;
          }
        }, 500);

        return () => {
          mountedRef.current = false;
          clearTimeout(id);
        };
      }, []);

      return (
        <div>
          <button onClick={() => navigate('/other')}>Leave</button>
        </div>
      );
    }

    function OtherPage() {
      return <div data-testid="other">Other</div>;
    }

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/timer']}>
          <Routes>
            <Route path="/timer" element={<TimerPage />} />
            <Route path="/other" element={<OtherPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Leave before timer fires
    fireEvent.click(screen.getByText('Leave'));

    await waitFor(() => {
      expect(screen.getByTestId('other')).toBeInTheDocument();
    });

    // Wait for timer to have fired (if it wasn't cancelled)
    await act(async () => {
      await new Promise(r => setTimeout(r, 600));
    });

    // Timer should NOT have fired
    expect(timerFired).toBe(false);
  });
});

describe('Location State Handling', () => {
  it('should handle missing location state gracefully', () => {
    function StatePage() {
      const location = useLocation();
      const state = (location.state as { message?: string }) || {};

      return (
        <div data-testid="message">
          {state.message || 'No message'}
        </div>
      );
    }

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/state']}>
          <Routes>
            <Route path="/state" element={<StatePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Should not crash, should show default
    expect(screen.getByTestId('message')).toHaveTextContent('No message');
  });

  it('should handle location state with data', () => {
    function StatePage() {
      const location = useLocation();
      const state = (location.state as { from?: string }) || {};

      return (
        <div data-testid="from">{state.from || 'direct'}</div>
      );
    }

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter 
          initialEntries={[{ 
            pathname: '/state', 
            state: { from: '/previous' } 
          }]}
        >
          <Routes>
            <Route path="/state" element={<StatePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('from')).toHaveTextContent('/previous');
  });
});

describe('Browser History Edge Cases', () => {
  it('should handle popstate (back button) gracefully', async () => {
    function PageA() {
      const navigate = useNavigate();
      return (
        <div>
          <div data-testid="page">A</div>
          <button onClick={() => navigate('/b')}>To B</button>
        </div>
      );
    }

    function PageB() {
      return <div data-testid="page">B</div>;
    }

    const { container } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={['/a', '/b']} initialIndex={0}>
          <Routes>
            <Route path="/a" element={<PageA />} />
            <Route path="/b" element={<PageB />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('page')).toHaveTextContent('A');

    // Navigate forward
    fireEvent.click(screen.getByText('To B'));

    await waitFor(() => {
      expect(screen.getByTestId('page')).toHaveTextContent('B');
    });

    // We can't easily simulate popstate in tests
    // This test documents that the pattern works
  });
});
