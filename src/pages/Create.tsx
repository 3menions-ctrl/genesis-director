import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoryWizard } from '@/components/studio/StoryWizard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStudio } from '@/contexts/StudioContext';
import { Loader2, Wand2, ArrowRight, RotateCcw, Copy, Check } from 'lucide-react';
import { StoryWizardData } from '@/types/movie';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const CREATIVE_QUOTES = [
  "Every great film begins with a single idea",
  "Characters are the heart of every story",
  "The best stories feel like magic",
];

export default function Create() {
  const navigate = useNavigate();
  const { deductCredits, canAffordDuration, setActiveProjectId, refreshProjects } = useStudio();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Initializing...');
  const [storyData, setStoryData] = useState<StoryWizardData | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Cycle through quotes during generation
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setQuoteIndex(i => (i + 1) % CREATIVE_QUOTES.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  // Simulate progress steps
  useEffect(() => {
    if (isGenerating) {
      const messages = [
        { at: 10, msg: 'Analyzing story elements...' },
        { at: 25, msg: 'Building character arcs...' },
        { at: 40, msg: 'Crafting dialogue...' },
        { at: 55, msg: 'Weaving plot threads...' },
        { at: 70, msg: 'Adding dramatic tension...' },
        { at: 85, msg: 'Polishing the narrative...' },
        { at: 95, msg: 'Final touches...' },
      ];
      
      const interval = setInterval(() => {
        setProgress(p => {
          const next = Math.min(p + Math.random() * 6, 95);
          const currentMsg = messages.filter(m => m.at <= next).pop();
          if (currentMsg) setProgressMessage(currentMsg.msg);
          return next;
        });
      }, 600);
      
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  const handleWizardComplete = async (data: StoryWizardData) => {
    const durationSeconds = Math.round(data.targetDurationMinutes * 60);
    
    if (!canAffordDuration(durationSeconds)) {
      toast.error('Insufficient credits for this duration.');
      return;
    }
    
    const creditsDeducted = deductCredits(durationSeconds);
    if (!creditsDeducted) {
      return;
    }
    
    setStoryData(data);
    setIsGenerating(true);
    setProgress(10);

    try {
      const { data: scriptData, error } = await supabase.functions.invoke('generate-script', {
        body: {
          title: data.title,
          genre: data.genre,
          storyStructure: data.storyStructure,
          targetDurationMinutes: data.targetDurationMinutes,
          setting: data.setting,
          timePeriod: data.timePeriod,
          mood: data.mood,
          movieIntroStyle: data.movieIntroStyle,
          characters: data.characters,
          synopsis: data.synopsis,
        },
      });

      if (error || !scriptData?.success) {
        throw new Error(scriptData?.error || error?.message || 'Failed to generate script');
      }

      setProgress(100);
      
      // Save to database
      const savedProjectId = await saveProjectToDb(data, scriptData.script);
      
      if (savedProjectId) {
        await refreshProjects();
        setActiveProjectId(savedProjectId);
        setProjectId(savedProjectId);
        setGeneratedScript(scriptData.script);
        toast.success('Script generated successfully!');
      } else {
        // Still show the script even if save failed
        setGeneratedScript(scriptData.script);
        toast.error('Script generated but failed to save');
      }

    } catch (err) {
      console.error('Script generation error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate script');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveProjectToDb = async (data: StoryWizardData, script: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user');
        return null;
      }

      const { data: project, error } = await supabase
        .from('movie_projects')
        .insert({
          user_id: user.id,
          title: data.title,
          genre: data.genre,
          story_structure: data.storyStructure,
          target_duration_minutes: Math.round(data.targetDurationMinutes * 60),
          setting: data.setting,
          time_period: data.timePeriod,
          mood: data.mood,
          movie_intro_style: data.movieIntroStyle,
          synopsis: data.synopsis,
          generated_script: script,
          status: 'script_ready',
          include_narration: data.includeNarration,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to save project:', error);
        return null;
      }

      if (project) {
        for (const char of data.characters) {
          if (char.name) {
            const { data: charData } = await supabase
              .from('characters')
              .insert({
                user_id: user.id,
                name: char.name,
                description: char.description,
                personality: char.personality,
              })
              .select()
              .single();
            
            if (charData) {
              await supabase
                .from('project_characters')
                .insert({
                  project_id: project.id,
                  character_id: charData.id,
                  role: char.role,
                });
            }
          }
        }
        return project.id;
      }
      return null;
    } catch (err) {
      console.error('Failed to save project:', err);
      return null;
    }
  };

  const handleCopyScript = async () => {
    if (generatedScript) {
      await navigator.clipboard.writeText(generatedScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartOver = () => {
    setGeneratedScript(null);
    setStoryData(null);
    setProjectId(null);
    setProgress(0);
  };

  const handleContinue = () => {
    navigate('/script');
  };

  // Show generated script
  if (generatedScript) {
    return (
      <div className="min-h-[85vh] flex flex-col p-4 lg:p-6">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {storyData?.title || 'Your Script'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Review and edit your generated script
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyScript}
                className="gap-2 text-muted-foreground"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartOver}
                className="gap-2 text-muted-foreground"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </Button>
              <Button
                onClick={handleContinue}
                size="sm"
                className="gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Script Display */}
          <div className="glass-card flex-1 p-6 overflow-hidden flex flex-col">
            <Textarea
              value={generatedScript}
              onChange={(e) => setGeneratedScript(e.target.value)}
              className="flex-1 min-h-[500px] resize-none border-0 bg-transparent focus-visible:ring-0 text-sm leading-relaxed font-mono"
              placeholder="Your script will appear here..."
            />
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isGenerating) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="glass-card p-10 text-center">
            <div className="relative w-20 h-20 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full border border-border animate-spin-slow" />
              <div className="absolute inset-3 rounded-full bg-foreground flex items-center justify-center">
                <Wand2 className="w-6 h-6 text-background" />
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-medium text-foreground mb-3">
                Creating Your Story
              </h2>
              <p className="text-sm text-muted-foreground animate-fade-in" key={quoteIndex}>
                {CREATIVE_QUOTES[quoteIndex]}
              </p>
            </div>

            <div className="space-y-3">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full bg-foreground transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{progressMessage}</span>
                </div>
                <span className="font-mono text-foreground">{Math.round(progress)}%</span>
              </div>
            </div>

            {storyData && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6 pt-6 border-t border-border">
                <span className="px-2.5 py-1 rounded-md bg-secondary text-muted-foreground text-xs">
                  {storyData.title}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show wizard
  return (
    <div className="min-h-[85vh] flex flex-col">
      <div className="flex-1 px-4 lg:px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card overflow-hidden">
            <StoryWizard
              onComplete={handleWizardComplete}
              onCancel={() => navigate('/projects')}
              initialData={storyData || undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
