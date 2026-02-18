import { forwardRef, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Square, 
  Clock, 
  Coins, 
  Layers,
  Loader2,
  Zap,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  getCreditWarningLevel,
  TIPS_MESSAGES,
  showOnce,
} from '@/lib/smartMessages';


interface StickyGenerateBarProps {
  isRunning: boolean;
  isComplete: boolean;
  isError: boolean;
  progress: number;
  totalDuration: number;
  clipCount: number;
  estimatedCredits: number;
  userCredits: number;
  elapsedTime: number;
  completedClips: number;
  onGenerate: () => void;
  onCancel: () => void;
  onBuyCredits?: () => void;
  disabled?: boolean;
  currentStage?: string;
  pipelineLogs?: unknown[];
  isInitializing?: boolean;
}

const STAGE_MESSAGES: Record<string, { label: string; icon: string }> = {
  'preproduction': { label: 'Preparing production...', icon: '🎬' },
  'awaiting_approval': { label: 'Script ready for review', icon: '📋' },
  'qualitygate': { label: 'Running quality checks...', icon: '🔍' },
  'assets': { label: 'Creating assets...', icon: '🎨' },
  'production': { label: 'Generating video clips...', icon: '🎥' },
  'postproduction': { label: 'Finalizing video...', icon: '✨' },
  'complete': { label: 'Complete!', icon: '✅' },
  'error': { label: 'Error occurred', icon: '❌' },
};

