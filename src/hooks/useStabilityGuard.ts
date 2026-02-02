/**
 * @deprecated MIGRATION SHIM - Import from '@/lib/navigation' instead
 * 
 * This file now re-exports from the unified navigation system.
 * All functionality has been consolidated into src/lib/navigation/unifiedHooks.ts
 * 
 * Migration: Change imports to:
 * import { useStabilityGuard, useMountSafe, useSafeState, useDebouncedValue, isAbortError } from '@/lib/navigation';
 */

export {
  useStabilityGuard,
  useMountSafe,
  useSafeState,
  useDebouncedValue,
  isAbortError,
} from '@/lib/navigation';
