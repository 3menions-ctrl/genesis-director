import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimistic, useOptimisticList } from '@/hooks/useOptimistic';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useOptimistic', () => {
  it('initializes with the given value', () => {
    const { result } = renderHook(() => useOptimistic({ initialValue: 42 }));
    expect(result.current[0]).toBe(42);
  });

  it('applies optimistic update and resolves', async () => {
    const { result } = renderHook(() => useOptimistic({ initialValue: 'old' }));

    await act(async () => {
      await result.current[2].execute(
        'new',
        () => Promise.resolve()
      );
    });

    // After successful execute, value should be 'new'
    expect(result.current[0]).toBe('new');
  });

  it('rolls back on error', async () => {
    const { result } = renderHook(() => useOptimistic({ initialValue: 'original' }));

    await act(async () => {
      const success = await result.current[2].execute(
        'optimistic',
        () => Promise.reject(new Error('API failed')),
        { errorMessage: 'Something went wrong' }
      );
      expect(success).toBe(false);
    });

    expect(result.current[0]).toBe('original');
    expect(result.current[2].error?.message).toBe('API failed');
  });

  it('uses server-reconciled value on success', async () => {
    const { result } = renderHook(() => useOptimistic({ initialValue: 'old' }));

    await act(async () => {
      await result.current[2].execute(
        'optimistic',
        () => Promise.resolve('server-value' as any)
      );
    });

    expect(result.current[0]).toBe('server-value');
  });

  it('isPending is false after operation completes', async () => {
    const { result } = renderHook(() => useOptimistic({ initialValue: 0 }));

    expect(result.current[2].isPending).toBe(false);

    await act(async () => {
      await result.current[2].execute(
        1,
        () => Promise.resolve()
      );
    });

    expect(result.current[2].isPending).toBe(false);
    expect(result.current[0]).toBe(1);
  });

  it('clearError resets error state', async () => {
    const { result } = renderHook(() => useOptimistic({ initialValue: 0 }));

    await act(async () => {
      await result.current[2].execute(
        1,
        () => Promise.reject(new Error('fail'))
      );
    });

    expect(result.current[2].error).not.toBeNull();

    act(() => {
      result.current[2].clearError();
    });

    expect(result.current[2].error).toBeNull();
  });
});

describe('useOptimisticList', () => {
  const item1 = { id: '1', name: 'Item 1' };
  const item2 = { id: '2', name: 'Item 2' };

  it('initializes with empty array by default', () => {
    const { result } = renderHook(() => useOptimisticList());
    expect(result.current.items).toEqual([]);
  });

  it('addItem adds to front of list optimistically', async () => {
    const { result } = renderHook(() => useOptimisticList([item1]));

    await act(async () => {
      await result.current.addItem(
        item2,
        () => Promise.resolve()
      );
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].id).toBe('2');
  });

  it('removeItem removes by ID optimistically', async () => {
    const { result } = renderHook(() => useOptimisticList([item1, item2]));

    await act(async () => {
      await result.current.removeItem(
        '1',
        () => Promise.resolve()
      );
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('2');
  });

  it('removeItem rolls back on failure', async () => {
    const { result } = renderHook(() => useOptimisticList([item1, item2]));

    await act(async () => {
      await result.current.removeItem(
        '1',
        () => Promise.reject(new Error('fail'))
      );
    });

    expect(result.current.items).toHaveLength(2);
  });
});
