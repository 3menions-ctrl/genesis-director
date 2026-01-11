import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
  Settings, Palette, Volume2, Play, Film, 
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

export function PreferencesSettings() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [preferences, setPreferences] = useState<UserPreferences>({
    defaultQualityTier: 'standard',
    defaultGenre: 'cinematic',
    theme: 'dark',
    autoplayVideos: true,
    defaultPlaybackSpeed: 1,
    defaultVolume: 80,
    showTutorialHints: true,
    compactMode: false,
  });

  // Load preferences from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('user_preferences');
    if (saved) {
      try {
        setPreferences(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading preferences:', e);
      }
    }
  }, []);

  const updatePreference = <K extends keyof UserPreferences>(
    key: K, 
    value: UserPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem('user_preferences', JSON.stringify(preferences));
      
      // Apply theme
      if (preferences.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (preferences.theme === 'light') {
        document.documentElement.classList.remove('dark');
      }

      setHasChanges(false);
      toast.success('Preferences saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Preferences</h2>
          <p className="text-sm text-white/50">Customize your experience</p>
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
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
            <Film className="w-5 h-5 text-white/40" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Generation Defaults</h3>
            <p className="text-sm text-white/50">Set default options for new projects</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Default Quality */}
          <div className="space-y-3">
            <Label className="text-white/60">Default Quality Tier</Label>
            <Select
              value={preferences.defaultQualityTier}
              onValueChange={(value) => updatePreference('defaultQualityTier', value)}
            >
              <SelectTrigger className="bg-white/[0.05] border-white/10 text-white">
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
                        tier.value === 'pro' ? 'text-purple-400' : 'text-white/40'
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
              <SelectTrigger className="bg-white/[0.05] border-white/10 text-white">
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
      </motion.div>

      {/* Appearance */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
            <Palette className="w-5 h-5 text-white/40" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Appearance</h3>
            <p className="text-sm text-white/50">Customize the look and feel</p>
          </div>
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
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
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
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
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
      </motion.div>

      {/* Playback Settings */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
            <Play className="w-5 h-5 text-white/40" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Playback</h3>
            <p className="text-sm text-white/50">Video playback preferences</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Autoplay */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
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
                      : "bg-white/[0.05] text-white/60 hover:text-white hover:bg-white/10"
                  )}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
