import { memo, forwardRef } from 'react';
import { 
  Mic, Play, Zap, Loader2, Music, MapPin, Video, Camera,
  RectangleHorizontal, RectangleVertical, Square, Sparkles
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
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
        {selectedAvatar.front_image_url || selectedAvatar.face_image_url ? (
          <img 
            src={selectedAvatar.front_image_url || selectedAvatar.face_image_url} 
            alt={selectedAvatar.name || 'Avatar'}
            className="w-5 h-5 rounded-full object-cover ring-2 ring-violet-500/30"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-violet-500/30 flex items-center justify-center">
            <span className="text-[9px] text-violet-300 font-bold">
              {(selectedAvatar.name || 'A').charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span className="text-sm text-violet-200 font-medium">{selectedAvatar.name || 'Avatar'}</span>
        <button
          onClick={onClearAvatar}
          className="text-xs text-violet-400/70 hover:text-violet-300 transition-colors ml-1"
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
        ? "bg-violet-500/10 border-violet-500/30" 
        : "bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600"
    )}>
      <Icon className={cn("w-4 h-4", active ? "text-violet-400" : "text-zinc-400")} />
      <span className="text-xs text-zinc-300 font-medium">{label}</span>
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
        <div className="rounded-2xl md:rounded-3xl bg-zinc-900/95 border border-white/[0.08] backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden">
          
          {/* Header with Avatar Badge */}
          <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-white/[0.06] bg-gradient-to-r from-violet-500/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Create Avatar Video</h3>
                <p className="text-xs text-zinc-500 hidden md:block">Write what your avatar will say</p>
              </div>
            </div>
            <AvatarBadge />
          </div>

          {/* Main Content Area */}
          <div className="p-4 md:p-6 space-y-4">
            
            {/* Script Input - Primary Focus */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-violet-400" />
                <Label className="text-sm font-medium text-white">Script</Label>
                <span className="text-xs text-zinc-500">— What your avatar will say</span>
              </div>
              <Textarea
                placeholder={selectedAvatar 
                  ? `Write what ${selectedAvatar.name} will say... Example: "Welcome to my channel! Today I'm going to show you something amazing that will change your life..."`
                  : "First, select an avatar above to begin..."
                }
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                className="min-h-[100px] md:min-h-[120px] bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-500 resize-none text-sm leading-relaxed focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl"
                disabled={!selectedAvatar}
              />
            </div>

            {/* Environment Input - Secondary */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <Label className="text-xs font-medium text-zinc-400">Environment</Label>
                <span className="text-xs text-zinc-600">— Optional background setting</span>
              </div>
              <Textarea
                placeholder="e.g., a cozy coffee shop, a futuristic space station, a sunny beach..."
                value={sceneDescription}
                onChange={(e) => onSceneDescriptionChange(e.target.value)}
                className="min-h-[60px] bg-zinc-800/30 border-zinc-700/30 text-white placeholder:text-zinc-600 text-sm resize-none leading-relaxed focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                disabled={!selectedAvatar}
              />
            </div>

            {/* Settings Row - Clean Horizontal Layout */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Aspect Ratio Selector */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <span className="text-xs text-zinc-400 font-medium mr-1">Format</span>
                <div className="flex gap-1">
                  {ASPECT_RATIOS.map((ratio) => (
                    <TooltipProvider key={ratio.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onAspectRatioChange(ratio.id)}
                            className={cn(
                              "p-1.5 rounded-lg transition-all",
                              aspectRatio === ratio.id
                                ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                                : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
                            )}
                          >
                            <ratio.icon className="w-4 h-4" />
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
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <span className="text-xs text-zinc-400 font-medium">Duration</span>
                <span className="text-sm text-white font-semibold">10s</span>
              </div>

              {/* Clips Selector */}
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <span className="text-xs text-zinc-400 font-medium">Clips</span>
                <span className="text-sm text-white font-semibold w-4 text-center">{clipCount}</span>
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
                      "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer",
                      cinematicMode.enabled 
                        ? "bg-emerald-500/10 border-emerald-500/30" 
                        : "bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600"
                    )}
                    onClick={() => handleCinematicToggle(!cinematicMode.enabled)}
                    >
                      <Video className={cn("w-4 h-4", cinematicMode.enabled ? "text-emerald-400" : "text-zinc-500")} />
                      <span className="text-xs text-zinc-300 font-medium">Cinematic</span>
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
                      "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer",
                      enableDualAvatar 
                        ? "bg-sky-500/10 border-sky-500/30" 
                        : "bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600"
                    )}
                    onClick={() => onEnableDualAvatarChange(!enableDualAvatar)}
                    >
                      <Sparkles className={cn("w-4 h-4", enableDualAvatar ? "text-sky-400" : "text-zinc-500")} />
                      <span className="text-xs text-zinc-300 font-medium">2 Avatars</span>
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
              <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 animate-fade-in">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-emerald-300 font-medium">Movement</span>
                  <Select value={cinematicMode.movementType} onValueChange={(v) => handleMovementChange(v as MovementType)}>
                    <SelectTrigger className="h-8 w-28 text-xs bg-zinc-800/80 border-emerald-500/20">
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
                  <span className="text-xs text-emerald-300 font-medium">Camera</span>
                  <Select value={cinematicMode.cameraAngle} onValueChange={(v) => handleCameraChange(v as CameraAngle)}>
                    <SelectTrigger className="h-8 w-28 text-xs bg-zinc-800/80 border-emerald-500/20">
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
                
                <span className="text-xs text-emerald-400/60 italic ml-auto hidden md:inline">
                  🎬 AI varies angles per clip
                </span>
              </div>
            )}
          </div>

          {/* Footer - Create Button & Cost */}
          <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-t border-white/[0.06] bg-gradient-to-r from-transparent to-violet-500/5">
            {/* Cost Info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">Duration:</span>
                <span className="text-white font-medium">{estimatedDuration}s</span>
              </div>
              <div className="w-px h-4 bg-zinc-700" />
              <div className={cn(
                "flex items-center gap-1.5 text-sm font-medium",
                hasInsufficientCredits ? "text-red-400" : "text-amber-400"
              )}>
                <Zap className="w-4 h-4" />
                <span>{estimatedCredits} credits</span>
              </div>
              <div className="hidden md:flex items-center gap-2 text-sm">
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-500">Balance:</span>
                <span className="text-zinc-300">{userCredits}</span>
              </div>
            </div>

            {/* Create Button */}
            <Button
              onClick={onCreate}
              disabled={!isReadyToCreate || isCreating}
              size="lg"
              className={cn(
                "h-11 px-8 text-sm font-semibold transition-all rounded-xl gap-2",
                isReadyToCreate
                  ? "bg-gradient-to-r from-violet-600 via-violet-500 to-violet-600 hover:from-violet-500 hover:via-violet-400 hover:to-violet-500 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              )}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Create Video</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}));

AvatarsConfigPanel.displayName = 'AvatarsConfigPanel';

export default AvatarsConfigPanel;
