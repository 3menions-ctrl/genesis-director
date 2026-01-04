import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoryWizard } from '@/components/studio/StoryWizard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStudio } from '@/contexts/StudioContext';
import { 
  Loader2,
  Wand2,
  Film
} from 'lucide-react';
import { StoryWizardData, GENRE_OPTIONS } from '@/types/movie';
import { cn } from '@/lib/utils';

const CREATIVE_QUOTES = [
  { quote: "Every great film begins with a single idea...", author: "Your Story" },
  { quote: "Characters are the heart of every story...", author: "Building worlds" },
  { quote: "The best stories feel like magic...", author: "Creating wonder" },
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
      <div className="min-h-[85vh] flex items-center justify-center p-6 relative overflow-hidden">
        {/* Subtle background elements */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-foreground/[0.02] blur-3xl" />
          <div className="absolute inset-0 dot-pattern opacity-30" />
        </div>

        <div className="relative w-full max-w-lg">
          {/* Main card */}
          <div className="glass-card p-10 text-center">
            {/* Animated icon */}
            <div className="relative w-24 h-24 mx-auto mb-8">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-2 border-foreground/10 animate-spin-slow" />
              <div className="absolute inset-3 rounded-full border border-dashed border-foreground/15" style={{ animation: 'spin-slow 12s linear infinite reverse' }} />
              
              {/* Center icon */}
              <div className="absolute inset-5 rounded-full bg-foreground flex items-center justify-center shadow-xl">
                <Wand2 className="w-8 h-8 text-background" />
              </div>
            </div>

            {/* Title & Quote */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Creating Your Story
              </h2>
              <div className="h-10 flex items-center justify-center">
                <p className="text-muted-foreground text-sm animate-fade-in" key={quoteIndex}>
                  "{CREATIVE_QUOTES[quoteIndex].quote}"
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-4 mb-8">
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out bg-foreground"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-foreground" />
                  <span className="text-muted-foreground">{progressMessage}</span>
                </div>
                <span className="font-mono font-medium text-foreground">{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Story info */}
            {storyData && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">
                  {storyData.title}
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm">
                  {storyData.targetDurationMinutes} min
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm">
                  {storyData.characters.filter(c => c.name).length} characters
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
      {/* Header */}
      <div className="px-6 lg:px-8 py-6 border-b border-border/50">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
            <Film className="w-5 h-5 text-background" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              New Clip
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure your video settings and generate a script
            </p>
          </div>
        </div>
      </div>

      {/* Wizard Container */}
      <div className="flex-1 px-4 lg:px-8 py-6">
        <div className="max-w-5xl mx-auto">
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
