import { memo, forwardRef, useState } from 'react';
import { 
  Mic, Play, Zap, Loader2, Music, MapPin, Video, Camera,
  RectangleHorizontal, RectangleVertical, Square, Sparkles, ChevronUp, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarTemplate } from '@/types/avatar-templates';
import { CinematicModeConfig, MOVEMENT_PRESETS, CAMERA_PRESETS, MovementType, CameraAngle } from '@/types/cinematic-mode';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ASPECT_RATIOS = [
  { id: '16:9', name: 'Landscape', icon: RectangleHorizontal, description: 'YouTube, TV' },
  { id: '9:16', name: 'Portrait', icon: RectangleVertical, description: 'TikTok, Reels' },
  { id: '1:1', name: 'Square', icon: Square, description: 'Instagram' },
];

// Avatar clips are fixed at 10s for natural speech delivery
const AVATAR_CLIP_DURATION = 10;

interface AvatarsConfigPanelProps {
  selectedAvatar: AvatarTemplate | null;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  sceneDescription: string;
  onSceneDescriptionChange: (scene: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;
  clipDuration: number;
  onClipDurationChange: (duration: number) => void;
  clipCount: number;
  onClipCountChange: (count: number) => void;
  maxClips: number;
  enableMusic: boolean;
  onEnableMusicChange: (enabled: boolean) => void;
  enableDualAvatar: boolean;
  onEnableDualAvatarChange: (enabled: boolean) => void;
  cinematicMode: CinematicModeConfig;
  onCinematicModeChange: (config: CinematicModeConfig) => void;
  estimatedDuration: number;
  estimatedCredits: number;
  userCredits: number;
  hasInsufficientCredits: boolean;
  isCreating: boolean;
  isReadyToCreate: boolean;
  onClearAvatar: () => void;
  onCreate: () => void;
}

export const AvatarsConfigPanel = memo(forwardRef<HTMLDivElement, AvatarsConfigPanelProps>(function AvatarsConfigPanel({
  selectedAvatar,
  prompt,
  onPromptChange,
  sceneDescription,
  onSceneDescriptionChange,
  aspectRatio,
  onAspectRatioChange,
  clipDuration,
  onClipDurationChange,
  clipCount,
  onClipCountChange,
  maxClips,
  enableMusic,
  onEnableMusicChange,
  enableDualAvatar,
  onEnableDualAvatarChange,
  cinematicMode,
  onCinematicModeChange,
  estimatedDuration,
  estimatedCredits,
  userCredits,
  hasInsufficientCredits,
  isCreating,
  isReadyToCreate,
  onClearAvatar,
  onCreate,
}, ref) {
  // Collapsed by default on mobile — expanded on desktop
  const [isExpanded, setIsExpanded] = useState(false);

  // Cinematic mode toggle handler
  const handleCinematicToggle = (enabled: boolean) => {
    onCinematicModeChange({ ...cinematicMode, enabled });
  };

  const handleMovementChange = (movementType: MovementType) => {
    onCinematicModeChange({ ...cinematicMode, movementType });
  };

  const handleCameraChange = (cameraAngle: CameraAngle) => {
    onCinematicModeChange({ ...cinematicMode, cameraAngle });
  };

  // Selected Avatar Badge Component
  const AvatarBadge = () => {
    if (!selectedAvatar) return null;
    
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(215,100%,55%)]/10 border border-[hsl(215,100%,55%)]/20">
        {selectedAvatar.front_image_url || selectedAvatar.face_image_url ? (
          <img 
            src={selectedAvatar.front_image_url || selectedAvatar.face_image_url} 
            alt={selectedAvatar.name || 'Avatar'}
            className="w-5 h-5 rounded-full object-cover ring-2 ring-[hsl(215,100%,55%)]/30"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-[hsl(215,100%,55%)]/30 flex items-center justify-center">
            <span className="text-[9px] text-[hsl(215,100%,80%)] font-bold">
              {(selectedAvatar.name || 'A').charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span className="text-sm text-[hsl(215,100%,85%)] font-medium">{selectedAvatar.name || 'Avatar'}</span>
        <button
          onClick={onClearAvatar}
          className="text-xs text-[hsl(215,100%,72%)]/70 hover:text-[hsl(215,100%,80%)] transition-colors ml-1"
        >
          Change
        </button>
      </div>
    );
  };

  // Settings Pill Component
  const SettingsPill = ({ 
    icon: Icon, 
    label, 
    active = false, 
    children 
  }: { 
    icon: React.ElementType; 
    label: string; 
    active?: boolean;
    children?: React.ReactNode;
  }) => (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
      active 
        ? "bg-[hsl(215,100%,55%)]/10 border-[hsl(215,100%,55%)]/30" 
        : "bg-[hsla(0,0%,100%,0.03)] border-white/[0.05] hover:border-white/[0.08]"
    )}>
      <Icon className={cn("w-4 h-4", active ? "text-[hsl(215,100%,72%)]" : "text-white/55")} />
      <span className="text-xs text-white/75 font-medium">{label}</span>
      {children}
    </div>
  );

  return (
    <div
      ref={ref}
      className={cn(
        // No fixed/absolute positioning — parent layout controls stickiness
        "relative z-40 p-3 pb-safe landscape-compact animate-fade-in",
        "md:p-4 lg:p-5"
      )}
      style={{ animationDelay: '0.4s' }}
    >
      <div className="max-w-4xl mx-auto">
        <div
          className="rounded-2xl md:rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, hsla(220,14%,5%,0.78) 0%, hsla(220,14%,3%,0.88) 100%)',
            backdropFilter: 'blur(48px) saturate(180%)',
            WebkitBackdropFilter: 'blur(48px) saturate(180%)',
            boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.06), 0 30px 80px -20px hsla(0,0%,0%,0.7), 0 0 0 1px hsla(0,0%,100%,0.04)',
          }}
        >
          
