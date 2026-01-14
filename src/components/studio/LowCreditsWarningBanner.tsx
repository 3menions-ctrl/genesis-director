import { useState } from 'react';
import { AlertTriangle, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStudio } from '@/contexts/StudioContext';
import { cn } from '@/lib/utils';

const LOW_CREDITS_THRESHOLD = 10;

export function LowCreditsWarningBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { credits } = useStudio();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if not logged in, dismissed, or has enough credits
  if (!user || isDismissed || credits.remaining >= LOW_CREDITS_THRESHOLD) {
    return null;
  }

  const isOutOfCredits = credits.remaining === 0;

  return (
    <div className={cn(
      "relative w-full px-4 py-3 flex items-center justify-between gap-4",
      isOutOfCredits 
        ? "bg-red-500/10 border-b border-red-500/20" 
        : "bg-amber-500/10 border-b border-amber-500/20"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          isOutOfCredits ? "bg-red-500/20" : "bg-amber-500/20"
        )}>
          <AlertTriangle className={cn(
            "w-4 h-4",
            isOutOfCredits ? "text-red-400" : "text-amber-400"
          )} />
        </div>
        <div>
          <p className={cn(
            "text-sm font-medium",
            isOutOfCredits ? "text-red-200" : "text-amber-200"
          )}>
            {isOutOfCredits 
              ? "You're out of credits!" 
              : `Low credits warning: ${credits.remaining} remaining`
            }
          </p>
          <p className="text-xs text-white/50">
            {isOutOfCredits 
              ? "Purchase credits to continue generating videos."
              : "You may not have enough credits to complete your next video."
            }
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          onClick={() => navigate('/profile')}
          size="sm"
          className={cn(
            "gap-1.5 h-8 text-xs font-medium",
            isOutOfCredits 
              ? "bg-red-500 hover:bg-red-600 text-white" 
              : "bg-amber-500 hover:bg-amber-600 text-black"
          )}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Get Credits
        </Button>
        <Button
          onClick={() => setIsDismissed(true)}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-white/10 text-white/40 hover:text-white/70"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
