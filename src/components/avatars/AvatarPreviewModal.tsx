import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, Loader2, Volume2, Sparkles, 
  User, Mic, Crown, Heart, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarTemplate } from '@/types/avatar-templates';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Avatar3DViewer from './Avatar3DViewer';

interface AvatarPreviewModalProps {
  avatar: AvatarTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (avatar: AvatarTemplate) => void;
  onPreviewVoice: (avatar: AvatarTemplate) => void;
  isPreviewingVoice: boolean;
  isVoiceReady?: boolean;
}

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
    if (!avatar) return null;

    const hasMultipleViews = avatar.side_image_url || avatar.back_image_url;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          ref={ref}
          className="sm:max-w-2xl bg-black/95 border-white/[0.08] backdrop-blur-xl p-0 overflow-hidden"
        >
          {/* Top shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <DialogHeader className="sr-only">
            <DialogTitle>{avatar.name} - Avatar Preview</DialogTitle>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-0">
            {/* Left: 3D Avatar Viewer */}
            <div className="relative aspect-[3/4] md:aspect-auto bg-gradient-to-b from-zinc-900/50 to-black">
              {hasMultipleViews ? (
                <Avatar3DViewer
                  frontImage={avatar.front_image_url || avatar.face_image_url}
                  sideImage={avatar.side_image_url}
                  backImage={avatar.back_image_url}
                  name={avatar.name}
                  className="w-full h-full min-h-[300px]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-6">
                  <div className="relative w-full max-w-[250px] aspect-[3/4] rounded-2xl overflow-hidden">
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
                <div className="absolute top-4 left-4">
                  <Badge className="bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs px-2 py-1">
                    <Crown className="w-3 h-3 mr-1" />
                    PRO
                  </Badge>
                </div>
              )}
              
              {hasMultipleViews && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 text-xs text-white/40">
                  <RotateCcw className="w-3 h-3" />
                  <span>Drag to rotate</span>
                </div>
              )}
            </div>

            {/* Right: Info Panel */}
            <div className="p-6 space-y-5">
              {/* Name & Quick Info */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-white">{avatar.name}</h3>
                  <Sparkles className="w-5 h-5 text-violet-400" />
                </div>
                
                <p className="text-sm text-white/50 leading-relaxed">
                  {avatar.description || 'Professional AI presenter ready to bring your content to life.'}
                </p>
              </div>

              {/* Tags */}
              {avatar.tags && avatar.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {avatar.tags.map((tag) => (
                    <span 
                      key={tag}
                      className="text-[10px] px-2 py-1 rounded-full bg-white/[0.05] text-white/50 border border-white/[0.08]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Personality Section */}
              {avatar.personality && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-4 h-4 text-pink-400" />
                    <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Personality</span>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">
                    {avatar.personality}
                  </p>
                </div>
              )}

              {/* Voice Section */}
              <div className={cn(
                "p-4 rounded-xl border",
                isVoiceReady 
                  ? "bg-emerald-500/10 border-emerald-500/20" 
                  : "bg-violet-500/10 border-violet-500/20"
              )}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Mic className={cn(
                      "w-4 h-4",
                      isVoiceReady ? "text-emerald-400" : "text-violet-400"
                    )} />
                    <span className={cn(
                      "text-xs font-medium uppercase tracking-wider",
                      isVoiceReady ? "text-emerald-300" : "text-violet-300"
                    )}>
                      {isVoiceReady ? 'Voice Ready' : 'Voice'}
                    </span>
                    {isVoiceReady && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
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
                      "h-8 px-3",
                      isVoiceReady 
                        ? "text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/20"
                        : "text-violet-300 hover:text-violet-200 hover:bg-violet-500/20"
                    )}
                  >
                    {isPreviewingVoice ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <Play className="w-4 h-4 mr-1.5" />
                    )}
                    {isPreviewingVoice ? 'Playing...' : isVoiceReady ? 'Play' : 'Preview Voice'}
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/80">{avatar.voice_name || 'Premium Voice'}</p>
                    <p className="text-xs text-white/40">{avatar.voice_description || 'Natural, professional tone'}</p>
                  </div>
                  <Volume2 className={cn(
                    "w-5 h-5",
                    isVoiceReady ? "text-emerald-400/50" : "text-violet-400/50"
                  )} />
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                  <p className="text-xs text-white/40 mb-1">Style</p>
                  <p className="text-sm font-medium text-white/80 capitalize">{avatar.style || 'Professional'}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                  <p className="text-xs text-white/40 mb-1">Gender</p>
                  <p className="text-sm font-medium text-white/80 capitalize">{avatar.gender}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                  <p className="text-xs text-white/40 mb-1">Age Range</p>
                  <p className="text-sm font-medium text-white/80">{avatar.age_range || '25-35'}</p>
                </div>
              </div>

              {/* Action Button */}
              <Button
                onClick={() => {
                  onSelect(avatar);
                  onOpenChange(false);
                }}
                className="w-full h-12 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-medium"
              >
                <User className="w-4 h-4 mr-2" />
                Select {avatar.name}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

AvatarPreviewModal.displayName = 'AvatarPreviewModal';
