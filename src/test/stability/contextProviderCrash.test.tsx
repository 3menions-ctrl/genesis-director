/**
 * Context Provider Crash Tests
 * 
 * Tests for:
 * - Missing provider errors
 * - Context value stability
 * - Nested provider conflicts
 * - Context updates causing re-render cascades
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen, fireEvent, waitFor } from '@testing-library/react';
import { 
  createContext, 
  useContext, 
  useState, 
  useMemo, 
  useCallback,
  memo,
  useRef,
  useEffect,
  ReactNode
} from 'react';
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

describe('Missing Provider Safety', () => {
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

  it('should handle missing context gracefully with safe fallback pattern', () => {
    // This is the pattern used in useAuth, useStudio, etc.
    
    interface AuthContextType {
      user: { id: string; email: string } | null;
      isLoading: boolean;
      signOut: () => Promise<void>;
    }

    const AuthContext = createContext<AuthContextType | undefined>(undefined);

    // Safe fallback pattern - doesn't throw
    function useAuth(): AuthContextType {
      const context = useContext(AuthContext);
      
      // Instead of throwing, return safe fallback
      if (!context) {
        return {
          user: null,
          isLoading: true,
          signOut: async () => {},
        };
      }
      
      return context;
    }

    function TestComponent() {
      const { user, isLoading } = useAuth();
      return (
        <div>
          <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
          <div data-testid="user">{user?.email || 'none'}</div>
        </div>
      );
    }

    // Render WITHOUT provider - should not crash
    render(<TestComponent />, { wrapper: createTestWrapper() });

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(screen.getByTestId('user')).toHaveTextContent('none');

    // No crash errors
    const crashErrors = consoleErrors.filter(e => 
      e.includes('must be used within') || 
      e.includes('Cannot read properties of undefined')
    );
    expect(crashErrors.length).toBe(0);
  });

  it('should work correctly when provider IS present', () => {
    interface ThemeContextType {
      theme: 'light' | 'dark';
      toggleTheme: () => void;
    }

    const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

    function ThemeProvider({ children }: { children: ReactNode }) {
      const [theme, setTheme] = useState<'light' | 'dark'>('light');
      
      const value = useMemo(() => ({
        theme,
        toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light'),
      }), [theme]);

      return (
        <ThemeContext.Provider value={value}>
          {children}
        </ThemeContext.Provider>
      );
    }

    function useTheme(): ThemeContextType {
      const context = useContext(ThemeContext);
      if (!context) {
        return { theme: 'light', toggleTheme: () => {} };
      }
      return context;
    }

    function ThemeDisplay() {
      const { theme, toggleTheme } = useTheme();
      return (
        <div>
          <span data-testid="theme">{theme}</span>
          <button onClick={toggleTheme}>Toggle</button>
        </div>
      );
    }

    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
      { wrapper: createTestWrapper() }
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');

    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });
});

describe('Context Value Stability', () => {
  it('should memoize context value to prevent re-renders', () => {
    let renderCount = 0;

    interface DataContextType {
      data: string[];
      addItem: (item: string) => void;
    }

    const DataContext = createContext<DataContextType | null>(null);

    function DataProvider({ children }: { children: ReactNode }) {
      const [data, setData] = useState<string[]>([]);

      // CORRECT: Memoize value object
      const value = useMemo(() => ({
        data,
        addItem: (item: string) => setData(prev => [...prev, item]),
      }), [data]);

      return (
        <DataContext.Provider value={value}>
          {children}
        </DataContext.Provider>
      );
    }

    // Memoized consumer
    const DataConsumer = memo(function DataConsumer() {
      const context = useContext(DataContext);
      renderCount++;
      
      if (renderCount > 20) {
        throw new Error('Too many renders - context value unstable!');
      }

      return <div data-testid="count">{context?.data.length ?? 0}</div>;
    });

    function Controller() {
      const context = useContext(DataContext);
      return (
        <button onClick={() => context?.addItem('item')}>Add</button>
      );
    }

    render(
      <DataProvider>
        <DataConsumer />
        <Controller />
      </DataProvider>,
      { wrapper: createTestWrapper() }
    );

    const initialRenders = renderCount;

    // Add items
    fireEvent.click(screen.getByText('Add'));
    fireEvent.click(screen.getByText('Add'));
    fireEvent.click(screen.getByText('Add'));

    // Consumer should only re-render when data changes
    // Initial render + 3 data changes = 4 renders (maybe 8 in StrictMode)
    expect(renderCount).toBeLessThanOrEqual(initialRenders + 6);
  });

  it('should separate frequently-updating values', () => {
    let stableConsumerRenders = 0;
    let frequentConsumerRenders = 0;

    // Split context to prevent unnecessary re-renders
    interface StableContextType {
      config: { theme: string };
    }
    
    interface FrequentContextType {
      counter: number;
      increment: () => void;
    }

    const StableContext = createContext<StableContextType | null>(null);
    const FrequentContext = createContext<FrequentContextType | null>(null);

    function SplitProvider({ children }: { children: ReactNode }) {
      const [counter, setCounter] = useState(0);
      
      const stableValue = useMemo(() => ({
        config: { theme: 'dark' },
      }), []);

      const frequentValue = useMemo(() => ({
        counter,
        increment: () => setCounter(c => c + 1),
      }), [counter]);

      return (
        <StableContext.Provider value={stableValue}>
          <FrequentContext.Provider value={frequentValue}>
            {children}
          </FrequentContext.Provider>
        </StableContext.Provider>
      );
    }

    const StableConsumer = memo(function StableConsumer() {
      const ctx = useContext(StableContext);
      stableConsumerRenders++;
      return <div data-testid="theme">{ctx?.config.theme}</div>;
    });

    const FrequentConsumer = memo(function FrequentConsumer() {
      const ctx = useContext(FrequentContext);
      frequentConsumerRenders++;
      return <div data-testid="counter">{ctx?.counter}</div>;
    });

    function Controller() {
      const ctx = useContext(FrequentContext);
      return <button onClick={ctx?.increment}>Inc</button>;
    }

    render(
      <SplitProvider>
        <StableConsumer />
        <FrequentConsumer />
        <Controller />
      </SplitProvider>,
      { wrapper: createTestWrapper() }
    );

    const stableInitial = stableConsumerRenders;
    const frequentInitial = frequentConsumerRenders;

    // Increment multiple times
    fireEvent.click(screen.getByText('Inc'));
    fireEvent.click(screen.getByText('Inc'));
    fireEvent.click(screen.getByText('Inc'));

    // Stable consumer should NOT re-render
    expect(stableConsumerRenders).toBe(stableInitial);
    
    // Frequent consumer SHOULD re-render
    expect(frequentConsumerRenders).toBeGreaterThan(frequentInitial);
  });
});

describe('Nested Provider Conflicts', () => {
  it('should handle nested providers with same context', () => {
    interface CountContextType {
      count: number;
      name: string;
    }

    const CountContext = createContext<CountContextType>({ count: 0, name: 'root' });

    function Display() {
      const { count, name } = useContext(CountContext);
      return <div data-testid={name}>{count}</div>;
    }

    render(
      <CountContext.Provider value={{ count: 1, name: 'outer' }}>
        <Display />
        <CountContext.Provider value={{ count: 2, name: 'inner' }}>
          <Display />
        </CountContext.Provider>
      </CountContext.Provider>,
      { wrapper: createTestWrapper() }
    );

    // Each display should see its nearest provider
    expect(screen.getByTestId('outer')).toHaveTextContent('1');
    expect(screen.getByTestId('inner')).toHaveTextContent('2');
  });
});

describe('Context Update Cascade Prevention', () => {
  it('should batch context updates to prevent cascade', async () => {
    let renderCount = 0;

    interface BatchContextType {
      a: number;
      b: number;
      updateBoth: () => void;
    }

    const BatchContext = createContext<BatchContextType | null>(null);

    function BatchProvider({ children }: { children: ReactNode }) {
      const [a, setA] = useState(0);
      const [b, setB] = useState(0);

      const updateBoth = useCallback(() => {
        // React 18 automatically batches these
        setA(prev => prev + 1);
        setB(prev => prev + 1);
      }, []);

      const value = useMemo(() => ({ a, b, updateBoth }), [a, b, updateBoth]);

      return (
        <BatchContext.Provider value={value}>
          {children}
        </BatchContext.Provider>
      );
    }

    const Consumer = memo(function Consumer() {
      const ctx = useContext(BatchContext);
      renderCount++;
      
      if (renderCount > 30) {
        throw new Error('Cascade detected!');
      }

      return (
        <div>
          <span data-testid="a">{ctx?.a}</span>
          <span data-testid="b">{ctx?.b}</span>
        </div>
      );
    });

    function Controller() {
      const ctx = useContext(BatchContext);
      return <button onClick={ctx?.updateBoth}>Update Both</button>;
    }

    render(
      <BatchProvider>
        <Consumer />
        <Controller />
      </BatchProvider>,
      { wrapper: createTestWrapper() }
    );

    const initialRenders = renderCount;

    await act(async () => {
      fireEvent.click(screen.getByText('Update Both'));
    });

    // Should only cause 1 re-render (batched), not 2 separate ones
    // StrictMode doubles renders, so allow for that
    expect(renderCount).toBeLessThanOrEqual(initialRenders + 2);

    expect(screen.getByTestId('a')).toHaveTextContent('1');
    expect(screen.getByTestId('b')).toHaveTextContent('1');
  });
});

describe('Context with Async State', () => {
  it('should handle async context updates safely', async () => {
    interface AsyncContextType {
      data: string | null;
      loading: boolean;
      load: () => Promise<void>;
    }

    const AsyncContext = createContext<AsyncContextType | null>(null);

    function AsyncProvider({ children }: { children: ReactNode }) {
      const [data, setData] = useState<string | null>(null);
      const [loading, setLoading] = useState(false);
      const mountedRef = useRef(true);

      useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
      }, []);

      const load = useCallback(async () => {
        setLoading(true);
        await new Promise(r => setTimeout(r, 50));
        if (mountedRef.current) {
          setData('loaded');
          setLoading(false);
        }
      }, []);

      const value = useMemo(() => ({ data, loading, load }), [data, loading, load]);

      return (
        <AsyncContext.Provider value={value}>
          {children}
        </AsyncContext.Provider>
      );
    }

    function AsyncConsumer() {
      const ctx = useContext(AsyncContext);
      
      useEffect(() => {
        ctx?.load();
      }, [ctx]);

      if (ctx?.loading) return <div>Loading...</div>;
      return <div data-testid="data">{ctx?.data || 'none'}</div>;
    }

    render(
      <AsyncProvider>
        <AsyncConsumer />
      </AsyncProvider>,
      { wrapper: createTestWrapper() }
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('data')).toHaveTextContent('loaded');
    });
  });

  it('should handle provider unmount during async operation', async () => {
    let consoleErrors: string[] = [];
    const originalError = console.error;
    console.error = (...args) => {
      consoleErrors.push(args.map(String).join(' '));
    };

    interface AsyncContextType {
      load: () => Promise<void>;
    }

    const AsyncContext = createContext<AsyncContextType | null>(null);

    function AsyncProvider({ children }: { children: ReactNode }) {
      const [, setData] = useState<string | null>(null);
      const mountedRef = useRef(true);

      useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
      }, []);

      const load = useCallback(async () => {
        await new Promise(r => setTimeout(r, 100));
        if (mountedRef.current) {
          setData('loaded');
        }
      }, []);

      const value = useMemo(() => ({ load }), [load]);

      return (
        <AsyncContext.Provider value={value}>
          {children}
        </AsyncContext.Provider>
      );
    }

    function Loader() {
      const ctx = useContext(AsyncContext);
      
      useEffect(() => {
        ctx?.load();
      }, [ctx]);

      return <div>Loader</div>;
    }

    const { unmount } = render(
      <AsyncProvider>
        <Loader />
      </AsyncProvider>,
      { wrapper: createTestWrapper() }
    );

    // Unmount before async completes
    unmount();

    await act(async () => {
      await new Promise(r => setTimeout(r, 150));
    });

    // No state update errors
    const stateErrors = consoleErrors.filter(e => 
      e.includes('unmounted') || e.includes("Can't perform")
    );
    expect(stateErrors.length).toBe(0);

    console.error = originalError;
  });
});
