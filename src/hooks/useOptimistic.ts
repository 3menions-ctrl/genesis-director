/**
 * useOptimistic - React hook for optimistic UI updates
 * 
 * Provides state management with automatic optimistic updates and rollback.
 */

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface UseOptimisticOptions<T> {
  /** Initial state value */
  initialValue: T;
  /** Context for error messages */
  context?: string;
}

interface OptimisticAction<T> {
  /** Apply optimistic update and execute async operation */
  execute: (
    optimisticValue: T,
    operation: () => Promise<T | void>,
    options?: {
      successMessage?: string;
      errorMessage?: string;
      onSuccess?: (result: T | void) => void;
      onError?: (error: Error) => void;
    }
  ) => Promise<boolean>;
  /** Whether an operation is in progress */
  isPending: boolean;
  /** Any error from the last operation */
  error: Error | null;
  /** Clear the error state */
  clearError: () => void;
}

export function useOptimistic<T>(
  options: UseOptimisticOptions<T>
): [T, React.Dispatch<React.SetStateAction<T>>, OptimisticAction<T>] {
  const { initialValue, context } = options;
  
  const [value, setValue] = useState<T>(initialValue);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Track previous value for rollback
  const previousValueRef = useRef<T>(initialValue);
  
  const clearError = useCallback(() => setError(null), []);

  const execute = useCallback(async (
    optimisticValue: T,
    operation: () => Promise<T | void>,
    operationOptions?: {
      successMessage?: string;
      errorMessage?: string;
      onSuccess?: (result: T | void) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<boolean> => {
    // Store current value for potential rollback
    previousValueRef.current = value;
    
    // Apply optimistic update immediately
    setValue(optimisticValue);
    setIsPending(true);
    setError(null);
    
    try {
      const result = await operation();
      
      // If operation returns a value, use it (server reconciliation)
      if (result !== undefined) {
        setValue(result as T);
      }
      
      if (operationOptions?.successMessage) {
        toast.success(operationOptions.successMessage);
      }
      
      if (operationOptions?.onSuccess) {
        operationOptions.onSuccess(result);
      }
      
      setIsPending(false);
      return true;
      
    } catch (err) {
      // Rollback to previous value
      setValue(previousValueRef.current);
      
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      
      const errorMessage = operationOptions?.errorMessage || 
        (context ? `${context}: ${errorObj.message}` : errorObj.message);
      
      toast.error(errorMessage);
      
      if (operationOptions?.onError) {
        operationOptions.onError(errorObj);
      }
      
      setIsPending(false);
      return false;
    }
  }, [value, context]);

  return [
    value,
    setValue,
    {
      execute,
      isPending,
      error,
      clearError,
    },
  ];
}

/**
 * Simpler hook for optimistic list operations
 */
export function useOptimisticList<T extends { id: string }>(
  initialItems: T[] = []
) {
  const [items, setItems, optimistic] = useOptimistic<T[]>({
    initialValue: initialItems,
    context: 'List operation',
  });

  const addItem = useCallback(async (
    newItem: T,
    persistOperation: () => Promise<T[] | void>,
    options?: { successMessage?: string }
  ) => {
    return optimistic.execute(
      [newItem, ...items],
      persistOperation,
      options
    );
  }, [items, optimistic]);

  const removeItem = useCallback(async (
    itemId: string,
    persistOperation: () => Promise<T[] | void>,
    options?: { successMessage?: string }
  ) => {
    return optimistic.execute(
      items.filter(item => item.id !== itemId),
      persistOperation,
      options
    );
  }, [items, optimistic]);

  const updateItem = useCallback(async (
    itemId: string,
    updates: Partial<T>,
    persistOperation: () => Promise<T[] | void>,
    options?: { successMessage?: string }
  ) => {
    return optimistic.execute(
      items.map(item => item.id === itemId ? { ...item, ...updates } : item),
      persistOperation,
      options
    );
  }, [items, optimistic]);

  return {
    items,
    setItems,
    addItem,
    removeItem,
    updateItem,
    isPending: optimistic.isPending,
    error: optimistic.error,
    clearError: optimistic.clearError,
  };
}

export default useOptimistic;
