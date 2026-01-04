import { useState } from 'react';
import { 
  Sparkles, Sun, TreePine, BookOpen, Layers, ChevronRight,
  Palette, Zap, Mountain, Cloudy, Sunset, Moon
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StudioSettings, ENVIRONMENT_PRESETS } from '@/types/studio';
import { cn } from '@/lib/utils';

interface SettingsSidebarProps {
  settings: StudioSettings;
  onSettingsChange: (settings: Partial<StudioSettings>) => void;
}

const LIGHTING_OPTIONS = [
  { id: 'natural', label: 'Natural', icon: Sun, gradient: 'from-amber-400 to-orange-500' },
  { id: 'studio', label: 'Studio', icon: Zap, gradient: 'from-blue-400 to-indigo-500' },
  { id: 'dramatic', label: 'Dramatic', icon: Moon, gradient: 'from-purple-500 to-pink-500' },
  { id: 'soft', label: 'Soft', icon: Cloudy, gradient: 'from-sky-300 to-blue-400' },
] as const;

const ENVIRONMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'modern-office': Zap,
  'nature-forest': TreePine,
  'urban-night': Moon,
  'coastal-sunset': Sunset,
  'mountain-vista': Mountain,
};

export function SettingsSidebar({ settings, onSettingsChange }: SettingsSidebarProps) {
  const [openSections, setOpenSections] = useState<string[]>(['environment', 'lighting']);

  const toggleSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const selectedEnvironment = ENVIRONMENT_PRESETS.find(e => e.id === settings.environment);

  return (
    <div className="h-full flex flex-col w-full bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <div className="p-6 border-b border-border/5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-accent/40 rounded-2xl blur-xl" />
            <div className="relative p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-white/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-foreground tracking-tight" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              Studio Settings
            </h3>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Fine-tune your output</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Environment Section */}
        <Collapsible open={openSections.includes('environment')} onOpenChange={() => toggleSection('environment')}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-6 py-4 flex items-center justify-between group transition-all duration-300 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/10 group-hover:border-emerald-500/30 transition-colors">
                  <Palette className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-left">
                  <span className="font-medium text-sm text-foreground" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Environment</span>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{selectedEnvironment?.name || 'Select scene'}</p>
                </div>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 text-muted-foreground/40 transition-transform duration-300",
                openSections.includes('environment') && "rotate-90"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-5 space-y-3">
              <div className="grid grid-cols-1 gap-2">
                {ENVIRONMENT_PRESETS.map((env) => {
                  const EnvIcon = ENVIRONMENT_ICONS[env.id] || Mountain;
                  const isSelected = settings.environment === env.id;
                  
                  return (
                    <button
                      key={env.id}
                      onClick={() => onSettingsChange({ environment: env.id })}
                      className={cn(
                        "relative flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-left group/env overflow-hidden",
                        isSelected 
                          ? "bg-gradient-to-r from-primary/15 via-primary/10 to-transparent border border-primary/30 shadow-lg shadow-primary/5" 
                          : "bg-muted/20 border border-transparent hover:border-border/30 hover:bg-muted/40"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
                      )}
                      <div className={cn(
                        "relative p-2 rounded-lg transition-all duration-300",
                        isSelected 
                          ? "bg-primary/20" 
                          : "bg-muted/30 group-hover/env:bg-muted/50"
                      )}>
                        <EnvIcon className={cn(
                          "w-4 h-4 transition-colors",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      <div className="relative flex-1">
                        <p className={cn(
                          "text-sm font-medium transition-colors",
                          isSelected ? "text-foreground" : "text-muted-foreground"
                        )} style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                          {env.name}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="relative w-2 h-2 rounded-full bg-primary animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedEnvironment && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border/10">
                  <p className="text-xs text-muted-foreground/80 leading-relaxed italic" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                    "{selectedEnvironment.prompt}"
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Lighting Section */}
        <Collapsible open={openSections.includes('lighting')} onOpenChange={() => toggleSection('lighting')}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-6 py-4 flex items-center justify-between group transition-all duration-300 hover:bg-gradient-to-r hover:from-amber-500/5 hover:to-transparent border-t border-border/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/10 group-hover:border-amber-500/30 transition-colors">
                  <Sun className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-left">
                  <span className="font-medium text-sm text-foreground" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Lighting</span>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 capitalize">{settings.lighting}</p>
                </div>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 text-muted-foreground/40 transition-transform duration-300",
                openSections.includes('lighting') && "rotate-90"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-5 space-y-5">
              <div className="grid grid-cols-2 gap-2">
                {LIGHTING_OPTIONS.map((option) => {
                  const isSelected = settings.lighting === option.id;
                  const Icon = option.icon;
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => onSettingsChange({ lighting: option.id })}
                      className={cn(
                        "relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-300 group/light overflow-hidden",
                        isSelected 
                          ? "bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 shadow-lg shadow-primary/10" 
                          : "bg-muted/20 border border-transparent hover:border-border/30 hover:bg-muted/40"
                      )}
                    >
                      <div className={cn(
                        "p-2.5 rounded-xl transition-all duration-300",
                        isSelected 
                          ? `bg-gradient-to-br ${option.gradient} shadow-lg` 
                          : "bg-muted/50 group-hover/light:bg-muted"
                      )}>
                        <Icon className={cn(
                          "w-4 h-4 transition-colors",
                          isSelected ? "text-white" : "text-muted-foreground"
                        )} />
                      </div>
                      <span className={cn(
                        "text-xs font-medium transition-colors",
                        isSelected ? "text-foreground" : "text-muted-foreground"
                      )} style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground/70" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Intensity</Label>
                  <span className="text-xs font-mono text-primary/80 bg-primary/10 px-2.5 py-1 rounded-lg" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {settings.lightingIntensity}%
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 -mx-1 rounded-full bg-gradient-to-r from-amber-500/20 via-primary/20 to-orange-500/20 blur-sm" />
                  <Slider
                    value={[settings.lightingIntensity]}
                    onValueChange={([val]) => onSettingsChange({ lightingIntensity: val })}
                    max={100}
                    step={5}
                    className="relative"
                  />
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Wildlife Section */}
        <Collapsible open={openSections.includes('wildlife')} onOpenChange={() => toggleSection('wildlife')}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-6 py-4 flex items-center justify-between group transition-all duration-300 hover:bg-gradient-to-r hover:from-green-500/5 hover:to-transparent border-t border-border/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/10 group-hover:border-green-500/30 transition-colors">
                  <TreePine className="w-4 h-4 text-green-400" />
                </div>
                <div className="text-left">
                  <span className="font-medium text-sm text-foreground" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Wildlife</span>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{settings.wildlifeDensity}% density</p>
                </div>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 text-muted-foreground/40 transition-transform duration-300",
                openSections.includes('wildlife') && "rotate-90"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-5 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground/70" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Density</Label>
                <span className="text-xs font-mono text-green-400/80 bg-green-500/10 px-2.5 py-1 rounded-lg" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {settings.wildlifeDensity}%
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-0 -mx-1 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 blur-sm" />
                <Slider
                  value={[settings.wildlifeDensity]}
                  onValueChange={([val]) => onSettingsChange({ wildlifeDensity: val })}
                  max={100}
                  step={10}
                  className="relative"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Bookshelf Section */}
        <Collapsible open={openSections.includes('bookshelf')} onOpenChange={() => toggleSection('bookshelf')}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-6 py-4 flex items-center justify-between group transition-all duration-300 hover:bg-gradient-to-r hover:from-orange-500/5 hover:to-transparent border-t border-border/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/10 group-hover:border-orange-500/30 transition-colors">
                  <BookOpen className="w-4 h-4 text-orange-400" />
                </div>
                <div className="text-left">
                  <span className="font-medium text-sm text-foreground" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Props</span>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{settings.bookshelfItems.length} items</p>
                </div>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 text-muted-foreground/40 transition-transform duration-300",
                openSections.includes('bookshelf') && "rotate-90"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-5">
              <div className="flex flex-wrap gap-2">
                {['Books', 'Plants', 'Awards', 'Photos', 'Art'].map((item) => {
                  const isSelected = settings.bookshelfItems.includes(item);
                  
                  return (
                    <button
                      key={item}
                      onClick={() => {
                        const items = isSelected
                          ? settings.bookshelfItems.filter((i) => i !== item)
                          : [...settings.bookshelfItems, item];
                        onSettingsChange({ bookshelfItems: items });
                      }}
                      className={cn(
                        "px-4 py-2 rounded-full text-xs font-medium transition-all duration-300",
                        isSelected
                          ? "bg-gradient-to-r from-primary/20 to-accent/20 text-foreground border border-primary/30 shadow-lg shadow-primary/10"
                          : "bg-muted/30 text-muted-foreground border border-transparent hover:border-border/30 hover:bg-muted/50"
                      )}
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Quality Section */}
        <Collapsible open={openSections.includes('resolution')} onOpenChange={() => toggleSection('resolution')}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-6 py-4 flex items-center justify-between group transition-all duration-300 hover:bg-gradient-to-r hover:from-violet-500/5 hover:to-transparent border-t border-border/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/10 group-hover:border-violet-500/30 transition-colors">
                  <Layers className="w-4 h-4 text-violet-400" />
                </div>
                <div className="text-left">
                  <span className="font-medium text-sm text-foreground" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Quality</span>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{settings.resolution}</p>
                </div>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 text-muted-foreground/40 transition-transform duration-300",
                openSections.includes('resolution') && "rotate-90"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-5">
              <div className="grid grid-cols-2 gap-3">
                {(['1080p', '4K'] as const).map((res) => {
                  const isSelected = settings.resolution === res;
                  
                  return (
                    <button
                      key={res}
                      onClick={() => onSettingsChange({ resolution: res })}
                      className={cn(
                        "relative p-4 rounded-xl transition-all duration-300 flex flex-col items-center gap-2 overflow-hidden",
                        isSelected
                          ? "bg-gradient-to-br from-violet-500/15 to-purple-500/10 border border-violet-500/30 shadow-lg shadow-violet-500/10"
                          : "bg-muted/20 border border-transparent hover:border-border/30 hover:bg-muted/40"
                      )}
                    >
                      <span className={cn(
                        "text-lg font-bold transition-colors",
                        isSelected ? "text-foreground" : "text-muted-foreground"
                      )} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {res}
                      </span>
                      {res === '4K' && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                          PRO
                        </span>
                      )}
                      {res === '1080p' && (
                        <span className="text-[10px] text-muted-foreground/60">Full HD</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/5">
        <div className="p-3 rounded-xl bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-border/10">
          <p className="text-[10px] text-center text-muted-foreground/60" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
            Settings apply to next generation
          </p>
        </div>
      </div>
    </div>
  );
}