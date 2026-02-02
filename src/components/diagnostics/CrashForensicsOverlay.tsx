/**
 * CrashForensicsOverlay - On-screen crash diagnostics
 * 
 * Displays:
 * - Boot checkpoints (A0-A3)
 * - Crash loop status
 * - Memory signals
 * - Recent errors
 * - Safe mode status
 */

import { useState, useEffect, useCallback, memo } from 'react';
import { X, AlertTriangle, CheckCircle2, XCircle, Activity, Shield, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { crashForensics, getOverlayData, type Checkpoint } from '@/lib/crashForensics';
import { cn } from '@/lib/utils';

interface CrashForensicsOverlayProps {
  /** Always visible (for debugging) */
  alwaysShow?: boolean;
}

export const CrashForensicsOverlay = memo(function CrashForensicsOverlay({ 
  alwaysShow = false 
}: CrashForensicsOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(getOverlayData);
  
  // Only show in development or when explicitly enabled
  const isEnabled = process.env.NODE_ENV === 'development' || alwaysShow;
  
  // Update data periodically
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      setData(getOverlayData());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isOpen]);
  
  // Check if we should auto-open (crash detected)
  useEffect(() => {
    if (crashForensics.isCrashLoop() && isEnabled) {
      setIsOpen(true);
    }
  }, [isEnabled]);
  
  // Safe mode redirect
  const handleEnableSafeMode = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('safe', '1');
    window.location.href = url.toString();
  }, []);
  
  if (!isEnabled) return null;
  
  // Mini badge when closed
  if (!isOpen) {
    const hasErrors = data.errors.length > 0;
    const hasCrashLoop = crashForensics.isCrashLoop();
    const allPassed = crashForensics.allCheckpointsPassed();
    
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-4 left-4 z-[9999] p-2 rounded-full shadow-lg transition-colors",
          hasCrashLoop ? "bg-red-500 text-white animate-pulse" :
          hasErrors ? "bg-orange-500 text-white" :
          allPassed ? "bg-green-500 text-white" :
          "bg-gray-700 text-white"
        )}
        title="Crash Forensics"
      >
        <Activity className="w-4 h-4" />
        {(hasErrors || hasCrashLoop) && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full" />
        )}
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-4 left-4 z-[9999] w-96 max-h-[80vh] bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-700 overflow-hidden text-xs font-mono">
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white">Crash Forensics</span>
          {data.safeMode && (
            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px]">
              SAFE MODE
            </span>
          )}
        </div>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Content */}
      <div className="overflow-y-auto max-h-[calc(80vh-40px)] p-2 space-y-3">
        {/* Checkpoints */}
        <section>
          <h3 className="text-gray-400 mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Boot Checkpoints
          </h3>
          <div className="grid grid-cols-2 gap-1">
            {data.checkpoints.map((cp: Checkpoint) => (
              <div
                key={cp.id}
                className={cn(
                  "flex items-center gap-1 p-1 rounded",
                  cp.passed ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-400"
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
        {crashForensics.isCrashLoop() && (
          <section className="p-2 bg-red-500/20 border border-red-500/50 rounded">
            <div className="flex items-center gap-2 text-red-400 font-bold">
              <AlertTriangle className="w-4 h-4" />
              CRASH LOOP DETECTED
            </div>
            <p className="text-red-300 mt-1">
              Multiple crashes detected in short succession.
            </p>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleEnableSafeMode}
              className="mt-2 w-full text-xs h-7"
            >
              <Shield className="w-3 h-3 mr-1" />
              Enable Safe Mode
            </Button>
          </section>
        )}
        
        {/* Memory Signals */}
        {data.memorySignals.length > 0 && (
          <section>
            <h3 className="text-gray-400 mb-1">Memory Signals</h3>
            <div className="grid grid-cols-2 gap-1 text-gray-300">
              <div className="p-1 bg-gray-800 rounded">
                DOM: {data.memorySignals[data.memorySignals.length - 1]?.domNodes || 0}
              </div>
              <div className="p-1 bg-gray-800 rounded">
                Videos: {data.memorySignals[data.memorySignals.length - 1]?.videoElements || 0}
              </div>
              <div className="p-1 bg-gray-800 rounded">
                Intervals: {data.memorySignals[data.memorySignals.length - 1]?.intervals || 0}
              </div>
              <div className="p-1 bg-gray-800 rounded">
                Timeouts: {data.memorySignals[data.memorySignals.length - 1]?.timeouts || 0}
              </div>
            </div>
          </section>
        )}
        
        {/* Recent Errors */}
        {data.errors.length > 0 && (
          <section>
            <h3 className="text-gray-400 mb-1 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-400" />
              Recent Errors ({data.errors.length})
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {data.errors.slice(-5).reverse().map((err, i) => (
                <div key={i} className="p-1 bg-red-500/10 rounded text-red-300 break-words">
                  <span className="text-gray-500">
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
            <h3 className="text-gray-400 mb-1">Recent Routes</h3>
            <div className="space-y-0.5 max-h-20 overflow-y-auto">
              {data.routeChanges.slice(-5).reverse().map((r, i) => (
                <div key={i} className="text-gray-300">
                  <span className="text-gray-500">
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </span>{' '}
                  {r.from} → {r.to}
                </div>
              ))}
            </div>
          </section>
        )}
        
        {/* Session Info */}
        <section className="text-gray-500 border-t border-gray-700 pt-2">
          Session: {data.sessionId}
        </section>
      </div>
    </div>
  );
});

export default CrashForensicsOverlay;