export const StickyGenerateBar = forwardRef<HTMLDivElement, StickyGenerateBarProps>(
  function StickyGenerateBar({
    isRunning,
    isComplete,
    isError,
    progress,
    totalDuration,
    clipCount,
    estimatedCredits,
    userCredits,
    elapsedTime,
    completedClips,
    onGenerate,
    onCancel,
    onBuyCredits,
    disabled,
    currentStage = 'idle',
    isInitializing = false,
  }, ref) {
  const [statusText, setStatusText] = useState('Initializing...');
  const navigate = useNavigate();
  const hasShownClipWarning = useRef(false);
  
  const hasInsufficientCredits = userCredits < estimatedCredits;
  const creditShortfall = Math.max(0, estimatedCredits - userCredits);
  const creditLevel = getCreditWarningLevel(userCredits, estimatedCredits);
   
  // Show high clip count warning once when user has many clips
  useEffect(() => {
    if (!hasShownClipWarning.current && clipCount >= 8 && !isRunning) {
      hasShownClipWarning.current = true;
      showOnce(TIPS_MESSAGES.HIGH_CLIP_COUNT_WARNING(clipCount), navigate);
    }
  }, [clipCount, isRunning, navigate]);
  
  // Animate status text based on progress
  useEffect(() => {
    if (!isRunning) return;
    
    const stageInfo = STAGE_MESSAGES[currentStage];
    if (stageInfo) {
      setStatusText(`${stageInfo.icon} ${stageInfo.label}`);
    } else if (progress < 10) {
      setStatusText('🚀 Starting pipeline...');
    } else if (progress < 20) {
      setStatusText('📝 Generating script...');
    } else if (progress < 35) {
      setStatusText('🔍 Analyzing content...');
    } else if (progress < 50) {
      setStatusText('🎨 Creating assets...');
    } else if (progress < 85) {
      setStatusText(`🎥 Rendering clips (${completedClips}/${clipCount})...`);
    } else {
      setStatusText('✨ Finalizing video...');
    }
  }, [isRunning, progress, currentStage, completedClips, clipCount]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Don't show if complete or error
  if (isComplete || isError) return null;

  return (
    <div ref={ref} className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      {/* Stage progress zone — calm, minimal */}
      {isRunning && (
        <div
          className="border-t px-6 py-3"
          style={{
            background: 'hsl(250 15% 4% / 0.97)',
            borderColor: 'hsl(263 65% 58% / 0.1)',
          }}
        >
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            <span className="text-base leading-none shrink-0">
              {STAGE_MESSAGES[currentStage]?.icon ?? '⚡'}
            </span>
            <span className="text-xs font-medium text-foreground/80 truncate min-w-0">
              {STAGE_MESSAGES[currentStage]?.label ?? 'Processing…'}
            </span>
            <div
              className="flex-1 rounded-full overflow-hidden"
              style={{ height: 3, background: 'hsl(263 65% 58% / 0.12)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'hsl(263 65% 60%)' }}
                animate={{ width: `${Math.max(2, progress)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
              {Math.round(progress)}% · {formatTime(elapsedTime)}
            </span>
          </div>
        </div>
      )}

      {/* Main Bottom Bar */}
      <div
        className="relative border-t"
        style={{
          background: 'hsl(250 15% 4% / 0.97)',
          borderColor: 'hsl(263 70% 58% / 0.12)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 -4px 40px hsl(263 70% 58% / 0.08)',
        }}
      >
        {/* Progress bar at top of bar — no shimmer, clean */}
        {isRunning && (
          <div className="h-[2px] overflow-hidden" style={{ background: 'hsl(250 12% 12%)' }}>
            <motion.div
              className="h-full"
              style={{ background: 'hsl(263 65% 58%)' }}
              animate={{ width: `${Math.max(1, progress)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        )}
        
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Stats & Status */}
            <div className="flex items-center gap-3">
              {/* Running state — minimal elegant status */}
              {isRunning && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3"
                >
                  {/* Animated orb */}
                  <div className="relative w-8 h-8">
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ background: 'hsl(263 70% 58% / 0.2)' }}
                      animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <div
                      className="absolute inset-0 rounded-full flex items-center justify-center"
                      style={{ background: 'hsl(263 70% 58% / 0.15)', border: '1px solid hsl(263 70% 58% / 0.3)' }}
                    >
                      <Zap className="w-3.5 h-3.5" style={{ color: 'hsl(263 70% 65%)' }} />
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <p className="text-xs font-medium" style={{ color: 'hsl(240 5% 85%)' }}>
                      {Math.round(progress)}% · {formatTime(elapsedTime)}
                    </p>
                    <p className="text-[10px]" style={{ color: 'hsl(240 5% 45%)' }}>
                      Watch the bubbles ✦
                    </p>
                  </div>
                </motion.div>
              )}
              
              {/* Static stats when not running */}
              {!isRunning && (
                <>
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: 'hsl(250 12% 10%)', border: '1px solid hsl(250 15% 16%)' }}>
                    <Clock className="w-4 h-4" style={{ color: 'hsl(240 5% 45%)' }} />
                    <span className="font-medium" style={{ color: 'hsl(240 5% 80%)' }}>{totalDuration}s</span>
                  </div>
                  
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: 'hsl(250 12% 10%)', border: '1px solid hsl(250 15% 16%)' }}>
                    <Layers className="w-4 h-4" style={{ color: 'hsl(240 5% 45%)' }} />
                    <span className="font-medium" style={{ color: 'hsl(240 5% 80%)' }}>{clipCount} clips</span>
                  </div>

                  {/* Render time estimate */}
                  <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: 'hsl(48 100% 60% / 0.08)', border: '1px solid hsl(48 100% 60% / 0.2)' }}>
                    <Clock className="w-4 h-4" style={{ color: 'hsl(48 100% 55%)' }} />
                    <span className="font-medium" style={{ color: 'hsl(48 100% 55%)' }}>~{Math.ceil(clipCount * 3)} min</span>
                    <span className="text-xs" style={{ color: 'hsl(240 5% 45%)' }}>(2-4 min/clip)</span>
                  </div>
                  
                  {/* Credits badge */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                    style={{
                      background: 'linear-gradient(135deg, hsl(263 70% 58% / 0.15), hsl(195 90% 50% / 0.1))',
                      border: '1px solid hsl(263 70% 58% / 0.25)',
                    }}>
                    <Coins className="w-4 h-4" style={{ color: 'hsl(263 70% 65%)' }} />
                    <span className="font-semibold" style={{ color: 'hsl(263 70% 75%)' }}>~{estimatedCredits}</span>
                  </div>
                </>
              )}
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-3">
              {isRunning && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="gap-2 h-9 px-5 rounded-xl font-medium transition-all"
                  style={{
                    color: 'hsl(0 84% 60%)',
                    border: '1px solid hsl(0 84% 60% / 0.25)',
                    background: 'hsl(0 84% 60% / 0.08)',
                  }}
                >
                  <Square className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cancel</span>
                </Button>
              )}
              
              {!isRunning && (
                <div className="flex items-center gap-3">
                  {/* Insufficient credits warning */}
                  {(creditLevel === 'critical' || creditLevel === 'empty') && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl"
                      style={{
                        background: 'hsl(0 84% 60% / 0.08)',
                        border: '1px solid hsl(0 84% 60% / 0.2)',
                      }}
                    >
                      <AlertCircle className="w-4 h-4" style={{ color: 'hsl(0 84% 60%)' }} />
                      <span className="text-sm font-medium" style={{ color: 'hsl(0 84% 60%)' }}>
                        Need {creditShortfall} more credits
                      </span>
                    </motion.div>
                  )}
                  
                  {/* Low credits warning */}
                  {creditLevel === 'low' && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl"
                      style={{
                        background: 'hsl(48 100% 60% / 0.08)',
                        border: '1px solid hsl(48 100% 60% / 0.2)',
                      }}
                    >
                      <AlertCircle className="w-4 h-4" style={{ color: 'hsl(48 100% 55%)' }} />
                      <span className="text-sm font-medium" style={{ color: 'hsl(48 100% 55%)' }}>
                        Low credits: {userCredits} remaining
                      </span>
                    </motion.div>
                  )}
                   
                  {/* Buy Credits button */}
                  {(creditLevel === 'critical' || creditLevel === 'empty') && onBuyCredits && (
                    <Button
                      variant="outline"
                      onClick={onBuyCredits}
                      className="gap-2 h-11 px-6 rounded-xl"
                      style={{
                        borderColor: 'hsl(263 70% 58% / 0.4)',
                        color: 'hsl(263 70% 65%)',
                        background: 'hsl(263 70% 58% / 0.08)',
                      }}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Buy Credits</span>
                    </Button>
                  )}
                  
                  {/* Generate button */}
                  <Button
                    onClick={onGenerate}
                    disabled={disabled || isInitializing || hasInsufficientCredits}
                    className={cn(
                      "gap-2 h-11 px-8 font-semibold rounded-xl relative overflow-hidden group transition-all",
                      isInitializing && "cursor-wait",
                      hasInsufficientCredits && "opacity-40 cursor-not-allowed"
                    )}
                    style={!hasInsufficientCredits && !isInitializing ? {
                      background: 'linear-gradient(135deg, hsl(263 70% 55%), hsl(280 60% 60%))',
                      boxShadow: '0 4px 24px hsl(263 70% 58% / 0.35)',
                      border: '1px solid hsl(263 70% 65% / 0.3)',
                      color: 'hsl(0 0% 100%)',
                    } : {
                      background: 'hsl(250 12% 14%)',
                      border: '1px solid hsl(250 15% 20%)',
                      color: 'hsl(240 5% 55%)',
                    }}
                  >
                    {/* Shimmer on hover */}
                    {!hasInsufficientCredits && !isInitializing && (
                      <div
                        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                        style={{
                          background: 'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.15), transparent)',
                        }}
                      />
                    )}

                    {isInitializing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Preparing...</span>
                      </>
                    ) : hasInsufficientCredits ? (
                      <>
                        <AlertCircle className="w-5 h-5" />
                        <span>Insufficient Credits</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>Generate Video</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
