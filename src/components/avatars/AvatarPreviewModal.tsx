import { forwardRef } from 'react';
import { 
  Play, Loader2, Volume2, Sparkles, 
  User, Mic, Crown, Heart, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarTemplate } from '@/types/avatar-templates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Avatar3DViewer from './Avatar3DViewer';
import { useIsMobile } from '@/hooks/use-mobile';

interface AvatarPreviewModalProps {
  avatar: AvatarTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (avatar: AvatarTemplate) => void;
  onPreviewVoice: (avatar: AvatarTemplate) => void;
  isPreviewingVoice: boolean;
  isVoiceReady?: boolean;
}

// STABILITY: Removed framer-motion - Dialogs handle their own animations
export const AvatarPreviewModal = forwardRef<HTMLDivElement, AvatarPreviewModalProps>(
  function AvatarPreviewModal({ 
    avatar, 
    open, 
    onOpenChange, 
    onSelect, 
    onPreviewVoice,
    isPreviewingVoice,
    isVoiceReady = false,
  }, ref) {
    const isMobile = useIsMobile();
    
    if (!avatar) return null;

    const hasMultipleViews = avatar.side_image_url || avatar.back_image_url;

    return (
      <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
        <DialogContent 
          ref={ref}
          variant={isMobile ? "sheet" : "default"}
          hideCloseButton={isMobile}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className={cn(
            "bg-black/95 border-white/[0.08] backdrop-blur-xl p-0 overflow-hidden",
            isMobile && "max-h-[85vh] overflow-y-auto",
            !isMobile && "sm:max-w-2xl max-h-[90vh] overflow-y-auto"
          )}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{avatar.name} - Avatar Preview</DialogTitle>
            <DialogDescription>Preview and select this avatar for your video</DialogDescription>
          </DialogHeader>

          {/* Mobile: Stack vertically, Desktop: Side by side */}
          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-0">
            {/* Avatar Image/Viewer - Compact on mobile */}
            <div className="relative aspect-[4/3] sm:aspect-auto bg-gradient-to-b from-zinc-900/50 to-black">
              {hasMultipleViews ? (
                <Avatar3DViewer
                  frontImage={avatar.front_image_url || avatar.face_image_url}
                  sideImage={avatar.side_image_url}
                  backImage={avatar.back_image_url}
                  name={avatar.name}
                  className="w-full h-full min-h-[200px] sm:min-h-[300px]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4 sm:p-6">
                  <div className="relative w-full max-w-[180px] sm:max-w-[250px] aspect-[3/4] rounded-xl sm:rounded-2xl overflow-hidden">
                    <img
                      src={avatar.front_image_url || avatar.face_image_url}
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                </div>
              )}
              
              {avatar.is_premium && (
                <div className="absolute top-3 sm:top-4 left-3 sm:left-4">
                  <Badge className="bg-gradient-to-r from-amber-500 to-amber-400 text-black text-[10px] sm:text-xs px-2 py-0.5 sm:py-1">
                    <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
                    PRO
                  </Badge>
                </div>
              )}
              
              {hasMultipleViews && (
                <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 flex items-center gap-2 text-[10px] sm:text-xs text-white/40">
                  <RotateCcw className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span>Drag to rotate</span>
                </div>
              )}
            </div>

            {/* Info Panel - Compact on mobile */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 animate-fade-in">
              {/* Name & Quick Info */}
              <div>
                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-white">{avatar.name}</h3>
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400" />
                </div>
                
                <p className="text-xs sm:text-sm text-white/50 leading-relaxed line-clamp-2 sm:line-clamp-none">
                  {avatar.description || 'Professional AI presenter ready to bring your content to life.'}
                </p>
              </div>

              {/* Tags - Hidden on very small screens */}
              {avatar.tags && avatar.tags.length > 0 && (
                <div className="hidden xs:flex flex-wrap gap-1.5">
                  {avatar.tags.slice(0, 4).map((tag) => (
                    <span 
                      key={tag}
                      className="text-[9px] sm:text-[10px] px-2 py-0.5 sm:py-1 rounded-full bg-white/[0.05] text-white/50 border border-white/[0.08]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Personality Section - Collapsed on mobile */}
              {avatar.personality && (
                <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                    <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400" />
                    <span className="text-[10px] sm:text-xs font-medium text-white/70 uppercase tracking-wider">Personality</span>
                  </div>
                  <p className="text-xs sm:text-sm text-white/60 leading-relaxed line-clamp-2 sm:line-clamp-none">
                    {avatar.personality}
                  </p>
                </div>
              )}

              {/* Voice Section */}
              <div className={cn(
                "p-3 sm:p-4 rounded-lg sm:rounded-xl border",
                isVoiceReady 
                  ? "bg-emerald-500/10 border-emerald-500/20" 
                  : "bg-violet-500/10 border-violet-500/20"
              )}>
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-2">
                    <Mic className={cn(
                      "w-3.5 h-3.5 sm:w-4 sm:h-4",
                      isVoiceReady ? "text-emerald-400" : "text-violet-400"
                    )} />
                    <span className={cn(
                      "text-[10px] sm:text-xs font-medium uppercase tracking-wider",
                      isVoiceReady ? "text-emerald-300" : "text-violet-300"
                    )}>
                      {isVoiceReady ? 'Voice Ready' : 'Voice'}
                    </span>
                    {isVoiceReady && (
                      <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Instant
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPreviewVoice(avatar)}
                    disabled={isPreviewingVoice}
                    className={cn(
                      "h-7 sm:h-8 px-2.5 sm:px-3 text-xs",
                      isVoiceReady 
                        ? "text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/20"
                        : "text-violet-300 hover:text-violet-200 hover:bg-violet-500/20"
                    )}
                  >
                    {isPreviewingVoice ? (
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin mr-1" />
                    ) : (
                      <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                    )}
                    {isPreviewingVoice ? 'Playing...' : isVoiceReady ? 'Play' : 'Preview'}
                  </Button>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-white/80 truncate">{avatar.voice_name || 'Premium Voice'}</p>
                    <p className="text-[10px] sm:text-xs text-white/40 truncate">{avatar.voice_description || 'Natural, professional tone'}</p>
                  </div>
                  <Volume2 className={cn(
                    "w-4 h-4 sm:w-5 sm:h-5 shrink-0",
                    isVoiceReady ? "text-emerald-400/50" : "text-violet-400/50"
                  )} />
                </div>
              </div>

              {/* Details Grid - 2 cols on mobile, 3 on desktop */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="p-2 sm:p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                  <p className="text-[10px] sm:text-xs text-white/40 mb-0.5 sm:mb-1">Style</p>
                  <p className="text-xs sm:text-sm font-medium text-white/80 capitalize truncate">{avatar.style || 'Pro'}</p>
                </div>
                <div className="p-2 sm:p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                  <p className="text-[10px] sm:text-xs text-white/40 mb-0.5 sm:mb-1">Gender</p>
                  <p className="text-xs sm:text-sm font-medium text-white/80 capitalize truncate">{avatar.gender}</p>
                </div>
                <div className="p-2 sm:p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                  <p className="text-[10px] sm:text-xs text-white/40 mb-0.5 sm:mb-1">Age</p>
                  <p className="text-xs sm:text-sm font-medium text-white/80 truncate">{avatar.age_range || '25-35'}</p>
                </div>
              </div>

              {/* Action Button - Full width, sticky on mobile */}
              <div className="pt-2 sm:pt-0">
                <Button
                  onClick={() => {
                    onSelect(avatar);
                    onOpenChange(false);
                  }}
                  className="w-full h-11 sm:h-12 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-medium text-sm sm:text-base"
                >
                  <User className="w-4 h-4 mr-2" />
                  Select {avatar.name}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

AvatarPreviewModal.displayName = 'AvatarPreviewModal';