          {/* Header with Avatar Badge — tappable on mobile to expand/collapse */}
          <div
            className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 bg-gradient-to-r from-[hsla(215,100%,55%,0.06)] via-transparent to-transparent md:cursor-default cursor-pointer"
            style={{ boxShadow: 'inset 0 -1px 0 hsla(0,0%,100%,0.05)' }}
            onClick={() => setIsExpanded(prev => !prev)}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, hsl(215,100%,62%) 0%, hsl(215,100%,48%) 100%)',
                  boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.25), 0 4px 16px hsla(215,100%,55%,0.35)',
                }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white tracking-tight">Create Avatar Video</h3>
                <p className="text-[11px] text-white/40 font-light tracking-wide">
                  {isExpanded ? 'Write what your avatar will say' : 'Tap to configure & create'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AvatarBadge />
              {/* Collapse chevron — only visible on mobile */}
              <div className="md:hidden text-white/40 ml-1">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </div>
            </div>
          </div>

          {/* Main Content Area — hidden on mobile when collapsed */}
          <div className={cn("p-4 md:p-6 space-y-4", !isExpanded && "hidden md:block")}>
            
            {/* Script Input - Primary Focus */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 text-[hsl(215,100%,72%)]" />
                <Label className="text-[10px] font-light text-white/70 uppercase tracking-[0.22em]">Script</Label>
                <span className="text-[10px] text-white/35 font-light tracking-wide">— What your avatar will say</span>
              </div>
              <Textarea
                placeholder={selectedAvatar 
                  ? `Write what ${selectedAvatar.name} will say... Example: "Welcome to my channel! Today I'm going to show you something amazing that will change your life..."`
                  : "First, select an avatar above to begin..."
                }
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                className="min-h-[100px] md:min-h-[120px] bg-[hsla(0,0%,100%,0.025)] border-0 text-white placeholder:text-white/35 resize-none text-sm leading-relaxed focus-visible:ring-2 focus-visible:ring-[hsl(215,100%,55%)]/40 rounded-2xl font-light"
                style={{ boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05), inset 0 1px 0 hsla(0,0%,100%,0.03)' }}
                disabled={!selectedAvatar}
              />
            </div>

            {/* Environment Input - Secondary */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[hsl(215,100%,72%)]" />
                <Label className="text-[10px] font-light text-white/55 uppercase tracking-[0.22em]">Environment</Label>
                <span className="text-[10px] text-white/30 font-light tracking-wide">— Optional background</span>
              </div>
              <Textarea
                placeholder="e.g., a cozy coffee shop, a futuristic space station, a sunny beach..."
                value={sceneDescription}
                onChange={(e) => onSceneDescriptionChange(e.target.value)}
                className="min-h-[60px] bg-[hsla(0,0%,100%,0.018)] border-0 text-white placeholder:text-white/30 text-sm resize-none leading-relaxed focus-visible:ring-2 focus-visible:ring-[hsl(215,100%,55%)]/40 rounded-2xl font-light"
                style={{ boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.04)' }}
                disabled={!selectedAvatar}
              />
            </div>

            {/* Settings Row - Clean Horizontal Layout */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Aspect Ratio Selector */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-full"
                style={{ background: 'hsla(0,0%,100%,0.025)', boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05)' }}
              >
                <span className="text-[10px] text-white/55 font-light uppercase tracking-[0.18em] mr-1">Format</span>
                <div className="flex gap-1">
                  {ASPECT_RATIOS.map((ratio) => (
                    <TooltipProvider key={ratio.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onAspectRatioChange(ratio.id)}
                            className={cn(
                              "p-1.5 rounded-full transition-all",
                              aspectRatio === ratio.id
                                ? "text-white"
                                : "text-white/45 hover:text-white/75"
                            )}
                            style={aspectRatio === ratio.id ? {
                              background: 'linear-gradient(135deg, hsl(215,100%,55%), hsl(215,100%,48%))',
                              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.25), 0 0 12px hsla(215,100%,55%,0.4)',
                            } : undefined}
                          >
                            <ratio.icon className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {ratio.name} • {ratio.description}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>

              {/* Duration Badge */}
              <div
                className="flex items-center gap-2 px-3.5 py-2 rounded-full"
                style={{ background: 'hsla(0,0%,100%,0.025)', boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05)' }}
              >
                <span className="text-[10px] text-white/55 font-light uppercase tracking-[0.18em]">Duration</span>
                <span className="text-xs text-white font-medium tracking-tight">10s</span>
              </div>

              {/* Clips Selector */}
              <div
                className="flex items-center gap-3 px-3.5 py-2 rounded-full"
                style={{ background: 'hsla(0,0%,100%,0.025)', boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05)' }}
              >
                <span className="text-[10px] text-white/55 font-light uppercase tracking-[0.18em]">Clips</span>
                <span className="text-xs text-white font-medium w-4 text-center tracking-tight">{clipCount}</span>
                <Slider
                  value={[clipCount]}
                  onValueChange={([v]) => onClipCountChange(v)}
                  min={1}
                  max={maxClips}
                  step={1}
                  className="w-20"
                />
              </div>

              {/* Music toggle removed - music disabled globally */}

              {/* Cinematic Mode Toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-2 px-3.5 py-2 rounded-full transition-all cursor-pointer"
                    )}
                    style={cinematicMode.enabled ? {
                      background: 'hsla(215,100%,55%,0.12)',
                      boxShadow: 'inset 0 0 0 1px hsla(215,100%,55%,0.35), 0 0 16px hsla(215,100%,55%,0.15)',
                    } : {
                      background: 'hsla(0,0%,100%,0.025)',
                      boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05)',
                    }}
                    onClick={() => handleCinematicToggle(!cinematicMode.enabled)}
                    >
                      <Video className={cn("w-3.5 h-3.5", cinematicMode.enabled ? "text-[hsl(215,100%,80%)]" : "text-white/40")} />
                      <span className="text-[10px] text-white/75 font-light uppercase tracking-[0.18em]">Cinematic</span>
                      <Switch checked={cinematicMode.enabled} onCheckedChange={handleCinematicToggle} className="scale-75" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="font-medium">Cinematic Mode</p>
                    <p className="text-xs text-muted-foreground">Dynamic movement and camera angles for film-quality videos</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Dual Avatar Toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-2 px-3.5 py-2 rounded-full transition-all cursor-pointer"
                    )}
                    style={enableDualAvatar ? {
                      background: 'hsla(215,100%,55%,0.12)',
                      boxShadow: 'inset 0 0 0 1px hsla(215,100%,55%,0.35), 0 0 16px hsla(215,100%,55%,0.15)',
                    } : {
                      background: 'hsla(0,0%,100%,0.025)',
                      boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.05)',
                    }}
                    onClick={() => onEnableDualAvatarChange(!enableDualAvatar)}
                    >
                      <Sparkles className={cn("w-3.5 h-3.5", enableDualAvatar ? "text-[hsl(215,100%,80%)]" : "text-white/40")} />
                      <span className="text-[10px] text-white/75 font-light uppercase tracking-[0.18em]">2 Avatars</span>
                      <Switch checked={enableDualAvatar} onCheckedChange={onEnableDualAvatarChange} className="scale-75" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="font-medium">Dual Avatar Mode</p>
                    <p className="text-xs text-muted-foreground">AI auto-picks a second character for dialogue scenes</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Cinematic Options - Expanded when enabled */}
            {cinematicMode.enabled && (
              <div
                className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-2xl animate-fade-in"
                style={{
                  background: 'hsla(215,100%,55%,0.04)',
                  boxShadow: 'inset 0 0 0 1px hsla(215,100%,55%,0.18)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[hsl(215,100%,72%)]" />
                  <span className="text-[10px] text-[hsl(215,100%,80%)] font-light uppercase tracking-[0.18em]">Movement</span>
                  <Select value={cinematicMode.movementType} onValueChange={(v) => handleMovementChange(v as MovementType)}>
                    <SelectTrigger className="h-8 w-28 text-xs bg-[hsla(0,0%,100%,0.04)] border-[hsl(215,100%,55%)]/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MOVEMENT_PRESETS).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>
                          <div>
                            <div className="font-medium">{preset.label}</div>
                            <div className="text-xs text-muted-foreground">{preset.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[hsl(215,100%,80%)] font-light uppercase tracking-[0.18em]">Camera</span>
                  <Select value={cinematicMode.cameraAngle} onValueChange={(v) => handleCameraChange(v as CameraAngle)}>
                    <SelectTrigger className="h-8 w-28 text-xs bg-[hsla(0,0%,100%,0.04)] border-[hsl(215,100%,55%)]/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CAMERA_PRESETS).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>
                          <div>
                            <div className="font-medium">{preset.label}</div>
                            <div className="text-xs text-muted-foreground">{preset.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <span className="text-[10px] text-[hsl(215,100%,72%)]/60 italic ml-auto hidden md:inline font-light tracking-wide">
                  🎬 AI varies angles per clip
                </span>
              </div>
            )}
          </div>

          {/* Footer - Create Button & Cost */}
          <div className={cn(
            "flex items-center justify-between px-4 py-3 md:px-6 md:py-4 bg-gradient-to-r from-transparent to-[hsla(215,100%,55%,0.06)]",
            !isExpanded && "md:flex hidden"
          )}>
            <style>{``}</style>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40 font-light tracking-wide text-xs uppercase">Duration</span>
                <span className="text-white font-medium tracking-tight">{estimatedDuration}s</span>
              </div>
              <div className="w-px h-4 bg-[hsla(0,0%,100%,0.08)]" />
              <div className={cn(
                "flex items-center gap-1.5 text-sm font-medium",
                hasInsufficientCredits ? "text-red-400" : "text-[hsl(215,100%,80%)]"
              )}>
                <Zap className="w-4 h-4" style={{ filter: 'drop-shadow(0 0 6px hsla(215,100%,55%,0.5))' }} />
                <span>{estimatedCredits} credits</span>
              </div>
              <div className="hidden md:flex items-center gap-2 text-sm">
                <span className="text-white/30">•</span>
                <span className="text-white/40 font-light text-xs uppercase tracking-wide">Balance</span>
                <span className="text-white/75 tracking-tight">{userCredits}</span>
              </div>
            </div>
            <Button
              onClick={onCreate}
              disabled={!isReadyToCreate || isCreating}
              size="lg"
              className={cn(
                "h-11 px-8 text-sm font-medium tracking-wide transition-all rounded-full gap-2",
                isReadyToCreate
                  ? "text-white hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-[hsla(0,0%,100%,0.04)] text-white/40 cursor-not-allowed"
              )}
              style={isReadyToCreate ? {
                background: 'linear-gradient(135deg, hsl(215,100%,55%) 0%, hsl(215,100%,48%) 100%)',
                boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.25), 0 8px 32px -8px hsla(215,100%,55%,0.55), 0 0 0 1px hsla(215,100%,62%,0.4)',
              } : undefined}
            >
              {isCreating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Creating...</span></>
              ) : (
                <><Play className="w-4 h-4" /><span>Create Video</span></>
              )}
            </Button>
          </div>

          {/* Compact footer — mobile only, shown when panel is collapsed */}
          {!isExpanded && (
            <div
              className="md:hidden flex items-center justify-between px-4 py-2.5"
              style={{ boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05)' }}
            >
              <div className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                hasInsufficientCredits ? "text-red-400" : "text-[hsl(215,100%,80%)]"
              )}>
                <Zap className="w-3.5 h-3.5" />
                <span>{estimatedCredits} credits · {userCredits} balance</span>
              </div>
              <Button
                onClick={isReadyToCreate ? onCreate : () => setIsExpanded(true)}
                disabled={isCreating}
                size="sm"
                className={cn(
                  "h-9 px-4 text-xs font-medium rounded-full gap-1.5 tracking-wide",
                  isReadyToCreate ? "text-white" : "text-[hsl(215,100%,80%)]"
                )}
                style={isReadyToCreate ? {
                  background: 'linear-gradient(135deg, hsl(215,100%,55%) 0%, hsl(215,100%,48%) 100%)',
                  boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.25), 0 4px 16px -4px hsla(215,100%,55%,0.5)',
                } : {
                  background: 'hsla(215,100%,55%,0.15)',
                  boxShadow: 'inset 0 0 0 1px hsla(215,100%,55%,0.3)',
                }}
              >
                {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isReadyToCreate ? 'Create' : 'Set up'}</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}));

AvatarsConfigPanel.displayName = 'AvatarsConfigPanel';

export default AvatarsConfigPanel;
