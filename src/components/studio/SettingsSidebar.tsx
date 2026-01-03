import { useState } from 'react';
import { Settings, Sun, TreePine, BookOpen, Image, Layers, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StudioSettings, ENVIRONMENT_PRESETS } from '@/types/studio';
import { cn } from '@/lib/utils';

interface SettingsSidebarProps {
  settings: StudioSettings;
  onSettingsChange: (settings: Partial<StudioSettings>) => void;
}

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
    <div className="h-full flex flex-col w-full">
      <div className="p-5 border-b border-border/10">
        <div className="flex items-center gap-3">
          <div className="icon-container p-2.5">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Settings</h3>
            <p className="text-xs text-muted-foreground">Customize output</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Environment */}
        <Collapsible open={openSections.includes('environment')} onOpenChange={() => toggleSection('environment')}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-foreground/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="icon-container-success p-2">
                  <Image className="w-4 h-4 text-success" />
                </div>
                <span className="font-medium text-sm">Environment</span>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                openSections.includes('environment') && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-4 space-y-3">
              <Select value={settings.environment} onValueChange={(value) => onSettingsChange({ environment: value })}>
                <SelectTrigger className="glass-subtle border-border/20 h-12 rounded-xl">
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent className="glass border-border/20">
                  {ENVIRONMENT_PRESETS.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedEnvironment && (
                <div className="p-3 rounded-xl glass-subtle">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedEnvironment.prompt}
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Lighting */}
        <Collapsible open={openSections.includes('lighting')} onOpenChange={() => toggleSection('lighting')}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-foreground/[0.02] transition-colors border-t border-border/10">
              <div className="flex items-center gap-3">
                <div className="icon-container-warning p-2">
                  <Sun className="w-4 h-4 text-warning" />
                </div>
                <span className="font-medium text-sm">Lighting</span>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                openSections.includes('lighting') && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(['natural', 'studio', 'dramatic', 'soft'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => onSettingsChange({ lighting: type })}
                    className={cn(
                      "px-3 py-2.5 rounded-xl text-sm font-medium capitalize transition-all duration-200",
                      settings.lighting === type
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "glass-subtle text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Intensity</Label>
                  <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md">{settings.lightingIntensity}%</span>
                </div>
                <Slider
                  value={[settings.lightingIntensity]}
                  onValueChange={([val]) => onSettingsChange({ lightingIntensity: val })}
                  max={100}
                  step={5}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Wildlife */}
        <Collapsible open={openSections.includes('wildlife')} onOpenChange={() => toggleSection('wildlife')}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-foreground/[0.02] transition-colors border-t border-border/10">
              <div className="flex items-center gap-3">
                <div className="icon-container-success p-2">
                  <TreePine className="w-4 h-4 text-success" />
                </div>
                <span className="font-medium text-sm">Wildlife</span>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                openSections.includes('wildlife') && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Density</Label>
                <span className="text-xs font-mono text-success bg-success/10 px-2 py-0.5 rounded-md">{settings.wildlifeDensity}%</span>
              </div>
              <Slider
                value={[settings.wildlifeDensity]}
                onValueChange={([val]) => onSettingsChange({ wildlifeDensity: val })}
                max={100}
                step={10}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Bookshelf */}
        <Collapsible open={openSections.includes('bookshelf')} onOpenChange={() => toggleSection('bookshelf')}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-foreground/[0.02] transition-colors border-t border-border/10">
              <div className="flex items-center gap-3">
                <div className="icon-container-warning p-2">
                  <BookOpen className="w-4 h-4 text-warning" />
                </div>
                <span className="font-medium text-sm">Bookshelf</span>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                openSections.includes('bookshelf') && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-4">
              <div className="flex flex-wrap gap-2">
                {['Books', 'Plants', 'Awards', 'Photos', 'Art'].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      const items = settings.bookshelfItems.includes(item)
                        ? settings.bookshelfItems.filter((i) => i !== item)
                        : [...settings.bookshelfItems, item];
                      onSettingsChange({ bookshelfItems: items });
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      settings.bookshelfItems.includes(item)
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "glass-subtle text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Quality */}
        <Collapsible open={openSections.includes('resolution')} onOpenChange={() => toggleSection('resolution')}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-foreground/[0.02] transition-colors border-t border-border/10">
              <div className="flex items-center gap-3">
                <div className="icon-container-accent p-2">
                  <Layers className="w-4 h-4 text-accent" />
                </div>
                <span className="font-medium text-sm">Quality</span>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                openSections.includes('resolution') && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-4">
              <div className="grid grid-cols-2 gap-2">
                {(['1080p', '4K'] as const).map((res) => (
                  <button
                    key={res}
                    onClick={() => onSettingsChange({ resolution: res })}
                    className={cn(
                      "px-3 py-2.5 rounded-xl text-sm font-mono transition-all duration-200 flex items-center justify-center gap-1.5",
                      settings.resolution === res
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "glass-subtle text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {res}
                    {res === '4K' && (
                      <span className="text-[10px] text-warning font-semibold">PRO</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}