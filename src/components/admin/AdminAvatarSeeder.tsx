import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
        // Continue with next avatar after a brief delay
        setTimeout(() => generateNextBatch(), 2000);
      } else {
        setIsGenerating(false);
        toast.success('Avatar library generation complete!');
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error(`Error at avatar ${currentIndex + 1}: ${err}`);
      setIsGenerating(false);
    }
  };

  const startGeneration = () => {
    setIsGenerating(true);
    setIsPaused(false);
    setResults([]);
    setCurrentIndex(0);
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
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>AI Avatar Generator</CardTitle>
              <CardDescription>
                Generate photorealistic avatars for the template library
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" />
            {presets.length} presets
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={loadPresets}
            disabled={isLoading || isGenerating}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Load Presets
          </Button>

          {presets.length > 0 && !isGenerating && (
            <Button onClick={startGeneration} className="gap-2">
              <Play className="w-4 h-4" />
              {currentIndex > 0 ? 'Restart Generation' : 'Start Generation'}
            </Button>
          )}

          {isGenerating && (
            <Button variant="outline" onClick={pauseGeneration} className="gap-2">
              <Pause className="w-4 h-4" />
              Pause
            </Button>
          )}

          {isPaused && currentIndex < presets.length && (
            <Button onClick={resumeGeneration} className="gap-2">
              <Play className="w-4 h-4" />
              Resume
            </Button>
          )}
        </div>

        {/* Progress */}
        {(isGenerating || results.length > 0) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isGenerating ? 'Generating...' : 'Complete'}
              </span>
              <span className="font-medium">
                {currentIndex} / {presets.length}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
                {successCount} success
              </div>
              <div className="flex items-center gap-1 text-destructive">
                <XCircle className="w-4 h-4" />
                {failCount} failed
              </div>
            </div>
          </div>
        )}

        {/* Current Avatar Being Generated */}
        {isGenerating && presets[currentIndex] && (
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground mb-1">Currently generating:</p>
            <p className="font-medium">{presets[currentIndex].name}</p>
            <p className="text-sm text-muted-foreground">
              {presets[currentIndex].ethnicity} {presets[currentIndex].gender}, {presets[currentIndex].style}
            </p>
          </div>
        )}

        {/* Results Log */}
        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Generation Log</p>
            <ScrollArea className="h-48 rounded-lg border">
              <div className="p-3 space-y-2">
                {results.map((result, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-3 p-2 rounded bg-muted/30"
                  >
                    {result.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.name}</p>
                      {result.error && (
                        <p className="text-xs text-destructive truncate">{result.error}</p>
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
            <p className="text-sm font-medium">Avatar Presets</p>
            <ScrollArea className="h-48 rounded-lg border">
              <div className="p-3 space-y-2">
                {presets.map((preset, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-3 p-2 rounded bg-muted/30"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{preset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {preset.ethnicity} {preset.gender} • {preset.style}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
