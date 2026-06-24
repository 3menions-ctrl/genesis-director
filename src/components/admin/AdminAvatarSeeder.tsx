import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sparkles,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  RefreshCw
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FloatSection,
  DeckButton,
  StatusPill,
  CYAN,
  ROSE,
  ACCENT_HSL,
  accent,
} from '@/admin/ui/primitives';

interface AvatarPreset {
  name: string;
  gender: string;
  ageRange: string;
  ethnicity: string;
  style: string;
  personality: string;
  clothing: string;
}

interface GenerationResult {
  name: string;
  success: boolean;
  error?: string;
  imageUrl?: string;
}

export function AdminAvatarSeeder() {
  const [presets, setPresets] = useState<AvatarPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const loadPresets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-avatar-library', {
        body: { action: 'list-presets' },
      });

      if (error) throw error;
      setPresets(data.presets || []);
      toast.success(`Loaded ${data.presets?.length || 0} avatar presets`);
    } catch (err) {
      console.error('Failed to load presets:', err);
      toast.error('Failed to load avatar presets');
    } finally {
      setIsLoading(false);
    }
  };

  const generateNextBatch = async () => {
    if (isPaused || currentIndex >= presets.length) {
      setIsGenerating(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('seed-avatar-library', {
        body: {
          action: 'generate',
          startIndex: currentIndex,
          count: 1, // Generate one at a time for better progress tracking
        },
      });

      if (error) throw error;

      if (data.results) {
        setResults(prev => [...prev, ...data.results]);
      }

      if (data.nextIndex !== null) {
        setCurrentIndex(data.nextIndex);
        // Skipped (already seeded) → no rate-limit needed; real gen → small delay
        const wasSkipped = data.results?.[0]?.skipped === true;
        setTimeout(() => generateNextBatch(), wasSkipped ? 50 : 1500);
      } else {
        setIsGenerating(false);
        toast.success('Avatar library generation complete!');
      }
    } catch (err) {
      console.error('Generation error:', err);
      // Auto-resume: log failure, skip this preset, keep going
      setResults(prev => [...prev, {
        name: presets[currentIndex]?.name || `#${currentIndex}`,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }]);
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => generateNextBatch(), 3000);
    }
  };

  const startGeneration = (resumeFromIndex?: number) => {
    setIsGenerating(true);
    setIsPaused(false);
    if (resumeFromIndex === undefined) {
      setResults([]);
      setCurrentIndex(0);
    }
    generateNextBatch();
  };

  const pauseGeneration = () => {
    setIsPaused(true);
    setIsGenerating(false);
    toast.info('Generation paused');
  };

  const resumeGeneration = () => {
    setIsPaused(false);
    setIsGenerating(true);
    generateNextBatch();
  };

  const progress = presets.length > 0 ? (currentIndex / presets.length) * 100 : 0;
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <FloatSection
      title="AI Avatar Generator"
      meta="template library seeder"
      actions={
        <StatusPill tone="accent">
          <Users className="w-3 h-3" />
          {presets.length} presets
        </StatusPill>
      }
    >
      <div className="space-y-6">
        <p className="text-sm text-white/50">
          Generate photorealistic avatars for the template library
        </p>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <DeckButton
            onClick={loadPresets}
            disabled={isLoading || isGenerating}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
            )}
            Load Presets
          </DeckButton>

          {presets.length > 0 && !isGenerating && (
            <DeckButton primary onClick={() => startGeneration()}>
              <Play className="w-3.5 h-3.5 mr-2" />
              {currentIndex > 0 ? 'Restart Generation' : 'Start Generation'}
            </DeckButton>
          )}

          {isGenerating && (
            <DeckButton onClick={pauseGeneration}>
              <Pause className="w-3.5 h-3.5 mr-2" />
              Pause
            </DeckButton>
          )}

          {isPaused && currentIndex < presets.length && (
            <DeckButton primary onClick={resumeGeneration}>
              <Play className="w-3.5 h-3.5 mr-2" />
              Resume
            </DeckButton>
          )}
        </div>

        {/* Progress */}
        {(isGenerating || results.length > 0) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">
                {isGenerating ? 'Generating…' : 'Complete'}
              </span>
              <span className="font-medium text-white/85">
                {currentIndex} / {presets.length}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${ACCENT_HSL}, ${CYAN})` }}
              />
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1" style={{ color: CYAN }}>
                <CheckCircle2 className="w-4 h-4" />
                {successCount} success
              </div>
              <div className="flex items-center gap-1" style={{ color: ROSE }}>
                <XCircle className="w-4 h-4" />
                {failCount} failed
              </div>
            </div>
          </div>
        )}

        {/* Current Avatar Being Generated */}
        {isGenerating && presets[currentIndex] && (
          <div className="p-4 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm text-white/50 mb-1">Currently generating:</p>
            <p className="font-medium text-white/90">{presets[currentIndex].name}</p>
            <p className="text-sm text-white/50">
              {presets[currentIndex].ethnicity} {presets[currentIndex].gender}, {presets[currentIndex].style}
            </p>
          </div>
        )}

        {/* Results Log */}
        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/85">Generation Log</p>
            <ScrollArea className="h-48 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="p-3 space-y-2">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2 rounded"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    {result.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: CYAN }} />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0" style={{ color: ROSE }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-white/85">{result.name}</p>
                      {result.error && (
                        <p className="text-xs truncate" style={{ color: ROSE }}>{result.error}</p>
                      )}
                    </div>
                    {result.imageUrl && (
                      <img
                        src={result.imageUrl}
                        alt={result.name}
                        className="w-10 h-10 rounded object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Presets Preview */}
        {presets.length > 0 && !isGenerating && results.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/85">Avatar Presets</p>
            <ScrollArea className="h-48 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="p-3 space-y-2">
                {presets.map((preset, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2 rounded"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white/85" style={{ background: accent(0.12) }}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white/85">{preset.name}</p>
                      <p className="text-xs text-white/50">
                        {preset.ethnicity} {preset.gender} • {preset.style}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </FloatSection>
  );
}
