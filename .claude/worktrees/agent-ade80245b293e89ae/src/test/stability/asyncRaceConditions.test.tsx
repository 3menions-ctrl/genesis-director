/**
 * Async Race Condition Crash Tests
 * 
 * Tests for:
 * - State updates on unmounted components
 * - AbortController cancellation
 * - Stale closure issues in async callbacks
 * - Promise race conditions
 * - Navigation during async operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen, waitFor, fireEvent } from '@testing-library/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useNavigate, Routes, Route, MemoryRouter } from 'react-router-dom';

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

describe('State Updates After Unmount', () => {
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

  describe('Basic Unmount Safety', () => {
    it('should NOT throw when async operation completes after unmount', async () => {
      function AsyncComponent() {
        const [data, setData] = useState<string | null>(null);
        const mountedRef = useRef(true);

        useEffect(() => {
          mountedRef.current = true;
          
          const fetchData = async () => {
            await new Promise(r => setTimeout(r, 100));
            // CORRECT: Check mounted before setState
            if (mountedRef.current) {
              setData('loaded');
            }
          };

          fetchData();

          return () => {
            mountedRef.current = false;
          };
        }, []);

        return <div>{data || 'loading'}</div>;
      }

      const { unmount } = render(<AsyncComponent />, {
        wrapper: createTestWrapper(),
      });

      // Unmount before async completes
      unmount();

      // Wait for async to complete
      await act(async () => {
        await new Promise(r => setTimeout(r, 150));
      });

      // No "Can't perform state update on unmounted" errors
      const unmountErrors = consoleErrors.filter(e => 
        e.includes('unmounted') || 
        e.includes("Can't perform")
      );
      expect(unmountErrors.length).toBe(0);
    });

    it('should handle multiple concurrent async operations safely', async () => {
      function MultiAsyncComponent() {
        const [results, setResults] = useState<string[]>([]);
        const mountedRef = useRef(true);

        const safeSetState = useCallback((updater: (prev: string[]) => string[]) => {
          if (mountedRef.current) {
            setResults(updater);
          }
        }, []);

        useEffect(() => {
          mountedRef.current = true;

          // Multiple concurrent operations
          const ops = [
            new Promise<string>(r => setTimeout(() => r('op1'), 50)),
            new Promise<string>(r => setTimeout(() => r('op2'), 100)),
            new Promise<string>(r => setTimeout(() => r('op3'), 150)),
          ];

          ops.forEach(async (op) => {
            const result = await op;
            safeSetState(prev => [...prev, result]);
          });

          return () => {
            mountedRef.current = false;
          };
        }, [safeSetState]);

        return <div data-testid="results">{results.join(',')}</div>;
      }

      const { unmount } = render(<MultiAsyncComponent />, {
        wrapper: createTestWrapper(),
      });

      // Wait for first op
      await act(async () => {
        await new Promise(r => setTimeout(r, 75));
      });

      // Unmount mid-operations
      unmount();

      // Wait for remaining ops
      await act(async () => {
        await new Promise(r => setTimeout(r, 100));
      });

      // No errors
      const errors = consoleErrors.filter(e => e.includes('unmounted'));
      expect(errors.length).toBe(0);
    });
  });

  describe('AbortController Patterns', () => {
    it('should abort fetch on unmount', async () => {
      let fetchAborted = false;

      function FetchComponent() {
        const [data, setData] = useState<string | null>(null);

        useEffect(() => {
          const controller = new AbortController();

          const fetchData = async () => {
            try {
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(resolve, 100);
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

          return () => {
            controller.abort();
          };
        }, []);

        return <div>{data || 'loading'}</div>;
      }

      const { unmount } = render(<FetchComponent />, {
        wrapper: createTestWrapper(),
      });

      unmount();

      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      expect(fetchAborted).toBe(true);
    });

    it('should handle AbortController in hooks correctly', async () => {
      function useAbortableAsync() {
        const controllerRef = useRef<AbortController | null>(null);

        const execute = useCallback(async <T,>(
          asyncFn: (signal: AbortSignal) => Promise<T>
        ): Promise<T | null> => {
          // Abort previous
          controllerRef.current?.abort();
          controllerRef.current = new AbortController();

          try {
            return await asyncFn(controllerRef.current.signal);
          } catch (e) {
            if ((e as Error).name === 'AbortError') {
              return null;
            }
            throw e;
          }
        }, []);

        const abort = useCallback(() => {
          controllerRef.current?.abort();
        }, []);

        useEffect(() => {
          return () => {
            controllerRef.current?.abort();
          };
        }, []);

        return { execute, abort };
      }

      function TestComponent() {
        const { execute } = useAbortableAsync();
        const [result, setResult] = useState<string | null>(null);

        const handleClick = useCallback(async () => {
          const data = await execute(async (signal) => {
            return new Promise<string>((resolve, reject) => {
              const timeout = setTimeout(() => resolve('done'), 50);
              signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new DOMException('Aborted', 'AbortError'));
              });
            });
          });
          if (data) setResult(data);
        }, [execute]);

        return (
          <div>
            <button onClick={handleClick}>Load</button>
            <div data-testid="result">{result || 'none'}</div>
          </div>
        );
      }

      render(<TestComponent />, { wrapper: createTestWrapper() });

      // Click multiple times rapidly (should abort previous)
      const button = screen.getByText('Load');
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('result')).toHaveTextContent('done');
      });

      // No errors
      expect(consoleErrors.length).toBe(0);
    });
  });

  describe('Navigation During Async Operations', () => {
    it('should handle navigation interrupting async operation', async () => {
      function PageA() {
        const navigate = useNavigate();
        const [loading, setLoading] = useState(true);
        const mountedRef = useRef(true);

        useEffect(() => {
          mountedRef.current = true;
          
          const load = async () => {
            await new Promise(r => setTimeout(r, 100));
            if (mountedRef.current) {
              setLoading(false);
            }
          };
          load();

          return () => {
            mountedRef.current = false;
          };
        }, []);

        return (
          <div>
            <div data-testid="status">{loading ? 'loading' : 'loaded'}</div>
            <button onClick={() => navigate('/b')}>Go to B</button>
          </div>
        );
      }

      function PageB() {
        return <div data-testid="page-b">Page B</div>;
      }

      function App() {
        return (
          <Routes>
            <Route path="/" element={<PageA />} />
            <Route path="/b" element={<PageB />} />
          </Routes>
        );
      }

      const queryClient = new QueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/']}>
            <App />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('status')).toHaveTextContent('loading');

      // Navigate before load completes
      fireEvent.click(screen.getByText('Go to B'));

      await waitFor(() => {
        expect(screen.getByTestId('page-b')).toBeInTheDocument();
      });

      // Wait for original async to complete
      await act(async () => {
        await new Promise(r => setTimeout(r, 150));
      });

      // No state update errors
      const stateErrors = consoleErrors.filter(e => e.includes('unmounted'));
      expect(stateErrors.length).toBe(0);
    });
  });

  describe('Promise Race Conditions', () => {
    it('should handle out-of-order promise resolution', async () => {
      function RaceComponent() {
        const [data, setData] = useState<string | null>(null);
        const latestRequestId = useRef(0);

        const loadData = useCallback(async (id: string, delay: number) => {
          const requestId = ++latestRequestId.current;
          
          await new Promise(r => setTimeout(r, delay));
          
          // Only update if this is still the latest request
          if (requestId === latestRequestId.current) {
            setData(`Data ${id}`);
          }
        }, []);

        useEffect(() => {
          // Simulate rapid requests where earlier one resolves later
          loadData('A', 100); // Will resolve second
          loadData('B', 50);  // Will resolve first, but B is latest
        }, [loadData]);

        return <div data-testid="data">{data || 'loading'}</div>;
      }

      render(<RaceComponent />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        // Should show B since it was the latest request
        expect(screen.getByTestId('data')).toHaveTextContent('Data B');
      });

      // Wait for A to resolve
      await act(async () => {
        await new Promise(r => setTimeout(r, 100));
      });

      // Should still show B (A's update was ignored)
      expect(screen.getByTestId('data')).toHaveTextContent('Data B');
    });

    it('should handle Promise.all partial failures gracefully', async () => {
      function BatchComponent() {
        const [results, setResults] = useState<{
          success: string[];
          failed: string[];
        }>({ success: [], failed: [] });

        useEffect(() => {
          const operations = [
            Promise.resolve('op1'),
            Promise.reject(new Error('op2 failed')),
            Promise.resolve('op3'),
          ];

          Promise.allSettled(operations).then((settled) => {
            const success: string[] = [];
            const failed: string[] = [];
            
            settled.forEach((result, i) => {
              if (result.status === 'fulfilled') {
                success.push(result.value);
              } else {
                failed.push(`op${i + 1}`);
              }
            });

            setResults({ success, failed });
          });
        }, []);

        return (
          <div>
            <div data-testid="success">{results.success.join(',')}</div>
            <div data-testid="failed">{results.failed.join(',')}</div>
          </div>
        );
      }

      render(<BatchComponent />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('success')).toHaveTextContent('op1,op3');
        expect(screen.getByTestId('failed')).toHaveTextContent('op2');
      });
    });
  });

  describe('Stale Closure Prevention', () => {
    it('should use refs for always-current values in async callbacks', async () => {
      function StaleClosureComponent() {
        const [count, setCount] = useState(0);
        const countRef = useRef(count);
        countRef.current = count;

        const [asyncResult, setAsyncResult] = useState<number | null>(null);

        const handleAsyncAction = useCallback(async () => {
          // Simulate async delay
          await new Promise(r => setTimeout(r, 50));
          
          // Use ref for current value, not stale closure
          setAsyncResult(countRef.current);
        }, []); // No count dependency - uses ref

        return (
          <div>
            <button onClick={() => setCount(c => c + 1)}>
              Increment ({count})
            </button>
            <button onClick={handleAsyncAction}>Async Action</button>
            <div data-testid="result">{asyncResult ?? 'none'}</div>
          </div>
        );
      }

      render(<StaleClosureComponent />, { wrapper: createTestWrapper() });

      // Increment 3 times
      const incButton = screen.getByText(/Increment/);
      fireEvent.click(incButton);
      fireEvent.click(incButton);
      fireEvent.click(incButton);

      // Start async action
      fireEvent.click(screen.getByText('Async Action'));

      // Increment once more during async
      fireEvent.click(incButton);

      await waitFor(() => {
        // Should have current value (4), not stale (3)
        expect(screen.getByTestId('result')).toHaveTextContent('4');
      });
    });
  });
});

describe('Debounce and Throttle Safety', () => {
  it('should cancel debounced functions on unmount', async () => {
    let callCount = 0;

    function useDebounce<T extends (...args: any[]) => any>(
      fn: T,
      delay: number
    ): T {
      const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

      useEffect(() => {
        return () => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        };
      }, []);

      return useCallback(
        ((...args: Parameters<T>) => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            fn(...args);
          }, delay);
        }) as T,
        [fn, delay]
      );
    }

    function DebouncedComponent() {
      const [value, setValue] = useState('');

      const handleSearch = useCallback((term: string) => {
        callCount++;
      }, []);

      const debouncedSearch = useDebounce(handleSearch, 100);

      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
        debouncedSearch(e.target.value);
      };

      return <input value={value} onChange={handleChange} data-testid="input" />;
    }

    const { unmount } = render(<DebouncedComponent />, {
      wrapper: createTestWrapper(),
    });

    const input = screen.getByTestId('input');
    
    // Type rapidly
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.change(input, { target: { value: 'abc' } });

    // Unmount before debounce fires
    unmount();

    await act(async () => {
      await new Promise(r => setTimeout(r, 150));
    });

    // Debounced call should not have fired
    expect(callCount).toBe(0);
  });
});
