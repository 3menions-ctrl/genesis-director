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
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        {/* Sheet / Card */}
        <div
          ref={ref}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative w-full flex flex-col overflow-hidden",
            // Mobile: bottom sheet
            "rounded-t-3xl max-h-[92dvh]",
            // Desktop: centered card
            "sm:rounded-2xl sm:max-w-lg sm:max-h-[85vh] sm:mx-4"
          )}
          style={{
            background: 'linear-gradient(180deg, hsla(220,14%,5%,0.92) 0%, hsla(220,14%,3%,0.96) 100%)',
            backdropFilter: 'blur(48px) saturate(180%)',
            WebkitBackdropFilter: 'blur(48px) saturate(180%)',
            boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.06), 0 40px 80px -20px hsla(0,0%,0%,0.7), 0 0 0 1px hsla(0,0%,100%,0.04)',
          }}
        >
          {/* Hero image with gradient overlay */}
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] flex-shrink-0 bg-[hsl(220,14%,5%)]">
            {imageUrl && (
              <img
                src={imageUrl}
                alt={avatar.name}
                className="absolute inset-0 w-full h-full object-cover object-top"
              />
            )}
            {/* Bottom fade */}
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,14%,3%)] via-[hsl(220,14%,3%)]/50 to-transparent" />

            {/* Close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all"
              style={{ boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.08), 0 2px 12px hsla(0,0%,0%,0.4)' }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* PRO badge */}
            {avatar.is_premium && (
              <div
                className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, hsla(215,100%,62%,0.95), hsla(215,100%,52%,0.95))',
                  boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.25), 0 4px 16px hsla(215,100%,55%,0.4)',
                }}
              >
                <Crown className="w-3 h-3 text-white" />
                <span className="text-[10px] font-semibold text-white tracking-[0.18em] uppercase">Pro</span>
              </div>
            )}

            {/* Name + description overlaid on image bottom */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <h2 className="text-2xl font-light text-white tracking-tight">{avatar.name}</h2>
                <Sparkles className="w-4 h-4 text-[hsl(215,100%,72%)]" style={{ filter: 'drop-shadow(0 0 8px hsla(215,100%,55%,0.6))' }} />
              </div>
              {avatar.description && (
                <p className="text-sm text-white/55 line-clamp-1 font-light">{avatar.description}</p>
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
                  className="flex-1 min-w-[70px] px-3 py-2.5 rounded-2xl text-center"
                  style={{
                    background: 'hsla(0,0%,100%,0.025)',
                    boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05), inset 0 1px 0 hsla(0,0%,100%,0.04)',
                  }}
                >
                  <p className="text-[9px] text-white/35 uppercase tracking-[0.18em] mb-1 font-light">{item.sublabel}</p>
                  <p className="text-xs font-medium text-white/85 capitalize tracking-tight">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Personality */}
            {avatar.personality && (
              <div
                className="px-4 py-3 rounded-2xl"
                style={{
                  background: 'hsla(0,0%,100%,0.02)',
                  boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.04)',
                }}
              >
                <p className="text-[9px] text-white/35 uppercase tracking-[0.18em] mb-1.5 font-light">Personality</p>
                <p className="text-sm text-white/70 leading-relaxed font-light">{avatar.personality}</p>
              </div>
            )}

            {/* Voice row */}
            <div
              className="flex items-center justify-between px-4 py-3 rounded-2xl"
              style={{
                background: 'hsla(215,100%,55%,0.06)',
                boxShadow: 'inset 0 0 0 1px hsla(215,100%,55%,0.18), inset 0 1px 0 hsla(215,100%,80%,0.08)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, hsla(215,100%,62%,0.25), hsla(215,100%,52%,0.18))',
                    boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.12), 0 0 12px hsla(215,100%,55%,0.25)',
                  }}
                >
                  <Mic className="w-4 h-4 text-[hsl(215,100%,80%)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/85 tracking-tight">{avatar.voice_name || 'Premium Voice'}</p>
                  <p className="text-[11px] text-white/40 font-light">{avatar.voice_description || 'Natural, professional tone'}</p>
                </div>
              </div>
              <button
                onClick={() => onPreviewVoice(avatar)}
                disabled={isPreviewingVoice}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all text-[hsl(215,100%,85%)] hover:scale-[1.03] active:scale-[0.97]"
                style={{
                  background: 'hsla(215,100%,55%,0.18)',
                  boxShadow: 'inset 0 0 0 1px hsla(215,100%,55%,0.3), inset 0 1px 0 hsla(215,100%,80%,0.15)',
                }}
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
                    className="text-[10px] px-2.5 py-1 rounded-full text-white/45 font-light tracking-wide"
                    style={{
                      background: 'hsla(0,0%,100%,0.025)',
                      boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Pinned CTA — always visible */}
          <div
            className="flex-shrink-0 px-5 py-4"
            style={{
              background: 'linear-gradient(180deg, hsla(220,14%,3%,0.4), hsla(220,14%,2%,0.85))',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05)',
            }}
          >
            <Button
              onClick={() => {
                onSelect(avatar);
                onOpenChange(false);
              }}
              className="w-full h-12 text-sm font-medium rounded-full text-white gap-2 tracking-wide transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, hsl(215,100%,55%) 0%, hsl(215,100%,48%) 100%)',
                boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.25), 0 8px 32px -8px hsla(215,100%,55%,0.55), 0 0 0 1px hsla(215,100%,62%,0.4)',
              }}
            >
              <CheckCircle2 className="w-4 h-4" />
              Select {avatar.name}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

AvatarPreviewModal.displayName = 'AvatarPreviewModal';
