/**
 * @deprecated MIGRATION SHIM - Import from '@/lib/navigation' instead
 * 
 * This file now re-exports from the unified navigation system.
 * All functionality has been consolidated into src/lib/navigation/unifiedHooks.ts
 * 
 * Migration: Change imports to:
 * import { useStabilityGuard, useMountSafe } from '@/lib/navigation';
 */

export {
  useStabilityGuard as useNavigationGuard,
  useMountSafe as useMountGuard,
} from '@/lib/navigation';

// Legacy export for usePollingGuard - implement inline for backwards compat
import { useRef, useEffect } from 'react';
import { useStabilityGuard } from '@/lib/navigation';

/**
 * @deprecated Use useStabilityGuard with safeInterval instead
 */
export function usePollingGuard(callback: () => void, intervalMs: number, enabled: boolean = true) {
  const { isMounted, safeInterval, clearSafeInterval } = useStabilityGuard();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (enabled && isMounted()) {
      intervalRef.current = safeInterval(callback, intervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearSafeInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, callback, intervalMs, isMounted, safeInterval, clearSafeInterval]);
}
