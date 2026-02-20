import { forwardRef } from 'react';
import { Play, Loader2, Mic, Crown, X, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarTemplate } from '@/types/avatar-templates';
import { Button } from '@/components/ui/button';

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
    if (!avatar || !open) return null;

    const imageUrl = avatar.front_image_url || avatar.face_image_url;

    return (
      /* Full-screen overlay */
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        onClick={() => onOpenChange(false)}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Sheet / Card */}
        <div
          ref={ref}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative w-full bg-zinc-950 border border-white/10 shadow-2xl",
            "flex flex-col overflow-hidden",
            // Mobile: bottom sheet
            "rounded-t-3xl max-h-[92dvh]",
            // Desktop: centered card
            "sm:rounded-2xl sm:max-w-lg sm:max-h-[85vh] sm:mx-4"
          )}
        >
          {/* Hero image with gradient overlay */}
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] flex-shrink-0 bg-zinc-900">
            {imageUrl && (
              <img
                src={imageUrl}
                alt={avatar.name}
                className="absolute inset-0 w-full h-full object-cover object-top"
              />
            )}
            {/* Bottom fade */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />

            {/* Close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* PRO badge */}
            {avatar.is_premium && (
              <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/90 backdrop-blur-sm">
                <Crown className="w-3 h-3 text-black" />
                <span className="text-[10px] font-bold text-black tracking-wider">PRO</span>
              </div>
            )}

            {/* Name + description overlaid on image bottom */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold text-white">{avatar.name}</h2>
                <Sparkles className="w-4 h-4 text-violet-400" />
              </div>
              {avatar.description && (
                <p className="text-sm text-white/60 line-clamp-1">{avatar.description}</p>
              )}
            </div>
          </div>

          {/* Scrollable info area */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">

            {/* Stat pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: avatar.style || 'Pro', sublabel: 'Style' },
                { label: avatar.gender, sublabel: 'Gender' },
                { label: avatar.age_range || '25–35', sublabel: 'Age' },
              ].map((item) => (
                <div
                  key={item.sublabel}
                  className="flex-1 min-w-[70px] px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-center"
                >
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">{item.sublabel}</p>
                  <p className="text-xs font-semibold text-white/80 capitalize">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Personality */}
            {avatar.personality && (
              <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Personality</p>
                <p className="text-sm text-white/70 leading-relaxed">{avatar.personality}</p>
              </div>
            )}

            {/* Voice row */}
            <div className={cn(
              "flex items-center justify-between px-4 py-3 rounded-xl border",
              isVoiceReady
                ? "bg-emerald-500/[0.08] border-emerald-500/20"
                : "bg-violet-500/[0.08] border-violet-500/20"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  isVoiceReady ? "bg-emerald-500/20" : "bg-violet-500/20"
                )}>
                  <Mic className={cn("w-4 h-4", isVoiceReady ? "text-emerald-400" : "text-violet-400")} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">{avatar.voice_name || 'Premium Voice'}</p>
                  <p className="text-[11px] text-white/40">{avatar.voice_description || 'Natural, professional tone'}</p>
                </div>
              </div>
              <button
                onClick={() => onPreviewVoice(avatar)}
                disabled={isPreviewingVoice}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  isVoiceReady
                    ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                    : "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                )}
              >
                {isPreviewingVoice
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Play className="w-3.5 h-3.5" />
                }
                {isPreviewingVoice ? 'Playing' : 'Preview'}
              </button>
            </div>

            {/* Tags */}
            {avatar.tags && avatar.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {avatar.tags.slice(0, 6).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/40 border border-white/[0.06]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Pinned CTA — always visible */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-white/[0.06] bg-zinc-950">
            <Button
              onClick={() => {
                onSelect(avatar);
                onOpenChange(false);
              }}
              className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white shadow-lg shadow-violet-500/25 gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Select {avatar.name}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

AvatarPreviewModal.displayName = 'AvatarPreviewModal';
