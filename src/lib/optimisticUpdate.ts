/**
 * Optimistic Update Utilities
 * 
 * Provides patterns for instant UI feedback while async operations complete.
 * Includes automatic rollback on failure and proper state reconciliation.
 */

import { toast } from 'sonner';

interface OptimisticUpdateOptions<T> {
  /** The async operation to perform */
  operation: () => Promise<T>;
  /** Callback to apply optimistic state immediately */
  onOptimistic: () => void;
  /** Callback to rollback on failure */
  onRollback: () => void;
  /** Callback on success with server response */
  onSuccess?: (result: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Context for error messages */
  context?: string;
  /** Show toast on success */
  successMessage?: string;
  /** Show toast on error (default: true) */
  showErrorToast?: boolean;
}

/**
 * Execute an async operation with optimistic UI update.
 * Immediately applies changes, then reconciles or rolls back based on result.
 */
export async function optimisticUpdate<T>({
  operation,
  onOptimistic,
  onRollback,
  onSuccess,
  onError,
  context,
  successMessage,
  showErrorToast = true,
}: OptimisticUpdateOptions<T>): Promise<T | null> {
  // Apply optimistic update immediately
  try {
    onOptimistic();
  } catch (e) {
    console.error('[OptimisticUpdate] Error applying optimistic state:', e);
  }

  try {
    const result = await operation();
    
    // Success - reconcile with server state if needed
    if (onSuccess) {
      onSuccess(result);
    }
    
    if (successMessage) {
      toast.success(successMessage);
    }
    
    return result;
  } catch (error) {
    // Failure - rollback to previous state
    try {
      onRollback();
    } catch (e) {
      console.error('[OptimisticUpdate] Error during rollback:', e);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Operation failed';
    
    if (showErrorToast) {
      toast.error(context ? `${context}: ${errorMessage}` : errorMessage);
    }
    
    if (onError) {
      onError(error instanceof Error ? error : new Error(errorMessage));
    }
    
    console.error(`[OptimisticUpdate${context ? ` - ${context}` : ''}]`, error);
    return null;
  }
}

/**
 * Create an optimistic list updater for common CRUD patterns.
 */
export function createOptimisticListUpdater<T extends { id: string }>() {
  return {
    /** Add item optimistically */
    add: (
      items: T[],
      newItem: T,
      setItems: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      const previousItems = [...items];
      setItems([newItem, ...items]);
      return {
        rollback: () => setItems(previousItems),
        previousItems,
      };
    },

    /** Remove item optimistically */
    remove: (
      items: T[],
      itemId: string,
      setItems: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      const previousItems = [...items];
      setItems(items.filter(item => item.id !== itemId));
      return {
        rollback: () => setItems(previousItems),
        previousItems,
      };
    },

    /** Update item optimistically */
    update: (
      items: T[],
      itemId: string,
      updates: Partial<T>,
      setItems: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      const previousItems = [...items];
      setItems(items.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ));
      return {
        rollback: () => setItems(previousItems),
        previousItems,
      };
    },

    /** Reorder items optimistically */
    reorder: (
      items: T[],
      fromIndex: number,
      toIndex: number,
      setItems: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      const previousItems = [...items];
      const reordered = [...items];
      const [removed] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, removed);
      setItems(reordered);
      return {
        rollback: () => setItems(previousItems),
        previousItems,
      };
    },
  };
}

/**
 * Hook-friendly wrapper for optimistic boolean toggles.
 */
export function createOptimisticToggle(
  value: boolean,
  setValue: React.Dispatch<React.SetStateAction<boolean>>
) {
  const previousValue = value;
  setValue(!value);
  return {
    rollback: () => setValue(previousValue),
    previousValue,
  };
}

/**
 * Create a debounced optimistic updater for rapid updates (e.g., form inputs).
 * Batches updates and only sends the final value after delay.
 */
export function createDebouncedOptimisticUpdater<T>(
  delayMs: number = 500
) {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingValue: T | null = null;

  return {
    update: (
      value: T,
      onOptimistic: (value: T) => void,
      onPersist: (value: T) => Promise<void>
    ) => {
      // Always apply optimistically
      onOptimistic(value);
      pendingValue = value;

      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Schedule persistence
      timeoutId = setTimeout(async () => {
        if (pendingValue !== null) {
          try {
            await onPersist(pendingValue);
          } catch (error) {
            console.error('[DebouncedOptimistic] Persist failed:', error);
          }
        }
        timeoutId = null;
        pendingValue = null;
      }, delayMs);
    },

    flush: async (onPersist: (value: T) => Promise<void>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (pendingValue !== null) {
        try {
          await onPersist(pendingValue);
        } catch (error) {
          console.error('[DebouncedOptimistic] Flush failed:', error);
        }
        pendingValue = null;
      }
    },

    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      pendingValue = null;
    },
  };
}
