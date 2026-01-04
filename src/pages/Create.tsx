import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoryWizard } from '@/components/studio/StoryWizard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStudio } from '@/contexts/StudioContext';
import { Loader2, Wand2 } from 'lucide-react';
import { StoryWizardData } from '@/types/movie';
import { cn } from '@/lib/utils';

const CREATIVE_QUOTES = [
  "Every great film begins with a single idea",
  "Characters are the heart of every story",
  "The best stories feel like magic",
];

export default function Create() {
  const navigate = useNavigate();
  const { activeProject, updateProject, deductCredits, canAffordDuration } = useStudio();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Initializing...');
  const [storyData, setStoryData] = useState<StoryWizardData | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);

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
    // Calculate duration in seconds from minutes
    const durationSeconds = Math.round(data.targetDurationMinutes * 60);
    
    // Check if user can afford this duration
    if (!canAffordDuration(durationSeconds)) {
      toast.error('Insufficient credits for this duration. Please select a shorter duration or purchase more credits.');
      return;
    }
    
    // Deduct credits before proceeding
    const creditsDeducted = deductCredits(durationSeconds);
    if (!creditsDeducted) {
      return;
    }
    
    setStoryData(data);
    setIsGenerating(true);
    setProgress(10);

    try {
      toast.info('Generating your movie script...');
      
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

      // Update project with generated script
      if (activeProject) {
        updateProject(activeProject.id, {
          name: data.title,
          script_content: scriptData.script,
          status: 'idle',
          include_narration: data.includeNarration,
          target_duration_minutes: data.targetDurationMinutes,
        });
      }

      // Save to database
      await saveProjectToDb(data, scriptData.script);

      toast.success(`Script generated! ${scriptData.wordCount} words, ~${scriptData.estimatedDuration} min`);
      navigate('/script');

    } catch (err) {
      console.error('Script generation error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate script');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveProjectToDb = async (data: StoryWizardData, script: string) => {
    try {
      const { data: project, error } = await supabase
        .from('movie_projects')
        .insert({
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
        })
        .select()
        .single();

      if (project && !error) {
        // Save characters
        for (const char of data.characters) {
          if (char.name) {
            const { data: charData } = await supabase
              .from('characters')
              .insert({
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
      }
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  };

  if (isGenerating) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Minimal loading card */}
          <div className="glass-card p-10 text-center">
            {/* Animated icon */}
            <div className="relative w-20 h-20 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full border border-border animate-spin-slow" />
              <div className="absolute inset-3 rounded-full bg-foreground flex items-center justify-center">
                <Wand2 className="w-6 h-6 text-background" />
              </div>
            </div>

            {/* Title & Quote */}
            <div className="mb-8">
              <h2 className="text-lg font-medium text-foreground mb-3">
                Creating Your Story
              </h2>
              <p className="text-sm text-muted-foreground animate-fade-in" key={quoteIndex}>
                {CREATIVE_QUOTES[quoteIndex]}
              </p>
            </div>

            {/* Progress bar */}
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

            {/* Story info chips */}
            {storyData && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6 pt-6 border-t border-border">
                <span className="px-2.5 py-1 rounded-md bg-secondary text-muted-foreground text-xs">
                  {storyData.title}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-secondary text-muted-foreground text-xs">
                  {storyData.targetDurationMinutes} min
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex flex-col">
      {/* Wizard Container - clean and minimal */}
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
