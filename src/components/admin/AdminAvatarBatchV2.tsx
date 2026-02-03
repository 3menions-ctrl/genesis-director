import { useState, useCallback, useRef } from 'react';
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
  RefreshCw,
  Globe,
  History,
  Wand2,
  PawPrint,
  AlertTriangle
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PresetSummary {
  total: number;
  categories: {
    "global-modern": number;
    "historical": number;
    "archetype": number;
    "animal-realistic": number;
    "animal-animated": number;
  };
  presets: Array<{
    index: number;
    name: string;
    category: string;
    avatarType: string;
    gender: string;
  }>;
}

interface GenerationResult {
  name: string;
  success: boolean;
  error?: string;
  imageUrl?: string;
  category?: string;
  avatarType?: string;
}

const CATEGORY_INFO = {
  "global-modern": { icon: Globe, label: "Global Cultures", color: "text-blue-500" },
  "historical": { icon: History, label: "Historical Figures", color: "text-amber-500" },
  "archetype": { icon: Wand2, label: "Archetypes", color: "text-purple-500" },
  "animal-realistic": { icon: PawPrint, label: "Realistic Animals", color: "text-green-500" },
  "animal-animated": { icon: PawPrint, label: "Animated Animals", color: "text-pink-500" },
};

export function AdminAvatarBatchV2() {
  const [presetSummary, setPresetSummary] = useState<PresetSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const pauseRef = useRef(false);

  const loadPresets = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in as admin");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-avatar-batch-v2`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "list-presets" }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load presets: ${response.status}`);
      }

      const data = await response.json();
      setPresetSummary(data);
      toast.success(`Loaded ${data.total} avatar presets across ${Object.keys(data.categories).length} categories`);
    } catch (err) {
      console.error("Failed to load presets:", err);
      toast.error("Failed to load avatar presets");
    } finally {
      setIsLoading(false);
    }
  };

  const generateNextBatch = useCallback(async (fromIndex: number) => {
    if (pauseRef.current || !presetSummary) {
      setIsGenerating(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expired");
        setIsGenerating(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-avatar-batch-v2`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            action: "generate",
            startIndex: fromIndex,
            count: 1, // One at a time for progress tracking
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();

      if (data.rateLimited) {
        setRateLimited(true);
        setIsGenerating(false);
        setCurrentIndex(data.nextIndex);
        if (data.results) {
          setResults(prev => [...prev, ...data.results]);
        }
        toast.warning("Rate limited! Wait 60 seconds then click Resume.");
        return;
      }

      if (data.results) {
        setResults(prev => [...prev, ...data.results]);
      }

      if (data.nextIndex !== null && !pauseRef.current) {
        setCurrentIndex(data.nextIndex);
        // Continue after delay
        setTimeout(() => generateNextBatch(data.nextIndex), 3000);
      } else {
        setIsGenerating(false);
        setCurrentIndex(data.nextIndex ?? presetSummary.total);
        toast.success(`Avatar batch generation complete! ${data.successCount} succeeded, ${data.failCount} failed.`);
      }
    } catch (err) {
      console.error("Generation error:", err);
      toast.error(`Generation error: ${err}`);
      setIsGenerating(false);
    }
  }, [presetSummary]);

  const startGeneration = () => {
    setIsGenerating(true);
    setIsPaused(false);
    setRateLimited(false);
    pauseRef.current = false;
    setResults([]);
    setCurrentIndex(0);
    generateNextBatch(0);
  };

  const pauseGeneration = () => {
    pauseRef.current = true;
    setIsPaused(true);
    setIsGenerating(false);
    toast.info("Generation paused. Progress saved.");
  };

  const resumeGeneration = () => {
    setIsPaused(false);
    setRateLimited(false);
    pauseRef.current = false;
    setIsGenerating(true);
    generateNextBatch(currentIndex);
  };

  const total = presetSummary?.total ?? 0;
  const progress = total > 0 ? (currentIndex / total) * 100 : 0;
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  const filteredPresets = presetSummary?.presets.filter(p => 
    selectedCategory === "all" || p.category === selectedCategory
  ) ?? [];

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Avatar Batch V2 Generator</CardTitle>
              <CardDescription>
                Generate 70 new diverse avatars: cultures, historical, animals
              </CardDescription>
            </div>
          </div>
          {presetSummary && (
            <Badge variant="outline" className="gap-1">
              <Users className="w-3 h-3" />
              {presetSummary.total} presets
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category Summary */}
        {presetSummary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(CATEGORY_INFO).map(([key, info]) => {
              const count = presetSummary.categories[key as keyof typeof presetSummary.categories] ?? 0;
              const Icon = info.icon;
              return (
                <div 
                  key={key}
                  className={`p-3 rounded-lg border bg-muted/30 cursor-pointer transition-colors ${
                    selectedCategory === key ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedCategory(selectedCategory === key ? "all" : key)}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${info.color}`} />
                    <span className="text-xs font-medium">{info.label}</span>
                  </div>
                  <p className="text-lg font-bold mt-1">{count}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Rate Limit Warning */}
        {rateLimited && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-500">Rate Limited</p>
              <p className="text-sm text-muted-foreground">
                Wait 60 seconds before resuming. Progress is saved at avatar {currentIndex + 1}.
              </p>
            </div>
          </div>
        )}

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

          {presetSummary && !isGenerating && !isPaused && !rateLimited && (
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

          {(isPaused || rateLimited) && currentIndex < total && (
            <Button onClick={resumeGeneration} className="gap-2">
              <Play className="w-4 h-4" />
              Resume from #{currentIndex + 1}
            </Button>
          )}
        </div>

        {/* Progress */}
        {(isGenerating || results.length > 0) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isGenerating ? 'Generating...' : isPaused ? 'Paused' : rateLimited ? 'Rate Limited' : 'Complete'}
              </span>
              <span className="font-medium">
                {currentIndex} / {total}
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
        {isGenerating && presetSummary?.presets[currentIndex] && (
          <div className="p-4 rounded-lg bg-muted/50 border animate-pulse">
            <p className="text-sm text-muted-foreground mb-1">Currently generating:</p>
            <p className="font-medium">{presetSummary.presets[currentIndex].name}</p>
            <p className="text-sm text-muted-foreground">
              {presetSummary.presets[currentIndex].category} • {presetSummary.presets[currentIndex].avatarType}
            </p>
          </div>
        )}

        {/* Tabs: Results vs Presets */}
        <Tabs defaultValue={results.length > 0 ? "results" : "presets"}>
          <TabsList>
            <TabsTrigger value="presets">Presets ({filteredPresets.length})</TabsTrigger>
            <TabsTrigger value="results">Results ({results.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="presets">
            {filteredPresets.length > 0 && (
              <ScrollArea className="h-64 rounded-lg border">
                <div className="p-3 space-y-2">
                  {filteredPresets.map((preset) => {
                    const catInfo = CATEGORY_INFO[preset.category as keyof typeof CATEGORY_INFO];
                    const Icon = catInfo?.icon ?? Users;
                    return (
                      <div 
                        key={preset.index}
                        className="flex items-center gap-3 p-2 rounded bg-muted/30"
                      >
                        <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium ${
                          preset.index < currentIndex ? 'bg-emerald-500/20 text-emerald-500' : ''
                        }`}>
                          {preset.index < currentIndex ? <CheckCircle2 className="w-4 h-4" /> : preset.index + 1}
                        </div>
                        <Icon className={`w-4 h-4 ${catInfo?.color ?? 'text-muted-foreground'}`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{preset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {preset.gender} • {preset.avatarType}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {catInfo?.label ?? preset.category}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="results">
            {results.length > 0 && (
              <ScrollArea className="h-64 rounded-lg border">
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
                        {result.category && (
                          <p className="text-xs text-muted-foreground">{result.category}</p>
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
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
