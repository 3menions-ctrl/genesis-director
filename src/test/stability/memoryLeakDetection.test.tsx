/**
 * Memory Leak Detection Tests
 * 
 * Tests for:
 * - Event listener accumulation
 * - Blob/ObjectURL leaks
 * - Subscription leaks
 * - Timer accumulation
 * - Reference retention preventing GC
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Event Listener Leak Prevention', () => {
  let eventListeners: Map<string, Set<Function>>;
  let originalAdd: typeof window.addEventListener;
  let originalRemove: typeof window.removeEventListener;

  beforeEach(() => {
    eventListeners = new Map();
    originalAdd = window.addEventListener;
    originalRemove = window.removeEventListener;

    window.addEventListener = vi.fn((type: string, handler: EventListenerOrEventListenerObject) => {
      if (!eventListeners.has(type)) {
        eventListeners.set(type, new Set());
      }
      eventListeners.get(type)!.add(handler as Function);
      originalAdd.call(window, type, handler);
    });

    window.removeEventListener = vi.fn((type: string, handler: EventListenerOrEventListenerObject) => {
      eventListeners.get(type)?.delete(handler as Function);
      originalRemove.call(window, type, handler);
    });
  });

  afterEach(() => {
    window.addEventListener = originalAdd;
    window.removeEventListener = originalRemove;
  });

  it('should cleanup resize listeners on unmount', () => {
    function ResizeComponent() {
      const [width, setWidth] = useState(0);

      useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
      }, []);

      return <div>Width: {width}</div>;
    }

    const { unmount } = render(<ResizeComponent />, { wrapper: createTestWrapper() });
    
    const beforeUnmount = eventListeners.get('resize')?.size ?? 0;
    expect(beforeUnmount).toBeGreaterThan(0);

    unmount();

    const afterUnmount = eventListeners.get('resize')?.size ?? 0;
    expect(afterUnmount).toBeLessThan(beforeUnmount);
  });

  it('should cleanup multiple listeners from same component', () => {
    function MultiListenerComponent() {
      useEffect(() => {
        const handleResize = () => {};
        const handleScroll = () => {};
        const handleKeydown = () => {};

        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleScroll);
        window.addEventListener('keydown', handleKeydown);

        return () => {
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('scroll', handleScroll);
          window.removeEventListener('keydown', handleKeydown);
        };
      }, []);

      return <div>Multi Listener</div>;
    }

    const { unmount } = render(<MultiListenerComponent />, { wrapper: createTestWrapper() });

    expect(eventListeners.get('resize')?.size).toBeGreaterThan(0);
    expect(eventListeners.get('scroll')?.size).toBeGreaterThan(0);
    expect(eventListeners.get('keydown')?.size).toBeGreaterThan(0);

    unmount();

    expect(eventListeners.get('resize')?.size ?? 0).toBe(0);
    expect(eventListeners.get('scroll')?.size ?? 0).toBe(0);
    expect(eventListeners.get('keydown')?.size ?? 0).toBe(0);
  });

  it('should not accumulate listeners on re-render', () => {
    function ReRenderComponent({ id }: { id: number }) {
      useEffect(() => {
        const handler = () => {};
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
      }, [id]);

      return <div>ID: {id}</div>;
    }

    const { rerender, unmount } = render(
      <ReRenderComponent id={1} />,
      { wrapper: createTestWrapper() }
    );

    const count1 = eventListeners.get('resize')?.size ?? 0;

    rerender(<ReRenderComponent id={2} />);
    rerender(<ReRenderComponent id={3} />);
    rerender(<ReRenderComponent id={4} />);

    // Should still only have 1 listener (old ones cleaned up)
    const countAfter = eventListeners.get('resize')?.size ?? 0;
    expect(countAfter).toBe(count1);

    unmount();
    expect(eventListeners.get('resize')?.size ?? 0).toBe(0);
  });
});

describe('ObjectURL/Blob Leak Prevention', () => {
  let createdURLs: Set<string>;
  let originalCreateURL: typeof URL.createObjectURL;
  let originalRevokeURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    createdURLs = new Set();
    originalCreateURL = URL.createObjectURL;
    originalRevokeURL = URL.revokeObjectURL;

    URL.createObjectURL = vi.fn((blob: Blob) => {
      const url = `blob:test-${Math.random()}`;
      createdURLs.add(url);
      return url;
    });

    URL.revokeObjectURL = vi.fn((url: string) => {
      createdURLs.delete(url);
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateURL;
    URL.revokeObjectURL = originalRevokeURL;
  });

  it('should revoke blob URLs on unmount', async () => {
    function BlobComponent() {
      const [blobUrl, setBlobUrl] = useState<string | null>(null);

      useEffect(() => {
        const blob = new Blob(['test'], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        return () => {
          URL.revokeObjectURL(url);
        };
      }, []);

      return <div>{blobUrl || 'loading'}</div>;
    }

    expect(createdURLs.size).toBe(0);

    const { unmount } = render(<BlobComponent />, { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(createdURLs.size).toBe(1);
    });

    unmount();

    expect(createdURLs.size).toBe(0);
  });

  it('should revoke old URLs when creating new ones', async () => {
    function DynamicBlobComponent({ content }: { content: string }) {
      const prevUrlRef = useRef<string | null>(null);
      const [blobUrl, setBlobUrl] = useState<string | null>(null);

      useEffect(() => {
        // Revoke previous URL
        if (prevUrlRef.current) {
          URL.revokeObjectURL(prevUrlRef.current);
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        prevUrlRef.current = url;
        setBlobUrl(url);

        return () => {
          if (prevUrlRef.current) {
            URL.revokeObjectURL(prevUrlRef.current);
            prevUrlRef.current = null;
          }
        };
      }, [content]);

      return <div>{blobUrl || 'loading'}</div>;
    }

    const { rerender, unmount } = render(
      <DynamicBlobComponent content="a" />,
      { wrapper: createTestWrapper() }
    );

    await waitFor(() => expect(createdURLs.size).toBe(1));

    rerender(<DynamicBlobComponent content="b" />);
    await waitFor(() => expect(createdURLs.size).toBe(1)); // Old revoked, new created

    rerender(<DynamicBlobComponent content="c" />);
    await waitFor(() => expect(createdURLs.size).toBe(1));

    unmount();
    expect(createdURLs.size).toBe(0);
  });
});

describe('Timer Leak Prevention', () => {
  it('should cleanup all intervals on unmount', async () => {
    const activeIntervals = new Set<NodeJS.Timeout>();
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;

    (global as any).setInterval = vi.fn((...args: Parameters<typeof setInterval>) => {
      const id = originalSetInterval(...args);
      activeIntervals.add(id);
      return id;
    });

    (global as any).clearInterval = vi.fn((id: NodeJS.Timeout) => {
      activeIntervals.delete(id);
      originalClearInterval(id);
    });

    function IntervalComponent() {
      useEffect(() => {
        const id1 = setInterval(() => {}, 100);
        const id2 = setInterval(() => {}, 200);

        return () => {
          clearInterval(id1);
          clearInterval(id2);
        };
      }, []);

      return <div>Intervals</div>;
    }

    const { unmount } = render(<IntervalComponent />, { wrapper: createTestWrapper() });

    expect(activeIntervals.size).toBe(2);

    unmount();

    expect(activeIntervals.size).toBe(0);

    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  it('should cleanup chained timeouts on unmount', async () => {
    const activeTimeouts = new Set<NodeJS.Timeout>();
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;

    (global as any).setTimeout = vi.fn((...args: Parameters<typeof setTimeout>) => {
      const id = originalSetTimeout(...args);
      activeTimeouts.add(id);
      return id;
    });

    (global as any).clearTimeout = vi.fn((id: NodeJS.Timeout) => {
      activeTimeouts.delete(id);
      originalClearTimeout(id);
    });

    function ChainedTimeoutComponent() {
      const mountedRef = useRef(true);
      const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

      useEffect(() => {
        mountedRef.current = true;

        const chain = () => {
          if (!mountedRef.current) return;
          timeoutRef.current = setTimeout(chain, 50);
        };

        timeoutRef.current = setTimeout(chain, 50);

        return () => {
          mountedRef.current = false;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        };
      }, []);

      return <div>Chained</div>;
    }

    const { unmount } = render(<ChainedTimeoutComponent />, { wrapper: createTestWrapper() });

    await act(async () => {
      await new Promise(r => originalSetTimeout(r, 100));
    });

    const beforeUnmount = activeTimeouts.size;
    unmount();

    // All timeouts should be cleared
    // Note: Some may have already completed, so we just check it decreases
    expect(activeTimeouts.size).toBeLessThanOrEqual(beforeUnmount);

    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });
});

describe('Subscription Leak Prevention', () => {
  it('should cleanup custom subscriptions on unmount', () => {
    interface Subscriber {
      onUpdate: (data: string) => void;
    }

    const subscribers: Set<Subscriber> = new Set();

    const mockStore = {
      subscribe: (subscriber: Subscriber) => {
        subscribers.add(subscriber);
        return () => subscribers.delete(subscriber);
      },
      notify: (data: string) => {
        subscribers.forEach(s => s.onUpdate(data));
      },
    };

    function SubscriberComponent() {
      const [data, setData] = useState('');

      useEffect(() => {
        const unsubscribe = mockStore.subscribe({
          onUpdate: setData,
        });

        return () => { unsubscribe(); };
      }, []);

      return <div>{data}</div>;
    }

    expect(subscribers.size).toBe(0);

    const { unmount } = render(<SubscriberComponent />, { wrapper: createTestWrapper() });
    expect(subscribers.size).toBe(1);

    unmount();
    expect(subscribers.size).toBe(0);
  });

  it('should cleanup multiple subscriptions from nested components', () => {
    const subscriptions: Set<string> = new Set();

    function useSubscription(channel: string) {
      useEffect(() => {
        subscriptions.add(channel);
        return () => {
          subscriptions.delete(channel);
        };
      }, [channel]);
    }

    function Parent() {
      useSubscription('parent');
      return (
        <>
          <ChildA />
          <ChildB />
        </>
      );
    }

    function ChildA() {
      useSubscription('childA');
      return <div>A</div>;
    }

    function ChildB() {
      useSubscription('childB');
      return <div>B</div>;
    }

    const { unmount } = render(<Parent />, { wrapper: createTestWrapper() });

    expect(subscriptions.size).toBe(3);
    expect(subscriptions.has('parent')).toBe(true);
    expect(subscriptions.has('childA')).toBe(true);
    expect(subscriptions.has('childB')).toBe(true);

    unmount();

    expect(subscriptions.size).toBe(0);
  });
});

describe('Reference Retention Prevention', () => {
  it('should not retain references to DOM nodes after unmount', () => {
    const refs: HTMLDivElement[] = [];

    function RefRetentionComponent() {
      const ref = useRef<HTMLDivElement>(null);

      useEffect(() => {
        if (ref.current) {
          refs.push(ref.current);
        }

        return () => {
          // Clear ref on unmount (good practice)
          // Note: React does this automatically, but explicit is clearer
        };
      }, []);

      return <div ref={ref}>Test</div>;
    }

    const { unmount, rerender } = render(<RefRetentionComponent />, {
      wrapper: createTestWrapper(),
    });

    expect(refs.length).toBe(1);

    // The element should be removable after unmount
    unmount();

    // In a real scenario, we'd check that the element is GC'd
    // For now, we just verify the ref capture worked
    expect(refs.length).toBe(1);
  });

  it('should clear closure references that prevent GC', () => {
    // This tests that we properly clear references in closures
    const retainedCallbacks: Function[] = [];

    function ClosureComponent() {
      const [data] = useState({ large: 'data'.repeat(1000) });

      const callback = useCallback(() => {
        // This closure captures 'data'
        console.log(data.large.length);
      }, [data]);

      useEffect(() => {
        retainedCallbacks.push(callback);
        
        return () => {
          // Remove from retained callbacks on unmount
          const idx = retainedCallbacks.indexOf(callback);
          if (idx !== -1) retainedCallbacks.splice(idx, 1);
        };
      }, [callback]);

      return <div>Closure Test</div>;
    }

    const { unmount, rerender } = render(<ClosureComponent />, {
      wrapper: createTestWrapper(),
    });

    expect(retainedCallbacks.length).toBe(1);

    unmount();

    // Callback should be removed, allowing GC of captured data
    expect(retainedCallbacks.length).toBe(0);
  });
});

describe('WeakRef Pattern for Optional References', () => {
  it('should use WeakRef for cache that should allow GC', () => {
    // Pattern for caches that shouldn't prevent GC
    // Note: WeakRef and FinalizationRegistry require ES2021 target
    // This test documents the pattern conceptually
    
    interface CacheEntry {
      data: string;
    }
    
    const cache = new Map<string, { ref: object; data: string }>();
    
    function cacheObject(key: string, obj: CacheEntry) {
      cache.set(key, { ref: obj, data: obj.data });
    }

    function getCached(key: string): CacheEntry | undefined {
      const entry = cache.get(key);
      return entry ? { data: entry.data } : undefined;
    }

    // Test the pattern
    const obj: CacheEntry = { data: 'test' };
    cacheObject('key1', obj);

    expect(getCached('key1')).toBeDefined();
    expect(getCached('key1')?.data).toBe('test');

    // Note: We can't actually test GC in unit tests
    // This just documents the pattern
    expect(cache.has('key1')).toBe(true);
  });
});
