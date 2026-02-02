/**
 * SafeModeBanner - Shows when safe mode is active
 * 
 * Displays:
 * - Clear indicator that safe mode is active
 * - List of disabled features
 * - Recovery link to exit safe mode
 */

import { memo } from 'react';
import { AlertTriangle, Shield, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSafeModeBannerData, clearAutoSafeMode } from '@/lib/safeMode';

export const SafeModeBanner = memo(function SafeModeBanner() {
  const data = getSafeModeBannerData();
  
  if (!data?.active) return null;
  
  const handleExitSafeMode = () => {
    clearAutoSafeMode();
    // Navigate to URL without safe param
    window.location.href = data.recoveryUrl;
  };
  
  return (
    <div className="fixed top-0 left-0 right-0 z-[10000] bg-warning text-warning-foreground px-4 py-2 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-bold text-sm">Safe Mode Active</p>
            <p className="text-xs opacity-80">
              {data.reason}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 text-xs opacity-80">
            <AlertTriangle className="w-3 h-3" />
            <span>Video, polling, and animations disabled</span>
          </div>
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleExitSafeMode}
            className="text-xs h-7"
          >
            <X className="w-3 h-3 mr-1" />
            Exit Safe Mode
          </Button>
        </div>
      </div>
    </div>
  );
});

export default SafeModeBanner;
