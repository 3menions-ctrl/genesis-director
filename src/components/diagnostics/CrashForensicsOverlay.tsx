/**
 * CrashForensicsOverlay - On-screen crash diagnostics
 * 
 * ADMIN ONLY: Only visible to admin users for security.
 * 
 * Displays:
 * - Boot checkpoints (A0-A3)
 * - Crash loop status
 * - Memory signals
 * - Recent errors
 * - Safe mode status
 * - Reload loop detection
 */

import { useState, useEffect, useCallback, memo, forwardRef } from 'react';
import { X, AlertTriangle, CheckCircle2, XCircle, Activity, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { crashForensics, getOverlayData, type Checkpoint } from '@/lib/crashForensics';
import { getSafeModeStatus, autoEnableSafeMode } from '@/lib/safeMode';
import { cn } from '@/lib/utils';
import { useAdminAccess } from '@/hooks/useAdminAccess';

interface CrashForensicsOverlayProps {
  /** Always visible (for debugging) */
  alwaysShow?: boolean;
}

// Boot tracking for reload loop detection
const BOOT_KEY = 'crash_forensics_boot_times';
const BOOT_WINDOW_MS = 10000; // 10 seconds
const BOOT_THRESHOLD = 3; // 3 boots in 10 seconds = crash loop

function recordBoot(): { isLoop: boolean; count: number } {
  const now = Date.now();
  let boots: number[] = [];
  
  try {
    const stored = sessionStorage.getItem(BOOT_KEY);
    if (stored) {
      boots = JSON.parse(stored);
    }
  } catch {}
  
  // Add current boot
  boots.push(now);
  
  // Filter to only recent boots
  boots = boots.filter(t => now - t < BOOT_WINDOW_MS);
  
  // Store back
  try {
    sessionStorage.setItem(BOOT_KEY, JSON.stringify(boots));
  } catch {}
  
  return {
    isLoop: boots.length >= BOOT_THRESHOLD,
    count: boots.length,
  };
}

/**
 * Clear boot tracking - call when app successfully stabilizes
 */
function clearBootTracking(): void {
  try {
    sessionStorage.removeItem(BOOT_KEY);
  } catch {}
}

// Check boot status on module load
const bootStatus = typeof window !== 'undefined' ? recordBoot() : { isLoop: false, count: 0 };

// If reload loop detected and not already in safe mode, set safe mode WITHOUT reload
// CRITICAL: Using skipReload=true prevents infinite reload loops where the 
// crash detection itself causes more crashes
if (bootStatus.isLoop && !getSafeModeStatus() && typeof window !== 'undefined') {
  console.error('[CrashForensics] RELOAD LOOP DETECTED - enabling safe mode (no reload)');
  // Set safe mode flag but DON'T reload - let this render complete in safe mode
  autoEnableSafeMode(`Reload loop detected: ${bootStatus.count} boots in 10 seconds`, true);
}

export const CrashForensicsOverlay = memo(forwardRef<HTMLDivElement, CrashForensicsOverlayProps>(
  function CrashForensicsOverlay({ alwaysShow = false }, _ref) {
  const { isAdmin, loading: adminLoading } = useAdminAccess();
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(getOverlayData);
  const isSafeMode = getSafeModeStatus();
  
  // ADMIN ONLY: Only show to admin users (safe mode is the exception for recovery)
  const isEnabled = (isAdmin && !adminLoading) || (isSafeMode && alwaysShow);
  
  // Safe mode redirect
  const handleEnableSafeMode = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('safe', '1');
    window.location.href = url.toString();
  }, []);
  
  // Update data periodically
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      setData(getOverlayData());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isOpen]);
  
  // Check if we should auto-open (crash detected or safe mode)
  useEffect(() => {
    if ((crashForensics.isCrashLoop() || isSafeMode || bootStatus.isLoop) && isEnabled) {
      setIsOpen(true);
    }
  }, [isEnabled, isSafeMode]);
  
  // Clear boot tracking after app stabilizes (all checkpoints passed)
  useEffect(() => {
    const checkStability = () => {
      if (crashForensics.allCheckpointsPassed()) {
        clearBootTracking();
      }
    };
    
    // Check after a delay to ensure we've truly stabilized
    const timer = setTimeout(checkStability, 5000);
    return () => clearTimeout(timer);
  }, []);
  
  if (!isEnabled) return null;
  
  // Mini badge when closed
  if (!isOpen) {
    const hasErrors = data.errors.length > 0;
    const hasCrashLoop = crashForensics.isCrashLoop() || bootStatus.isLoop;
    const allPassed = crashForensics.allCheckpointsPassed();
    
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-4 left-4 z-[9999] p-2 rounded-full shadow-lg transition-colors",
          hasCrashLoop ? "bg-destructive text-destructive-foreground animate-pulse" :
          isSafeMode ? "bg-warning text-warning-foreground" :
          hasErrors ? "bg-destructive/80 text-destructive-foreground" :
          allPassed ? "bg-primary text-primary-foreground" :
          "bg-muted text-muted-foreground"
        )}
        title="Crash Forensics"
      >
        {isSafeMode ? <Shield className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
        {(hasErrors || hasCrashLoop) && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full" />
        )}
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-4 left-4 z-[9999] w-96 max-h-[80vh] bg-background/95 backdrop-blur-sm rounded-lg shadow-2xl border border-border overflow-hidden text-xs font-mono">
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-muted border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="font-bold text-foreground">Crash Forensics</span>
          {isSafeMode && (
            <span className="px-1.5 py-0.5 bg-warning/20 text-warning rounded text-[10px]">
              SAFE MODE
            </span>
          )}
          {bootStatus.isLoop && (
            <span className="px-1.5 py-0.5 bg-destructive/20 text-destructive rounded text-[10px]">
              LOOP: {bootStatus.count}x
            </span>
          )}
        </div>
        <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Content */}
      <div className="overflow-y-auto max-h-[calc(80vh-40px)] p-2 space-y-3">
        {/* Checkpoints */}
        <section>
          <h3 className="text-muted-foreground mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Boot Checkpoints
          </h3>
          <div className="grid grid-cols-2 gap-1">
            {data.checkpoints.map((cp: Checkpoint) => (
              <div
                key={cp.id}
                className={cn(
                  "flex items-center gap-1 p-1 rounded",
                  cp.passed ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {cp.passed ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                <span>{cp.id}: {cp.name}</span>
              </div>
            ))}
          </div>
        </section>
        
        {/* Crash Loop Status */}
        {(crashForensics.isCrashLoop() || bootStatus.isLoop) && (
          <section className="p-2 bg-destructive/20 border border-destructive/50 rounded">
            <div className="flex items-center gap-2 text-destructive font-bold">
              <AlertTriangle className="w-4 h-4" />
              CRASH LOOP DETECTED
            </div>
            <p className="text-destructive/80 mt-1">
              {bootStatus.isLoop 
                ? `${bootStatus.count} boots detected in 10 seconds`
                : 'Multiple crashes detected in short succession.'}
            </p>
            {!isSafeMode && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleEnableSafeMode}
                className="mt-2 w-full text-xs h-7"
              >
                <Shield className="w-3 h-3 mr-1" />
                Enable Safe Mode
              </Button>
            )}
          </section>
        )}
        
        {/* Memory Signals */}
        {data.memorySignals.length > 0 && (
          <section>
            <h3 className="text-muted-foreground mb-1">Memory Signals</h3>
            <div className="grid grid-cols-2 gap-1 text-foreground">
              <div className="p-1 bg-muted rounded">
                DOM: {data.memorySignals[data.memorySignals.length - 1]?.domNodes || 0}
              </div>
              <div className="p-1 bg-muted rounded">
                Videos: {data.memorySignals[data.memorySignals.length - 1]?.videoElements || 0}
              </div>
              <div className="p-1 bg-muted rounded">
                Intervals: {data.memorySignals[data.memorySignals.length - 1]?.intervals || 0}
              </div>
              <div className="p-1 bg-muted rounded">
                Timeouts: {data.memorySignals[data.memorySignals.length - 1]?.timeouts || 0}
              </div>
            </div>
          </section>
        )}
        
        {/* Recent Errors */}
        {data.errors.length > 0 && (
          <section>
            <h3 className="text-muted-foreground mb-1 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-destructive" />
              Recent Errors ({data.errors.length})
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {data.errors.slice(-5).reverse().map((err, i) => (
                <div key={i} className="p-1 bg-destructive/10 rounded text-destructive break-words">
                  <span className="text-muted-foreground">
                    {new Date(err.timestamp).toLocaleTimeString()}
                  </span>{' '}
                  {err.message.substring(0, 100)}
                  {err.message.length > 100 && '...'}
                </div>
              ))}
            </div>
          </section>
        )}
        
        {/* Route Changes */}
        {data.routeChanges.length > 0 && (
          <section>
            <h3 className="text-muted-foreground mb-1">Recent Routes</h3>
            <div className="space-y-0.5 max-h-20 overflow-y-auto">
              {data.routeChanges.slice(-5).reverse().map((r, i) => (
                <div key={i} className="text-foreground">
                  <span className="text-muted-foreground">
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </span>{' '}
                  {r.from} → {r.to}
                </div>
              ))}
            </div>
          </section>
        )}
        
        {/* Session Info */}
        <section className="text-muted-foreground border-t border-border pt-2">
          Session: {data.sessionId}
        </section>
      </div>
    </div>
  );
}));

CrashForensicsOverlay.displayName = 'CrashForensicsOverlay';

export default CrashForensicsOverlay;
