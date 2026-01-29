import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Play, Loader2, Volume2, Sparkles, 
  User, Mic, Crown, Heart
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

interface AvatarPreviewModalProps {
  avatar: AvatarTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (avatar: AvatarTemplate) => void;
  onPreviewVoice: (avatar: AvatarTemplate) => void;
  isPreviewingVoice: boolean;
}

export const AvatarPreviewModal = forwardRef<HTMLDivElement, AvatarPreviewModalProps>(
  function AvatarPreviewModal({ 
    avatar, 
    open, 
    onOpenChange, 
    onSelect, 
    onPreviewVoice,
    isPreviewingVoice 
  }, ref) {
    if (!avatar) return null;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          ref={ref}
          className="sm:max-w-lg bg-black/95 border-white/[0.08] backdrop-blur-xl"
        >
          {/* Top shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <DialogHeader className="sr-only">
            <DialogTitle>{avatar.name} - Avatar Preview</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Avatar Image & Basic Info */}
            <div className="flex gap-5">
              {/* Large avatar image */}
              <div className="relative flex-shrink-0">
                <div className="w-28 h-28 rounded-2xl overflow-hidden border border-white/10">
                  <img
                    src={avatar.face_image_url}
                    alt={avatar.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {avatar.is_premium && (
                  <div className="absolute -top-2 -right-2">
                    <Badge className="bg-amber-500/90 text-black text-[10px] px-1.5 py-0.5">
                      <Crown className="w-3 h-3 mr-0.5" />
                      PRO
                    </Badge>
                  </div>
                )}
              </div>

              {/* Name & Quick Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-semibold text-white">{avatar.name}</h3>
                  <Sparkles className="w-4 h-4 text-violet-400" />
                </div>
                
                <p className="text-sm text-white/50 mb-3 line-clamp-2">
                  {avatar.description || 'Professional AI presenter ready to bring your content to life.'}
                </p>

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
              </div>
            </div>

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
            <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-violet-400" />
                  <span className="text-xs font-medium text-violet-300 uppercase tracking-wider">Voice</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPreviewVoice(avatar)}
                  disabled={isPreviewingVoice}
                  className="h-8 px-3 text-violet-300 hover:text-violet-200 hover:bg-violet-500/20"
                >
                  {isPreviewingVoice ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  ) : (
                    <Play className="w-4 h-4 mr-1.5" />
                  )}
                  {isPreviewingVoice ? 'Playing...' : 'Preview Voice'}
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white/80">{avatar.voice_name || 'Premium Voice'}</p>
                  <p className="text-xs text-white/40">{avatar.voice_description || 'Natural, professional tone'}</p>
                </div>
                <Volume2 className="w-5 h-5 text-violet-400/50" />
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
        </DialogContent>
      </Dialog>
    );
  }
);

AvatarPreviewModal.displayName = 'AvatarPreviewModal';
