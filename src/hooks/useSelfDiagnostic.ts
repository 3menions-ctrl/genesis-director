/**
 * useSelfDiagnostic - Early Warning System Hook
 * 
 * Verifies all required assets and permissions are present
 * before attempting a mount. Acts as a gatekeeper to prevent
 * cascading failures in critical features.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { logDiagnosticError } from '@/lib/diagnostics/DiagnosticsLogger';

export interface DiagnosticCheck {
  name: string;
  check: () => boolean | Promise<boolean>;
  required: boolean;
  retryable?: boolean;
}

export interface DiagnosticResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

export interface UseSelfDiagnosticOptions {
  /** Feature name for logging */
  featureName: string;
  /** List of diagnostic checks to run */
  checks: DiagnosticCheck[];
  /** Timeout for async checks in ms (default: 5000) */
  timeout?: number;
  /** Whether to retry failed checks (default: true) */
  autoRetry?: boolean;
  /** Maximum retry attempts (default: 2) */
  maxRetries?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
  /** Callback on all checks passed */
  onReady?: () => void;
  /** Callback on critical failure */
  onFailure?: (results: DiagnosticResult[]) => void;
}

export interface UseSelfDiagnosticReturn {
  /** Whether all required checks have passed */
  isReady: boolean;
  /** Whether diagnostics are currently running */
  isChecking: boolean;
  /** Array of diagnostic results */
  results: DiagnosticResult[];
  /** Count of failed checks */
  failedCount: number;
  /** Count of passed checks */
  passedCount: number;
  /** Any critical errors that occurred */
  criticalError: string | null;
  /** Manually trigger a re-check */
  recheck: () => Promise<void>;
}

export function useSelfDiagnostic(options: UseSelfDiagnosticOptions): UseSelfDiagnosticReturn {
  const {
    featureName,
    checks,
    timeout = 5000,
    autoRetry = false, // FIXED: Default to false to prevent retry loops
    maxRetries = 1,    // FIXED: Reduced from 2 to prevent cascade failures
    retryDelay = 1000,
    onReady,
    onFailure,
  } = options;
  
  const [isReady, setIsReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const hasCompletedRef = useRef(false);
  
  // FIX: Memoize checks array to prevent infinite re-render loop
  // The checks array identity must be stable or the useCallback will re-create runChecks
  const checksRef = useRef(checks);
  checksRef.current = checks;
  
  const runChecks = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setIsChecking(true);
    const checkResults: DiagnosticResult[] = [];
    
    // FIX: Use checksRef.current to avoid dependency on checks array identity
    const currentChecks = checksRef.current;
    
    for (const check of currentChecks) {
      if (!isMountedRef.current) return;
      
      const startTime = performance.now();
      let passed = false;
      let error: string | undefined;
      
      try {
        // Create timeout race
        const checkPromise = Promise.resolve(check.check());
        const timeoutPromise = new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Check timed out')), timeout)
        );
        
        passed = await Promise.race([checkPromise, timeoutPromise]);
      } catch (err) {
        passed = false;
        error = err instanceof Error ? err.message : String(err);
        
        // Log diagnostic error
        logDiagnosticError(
          `[${featureName}] Diagnostic check "${check.name}" failed: ${error}`,
          { source: 'component', metadata: { check: check.name, feature: featureName } }
        );
      }
      
      const duration = performance.now() - startTime;
      
      checkResults.push({
        name: check.name,
        passed,
        error,
        duration,
      });
    }
    
    if (!isMountedRef.current) return;
    
    setResults(checkResults);
    
    // Evaluate results - FIX: Use currentChecks instead of checks
    const requiredChecks = currentChecks.filter(c => c.required);
    const failedRequired = checkResults.filter(
      (r, i) => currentChecks[i]?.required && !r.passed
    );
    
    if (failedRequired.length === 0) {
      // All required checks passed
      setIsReady(true);
      setIsChecking(false);
      setCriticalError(null);
      hasCompletedRef.current = true;
      onReady?.();
    } else {
      // Some required checks failed
      const retryableFailures = failedRequired.filter(
        (r) => currentChecks.find(c => c.name === r.name)?.retryable !== false
      );
      
      if (autoRetry && retryableFailures.length > 0 && retryCountRef.current < maxRetries) {
        // Retry after delay
        retryCountRef.current++;
        setTimeout(() => {
          if (isMountedRef.current) {
            runChecks();
          }
        }, retryDelay);
      } else {
        // Max retries reached or not retryable
        const errorMessage = failedRequired
          .map(r => `${r.name}: ${r.error || 'Failed'}`)
          .join('; ');
        
        setCriticalError(errorMessage);
        setIsChecking(false);
        hasCompletedRef.current = true;
        
        logDiagnosticError(
          `[${featureName}] Critical diagnostic failure: ${errorMessage}`,
          { 
            source: 'component', 
            severity: 'error',
            metadata: { 
              feature: featureName, 
              failedChecks: failedRequired.map(r => r.name) 
            } 
          }
        );
        
        onFailure?.(checkResults);
      }
    }
  // FIX: Removed 'checks' from dependencies - using checksRef.current instead
  // This prevents infinite loops when checks array is recreated each render
  }, [featureName, timeout, autoRetry, maxRetries, retryDelay, onReady, onFailure]);
  
  // Run checks on mount
  useEffect(() => {
    isMountedRef.current = true;
    hasCompletedRef.current = false;
    retryCountRef.current = 0;
    
    runChecks();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [runChecks]);
  
  const recheck = useCallback(async () => {
    retryCountRef.current = 0;
    hasCompletedRef.current = false;
    setIsReady(false);
    setCriticalError(null);
    await runChecks();
  }, [runChecks]);
  
  return {
    isReady,
    isChecking,
    results,
    failedCount: results.filter(r => !r.passed).length,
    passedCount: results.filter(r => r.passed).length,
    criticalError,
    recheck,
  };
}

/**
 * Pre-built diagnostic checks for common scenarios
 */
export const commonDiagnosticChecks = {
  /**
   * Check if user is authenticated
   */
  isAuthenticated: (getUser: () => unknown): DiagnosticCheck => ({
    name: 'Authentication',
    check: () => !!getUser(),
    required: true,
    retryable: true,
  }),
  
  /**
   * Check if a required API is reachable
   */
  apiReachable: (url: string): DiagnosticCheck => ({
    name: `API Reachable (${url})`,
    check: async () => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
      } catch {
        return false;
      }
    },
    required: true,
    retryable: true,
  }),
  
  /**
   * Check if required data is loaded
   */
  dataLoaded: (name: string, getData: () => unknown): DiagnosticCheck => ({
    name: `Data Loaded (${name})`,
    check: () => {
      const data = getData();
      return data !== null && data !== undefined;
    },
    required: true,
    retryable: true,
  }),
  
  /**
   * Check if required permission exists
   */
  hasPermission: (name: string, checkPermission: () => boolean): DiagnosticCheck => ({
    name: `Permission (${name})`,
    check: checkPermission,
    required: true,
    retryable: false,
  }),
  
  /**
   * Check if required credits are available
   */
  hasCredits: (getCredits: () => number, minRequired: number): DiagnosticCheck => ({
    name: `Credits Available (min: ${minRequired})`,
    check: () => getCredits() >= minRequired,
    required: false, // Usually a warning, not blocking
    retryable: true,
  }),
  
  /**
   * Check if browser supports required feature
   */
  browserSupport: (featureName: string, check: () => boolean): DiagnosticCheck => ({
    name: `Browser Support (${featureName})`,
    check,
    required: true,
    retryable: false,
  }),
};

export default useSelfDiagnostic;
