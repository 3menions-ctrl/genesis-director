import { memo, forwardRef } from 'react';
import { 
  Mic, Play, Zap, Loader2, Music, MapPin, Video, Camera,
  RectangleHorizontal, RectangleVertical, Square
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarTemplate } from '@/types/avatar-templates';
import { CinematicModeConfig, MOVEMENT_PRESETS, CAMERA_PRESETS, MovementType, CameraAngle } from '@/types/cinematic-mode';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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

  return (
    // STABILITY: Replaced motion.div with CSS animations to prevent ref-injection crashes
    // Landscape tablets: more compact padding (p-3) to leave room for avatar notes
    <div
      ref={ref}
      className="fixed bottom-0 left-0 right-0 z-40 p-3 md:p-4 lg:p-6 pb-safe landscape-compact animate-fade-in"
      style={{ animationDelay: '0.4s' }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="p-3 md:p-4 lg:p-6 rounded-2xl md:rounded-3xl bg-zinc-900 border border-white/[0.12] backdrop-blur-2xl shadow-2xl shadow-black/50">
          {/* Mobile/Tablet Layout - shown below lg breakpoint */}
          <div className="flex flex-col gap-3 md:gap-2 lg:hidden">
            {/* Story/Script Input - Mobile (Primary) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white flex items-center gap-2 text-sm font-medium">
                  <Mic className="w-3.5 h-3.5 text-violet-400" />
                  Script
                </Label>
                {selectedAvatar && (
                  <div className="flex items-center gap-2">
                    {/* Safe image rendering with fallback */}
                    {selectedAvatar.front_image_url || selectedAvatar.face_image_url ? (
                      <img 
                        src={selectedAvatar.front_image_url || selectedAvatar.face_image_url} 
                        alt={selectedAvatar.name || 'Avatar'}
                        className="w-5 h-5 rounded-full object-cover border border-border"
                        onError={(e) => {
                          // Hide broken images
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center border border-border">
                        <span className="text-[8px] text-violet-400 font-bold">
                          {(selectedAvatar.name || 'A').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">{selectedAvatar.name || 'Avatar'}</span>
                    <button
                      onClick={onClearAvatar}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
              <Textarea
                placeholder={selectedAvatar 
                  ? `Write what ${selectedAvatar.name} will say. Example: "Welcome to my channel! Today I'm going to show you something amazing..."`
                  : "Select an avatar above..."
                }
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                className="min-h-[100px] md:min-h-[80px] bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 resize-none text-sm"
                disabled={!selectedAvatar}
              />
            </div>

            {/* Scene/Environment Input - Mobile/Tablet */}
            <div className="space-y-1.5">
              <Label className="text-zinc-300 flex items-center gap-2 text-xs font-medium">
                <MapPin className="w-3 h-3 text-violet-400" />
                Environment (optional)
              </Label>
              <Input
                placeholder="e.g., a witch's house in the woods, a futuristic city..."
                value={sceneDescription}
                onChange={(e) => onSceneDescriptionChange(e.target.value)}
                className="h-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 text-sm"
                disabled={!selectedAvatar}
              />
            </div>

            {/* Settings Row */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {/* Aspect Ratio */}
              <div className="flex gap-1 shrink-0">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.id}
                    onClick={() => onAspectRatioChange(ratio.id)}
                    className={cn(
                      "p-2 rounded-lg border transition-all",
                      aspectRatio === ratio.id
                        ? "border-violet-500 bg-violet-500/10 text-violet-300"
                        : "border-white/[0.08] text-white/40 hover:border-white/20"
                    )}
                    title={ratio.description}
                  >
                    <ratio.icon className="w-4 h-4" />
                  </button>
                ))}
              </div>

              <div className="w-px h-6 bg-white/10 shrink-0" />

              {/* Duration - Fixed at 10s */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 shrink-0">
                <span className="text-xs text-white font-medium">10 sec</span>
              </div>

              {/* Clips Slider */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-zinc-300">Clips: {clipCount}</span>
                <Slider
                  value={[clipCount]}
                  onValueChange={([v]) => onClipCountChange(v)}
                  min={1}
                  max={maxClips}
                  step={1}
                  className="w-16"
                />
              </div>

              {/* Music Toggle */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Music className={cn("w-3.5 h-3.5", enableMusic ? "text-violet-400" : "text-white/30")} />
                <Switch checked={enableMusic} onCheckedChange={onEnableMusicChange} className="scale-75" />
              </div>

              {/* Cinematic Mode Toggle - Mobile */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Video className={cn("w-3.5 h-3.5", cinematicMode.enabled ? "text-emerald-400" : "text-white/30")} />
                      <Switch checked={cinematicMode.enabled} onCheckedChange={handleCinematicToggle} className="scale-75" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="font-medium">Cinematic Mode</p>
                    <p className="text-xs text-muted-foreground">Add dynamic movement and camera angles for a more realistic, cinematic feel</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Cinematic Options - Mobile (shown when enabled) */}
            {cinematicMode.enabled && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex items-center gap-2 shrink-0">
                  <Label className="text-xs text-zinc-400 whitespace-nowrap">Movement:</Label>
                  <Select value={cinematicMode.movementType} onValueChange={(v) => handleMovementChange(v as MovementType)}>
                    <SelectTrigger className="h-7 w-24 text-xs bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MOVEMENT_PRESETS).map(([key, preset]) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Label className="text-xs text-zinc-400 whitespace-nowrap">Camera:</Label>
                  <Select value={cinematicMode.cameraAngle} onValueChange={(v) => handleCameraChange(v as CameraAngle)}>
                    <SelectTrigger className="h-7 w-24 text-xs bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CAMERA_PRESETS).map(([key, preset]) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Create Button */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span>{estimatedDuration}s</span>
                <span className="text-zinc-600">•</span>
                <span className={cn("flex items-center gap-1", hasInsufficientCredits ? "text-red-400" : "text-amber-400")}>
                  <Zap className="w-3 h-3" />
                  {estimatedCredits}
                </span>
              </div>
              
              <Button
                onClick={onCreate}
                disabled={!isReadyToCreate || isCreating}
                className={cn(
                  "h-10 px-6 text-sm font-medium transition-all rounded-xl",
                  isReadyToCreate
                    ? "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white shadow-lg shadow-violet-500/25"
                    : "bg-white/[0.05] text-white/30"
                )}
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1.5" />
                    Create
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:grid lg:grid-cols-[1fr,auto,auto] gap-6 items-end">
            {/* Story Concept Input - Desktop */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-white flex items-center gap-2 font-medium">
                  <Mic className="w-4 h-4 text-violet-400" />
                  Script
                </Label>
                {selectedAvatar && (
                  <div className="flex items-center gap-2 text-sm">
                    {/* Safe image rendering with fallback */}
                    {selectedAvatar.front_image_url || selectedAvatar.face_image_url ? (
                      <img 
                        src={selectedAvatar.front_image_url || selectedAvatar.face_image_url} 
                        alt={selectedAvatar.name || 'Avatar'}
                        className="w-6 h-6 rounded-full object-cover border border-border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center border border-border">
                        <span className="text-xs text-violet-400 font-bold">
                          {(selectedAvatar.name || 'A').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-foreground/70">{selectedAvatar.name || 'Avatar'}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClearAvatar}
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Change
                    </Button>
                  </div>
                )}
              </div>
              <Textarea
                placeholder={selectedAvatar 
                  ? `Write what ${selectedAvatar.name} will say. Example: "Welcome to my channel! Today I'm going to show you something amazing..."`
                  : "First, select an avatar above..."
                }
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                className="min-h-[70px] bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 resize-none"
                disabled={!selectedAvatar}
              />
              
              {/* Environment/Setting Input - Desktop */}
              <div className="flex items-center gap-3">
                <Label className="text-zinc-300 flex items-center gap-1.5 text-xs whitespace-nowrap font-medium">
                  <MapPin className="w-3.5 h-3.5 text-violet-400" />
                  Environment
                </Label>
                <Input
                  placeholder="e.g., a witch's house in the woods, a futuristic city... (optional)"
                  value={sceneDescription}
                  onChange={(e) => onSceneDescriptionChange(e.target.value)}
                  className="h-9 flex-1 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 text-sm"
                  disabled={!selectedAvatar}
                />
              </div>
            </div>

            {/* Quick Settings */}
            <div className="flex items-center gap-4">
              {/* Aspect Ratio */}
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400 font-medium">Format</Label>
                <div className="flex gap-1">
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio.id}
                      onClick={() => onAspectRatioChange(ratio.id)}
                      className={cn(
                        "p-2 rounded-lg border transition-all",
                        aspectRatio === ratio.id
                          ? "border-violet-500 bg-violet-500/10 text-violet-300"
                          : "border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/60"
                      )}
                      title={ratio.description}
                    >
                      <ratio.icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration - Fixed at 10s */}
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400 font-medium">Duration</Label>
                <div className="flex items-center justify-center w-24 h-9 rounded-md bg-zinc-800 border border-zinc-700">
                  <span className="text-sm text-white font-medium">10 sec</span>
                </div>
              </div>

              {/* Clips */}
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400 font-medium">Clips: {clipCount}</Label>
                <Slider
                  value={[clipCount]}
                  onValueChange={([v]) => onClipCountChange(v)}
                  min={1}
                  max={maxClips}
                  step={1}
                  className="w-24"
                />
              </div>

              {/* Music Toggle */}
              <div className="flex items-center gap-2">
                <Music className={cn("w-4 h-4", enableMusic ? "text-violet-400" : "text-white/30")} />
                <Switch checked={enableMusic} onCheckedChange={onEnableMusicChange} />
              </div>

              {/* Cinematic Mode - Desktop */}
              <div className="space-y-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <Video className={cn("w-4 h-4", cinematicMode.enabled ? "text-emerald-400" : "text-white/30")} />
                        <Switch checked={cinematicMode.enabled} onCheckedChange={handleCinematicToggle} />
                        <span className="text-xs text-zinc-400">Cinematic</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="font-medium">Cinematic Mode</p>
                      <p className="text-xs text-muted-foreground">Dynamic movement (walking, driving, action) with varying camera angles for realistic, film-quality videos</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Cinematic Options Row - Desktop (shown when enabled) */}
            {cinematicMode.enabled && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-zinc-400">Movement:</span>
                  <Select value={cinematicMode.movementType} onValueChange={(v) => handleMovementChange(v as MovementType)}>
                    <SelectTrigger className="h-8 w-28 text-xs bg-zinc-800 border-zinc-700">
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
                  <span className="text-xs text-zinc-400">Camera:</span>
                  <Select value={cinematicMode.cameraAngle} onValueChange={(v) => handleCameraChange(v as CameraAngle)}>
                    <SelectTrigger className="h-8 w-28 text-xs bg-zinc-800 border-zinc-700">
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
                <div className="text-xs text-emerald-400/70 italic">
                  🎬 AI will vary movement & angles per clip
                </div>
              </div>
            )}

            {/* Create Button & Cost */}
            <div className="flex flex-col items-end gap-2">
              <Button
                onClick={onCreate}
                disabled={!isReadyToCreate || isCreating}
                className={cn(
                  "h-12 px-8 text-base font-medium transition-all rounded-xl",
                  isReadyToCreate
                    ? "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white shadow-lg shadow-violet-500/25"
                    : "bg-white/[0.05] text-white/30 cursor-not-allowed"
                )}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Create Video
                  </>
                )}
              </Button>
              
              <div className="flex items-center gap-3 text-xs">
                <span className="text-zinc-400">{estimatedDuration}s</span>
                <span className="text-zinc-600">•</span>
                <span className={cn("flex items-center gap-1", hasInsufficientCredits ? "text-red-400" : "text-amber-400")}>
                  <Zap className="w-3 h-3" />
                  {estimatedCredits} credits
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">Balance: {userCredits}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}));

AvatarsConfigPanel.displayName = 'AvatarsConfigPanel';

export default AvatarsConfigPanel;
