import { useState, useEffect, memo, forwardRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Volume2,
  Monitor, Moon, Sun, Zap, Sparkles, Save, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserPreferences {
  defaultQualityTier: string;
  defaultGenre: string;
  theme: 'light' | 'dark' | 'system';
  autoplayVideos: boolean;
  defaultPlaybackSpeed: number;
  defaultVolume: number;
  showTutorialHints: boolean;
  compactMode: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultQualityTier: 'standard',
  defaultGenre: 'cinematic',
  theme: 'dark',
  autoplayVideos: true,
  defaultPlaybackSpeed: 1,
  defaultVolume: 80,
  showTutorialHints: true,
  compactMode: false,
};

const QUALITY_TIERS = [
  { value: 'standard', label: 'Standard', desc: 'Fast generation, good quality' },
  { value: 'pro', label: 'Pro', desc: 'Higher quality, more details' },
  { value: 'cinematic', label: 'Cinematic', desc: 'Best quality, longer processing' },
];

const GENRES = [
  { value: 'ad', label: 'Advertisement' },
  { value: 'educational', label: 'Educational' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'funny', label: 'Comedy' },
  { value: 'motivational', label: 'Motivational' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'explainer', label: 'Explainer' },
  { value: 'vlog', label: 'Vlog' },
];

export const PreferencesSettings = memo(forwardRef<HTMLDivElement, Record<string, never>>(function PreferencesSettings(_, ref) {
  const { user, profile, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  // Load preferences from database on mount
  useEffect(() => {
    if (profile) {
      const savedPrefs = profile.preferences as unknown as UserPreferences | null;
      if (savedPrefs) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...savedPrefs });
      }
      setIsLoading(false);
    }
  }, [profile]);

  const updatePreference = <K extends keyof UserPreferences>(
    key: K, 
    value: UserPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ preferences: preferences as any })
        .eq('id', user.id);

      if (error) throw error;

      // Apply theme
      if (preferences.theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else if (preferences.theme === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        // System theme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }

      await refreshProfile();
      setHasChanges(false);
      toast.success('Preferences saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div ref={ref} className="space-y-12">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Preferences</div>
          <h2 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>Customize your experience.</h2>
        </div>
        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-white text-black hover:bg-white/90"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      {/* Default Generation Settings */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-2"
      >
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Generation defaults</div>
          <h3 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>Default options for new projects.</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Default Quality */}
          <div className="space-y-3">
            <Label className="text-white/60">Default Quality Tier</Label>
            <Select
              value={preferences.defaultQualityTier}
              onValueChange={(value) => updatePreference('defaultQualityTier', value)}
            >
              <SelectTrigger className="bg-glass-hover border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/95 border-white/10">
                {QUALITY_TIERS.map(tier => (
                  <SelectItem 
                    key={tier.value} 
                    value={tier.value}
                    className="text-white hover:bg-white/10 focus:bg-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className={cn(
                        "w-4 h-4",
                        tier.value === 'cinematic' ? 'text-amber-400' :
                        tier.value === 'pro' ? 'text-[hsl(215,100%,72%)]' : 'text-white/40'
                      )} />
                      <div>
                        <span className="font-medium">{tier.label}</span>
                        <span className="text-white/40 ml-2 text-xs">{tier.desc}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default Genre */}
          <div className="space-y-3">
            <Label className="text-white/60">Default Genre</Label>
            <Select
              value={preferences.defaultGenre}
              onValueChange={(value) => updatePreference('defaultGenre', value)}
            >
              <SelectTrigger className="bg-glass-hover border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/95 border-white/10">
                {GENRES.map(genre => (
                  <SelectItem 
                    key={genre.value} 
                    value={genre.value}
                    className="text-white hover:bg-white/10 focus:bg-white/10"
                  >
                    {genre.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.section>

      {/* Appearance */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="py-2"
      >
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Appearance</div>
          <h3 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>The look and feel.</h3>
        </div>

        <div className="space-y-6">
          {/* Theme Selection */}
          <div className="space-y-3">
            <Label className="text-white/60">Theme</Label>
            <div className="flex gap-3">
              {[
                { value: 'light', icon: Sun, label: 'Light' },
                { value: 'dark', icon: Moon, label: 'Dark' },
                { value: 'system', icon: Monitor, label: 'System' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => updatePreference('theme', option.value as UserPreferences['theme'])}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all",
                    preferences.theme === option.value
                      ? "bg-white/10 border-white/20 text-white"
                      : "border-white/[0.06] text-white/50 hover:text-white hover:border-white/10"
                  )}
                >
                  <option.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Compact Mode */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-white/[0.06]">
            <div>
              <p className="font-medium text-white">Compact Mode</p>
              <p className="text-sm text-white/50">Use a more condensed layout</p>
            </div>
            <Switch
              checked={preferences.compactMode}
              onCheckedChange={(checked) => updatePreference('compactMode', checked)}
            />
          </div>

          {/* Tutorial Hints */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <div>
                <p className="font-medium text-white">Tutorial Hints</p>
                <p className="text-sm text-white/50">Show helpful tips and guides</p>
              </div>
            </div>
            <Switch
              checked={preferences.showTutorialHints}
              onCheckedChange={(checked) => updatePreference('showTutorialHints', checked)}
            />
          </div>
        </div>
      </motion.section>

      {/* Playback Settings */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="py-2"
      >
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55 font-mono">◆ Playback</div>
          <h3 className="mt-2 font-display italic text-[clamp(1.4rem,2.2vw,1.9rem)] font-light tracking-tight text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>Video playback preferences.</h3>
        </div>

        <div className="space-y-6">
          {/* Autoplay */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-glass border border-white/[0.06]">
            <div>
              <p className="font-medium text-white">Autoplay Videos</p>
              <p className="text-sm text-white/50">Automatically play videos when visible</p>
            </div>
            <Switch
              checked={preferences.autoplayVideos}
              onCheckedChange={(checked) => updatePreference('autoplayVideos', checked)}
            />
          </div>

          {/* Default Volume */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-white/60 flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Default Volume
              </Label>
              <span className="text-sm text-white/50">{preferences.defaultVolume}%</span>
            </div>
            <Slider
              value={[preferences.defaultVolume]}
              onValueChange={([value]) => updatePreference('defaultVolume', value)}
              min={0}
              max={100}
              step={5}
              className="py-2"
            />
          </div>

          {/* Default Playback Speed */}
          <div className="space-y-3">
            <Label className="text-white/60">Default Playback Speed</Label>
            <div className="flex gap-2">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                <button
                  key={speed}
                  onClick={() => updatePreference('defaultPlaybackSpeed', speed)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                    preferences.defaultPlaybackSpeed === speed
                      ? "bg-white text-black"
                      : "bg-glass-hover text-white/60 hover:text-white hover:bg-white/10"
                  )}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}));