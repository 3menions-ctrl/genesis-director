import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoryWizard } from '@/components/studio/StoryWizard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStudio } from '@/contexts/StudioContext';
import { 
  Sparkles, 
  Loader2,
  Wand2,
  Star,
  Clapperboard,
  Rocket
} from 'lucide-react';
import { StoryWizardData, MovieProject, GENRE_OPTIONS } from '@/types/movie';
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
          target_duration_minutes: Math.round(data.targetDurationMinutes * 60), // Store as seconds (integer)
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
        {/* Animated background elements */}
        <div className="absolute inset-0 -z-10">
          {/* Main glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-primary/20 via-accent/15 to-primary/20 blur-3xl animate-pulse" />
          
          {/* Floating orbs */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-4 h-4 rounded-full bg-primary/30 animate-float"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${3 + i * 0.5}s`,
              }}
            />
          ))}
          
          {/* Star particles */}
          {[...Array(8)].map((_, i) => (
            <Star
              key={`star-${i}`}
              className="absolute w-3 h-3 text-warning/40 animate-pulse"
              style={{
                left: `${10 + i * 12}%`,
                top: `${15 + (i % 4) * 20}%`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>

        <div className="relative w-full max-w-xl">
          {/* Main card */}
          <div className="card-clean p-10 text-center">
            {/* Animated icon stack */}
            <div className="relative w-28 h-28 mx-auto mb-8">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-spin-slow" />
              <div className="absolute inset-2 rounded-full border-2 border-dashed border-primary/30 animate-spin" style={{ animationDuration: '8s', animationDirection: 'reverse' }} />
              
              {/* Center icon */}
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
                <Wand2 className="w-10 h-10 text-primary-foreground animate-pulse" />
              </div>
              
              {/* Orbiting icons */}
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '6s' }}>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 p-1.5 rounded-full bg-card shadow-lg border border-border">
                  <Sparkles className="w-4 h-4 text-warning" />
                </div>
              </div>
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '8s', animationDirection: 'reverse' }}>
                <div className="absolute top-1/2 -right-2 -translate-y-1/2 p-1.5 rounded-full bg-card shadow-lg border border-border">
                  <Clapperboard className="w-4 h-4 text-primary" />
                </div>
              </div>
            </div>

            {/* Title & Quote */}
            <div className="mb-8 min-h-[80px]">
              <h2 className="text-2xl font-bold font-display text-foreground mb-3">
                Creating Your Story
              </h2>
              <div className="h-12 flex items-center justify-center">
                <p className="text-muted-foreground text-sm italic animate-fade-in" key={quoteIndex}>
                  "{CREATIVE_QUOTES[quoteIndex].quote}"
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-4 mb-8">
              <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
                  }}
                />
                {/* Shimmer effect */}
                <div 
                  className="absolute inset-y-0 left-0 rounded-full animate-shimmer"
                  style={{ 
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                    backgroundSize: '200% 100%',
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-muted-foreground">{progressMessage}</span>
                </div>
                <span className="font-mono font-bold text-primary">{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Story info pills */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {storyData && (
                <>
                  <div className="px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                    {GENRE_OPTIONS.find(g => g.value === storyData.genre)?.emoji} {storyData.title}
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {storyData.targetDurationMinutes} min
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium">
                    {storyData.characters.filter(c => c.name).length} characters
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex flex-col relative">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
      </div>

      {/* Hero Header */}
      <div className="text-center pt-8 pb-6 px-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 mb-6 animate-fade-in">
          <Rocket className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">Create Something Amazing</span>
        </div>
        
        <h1 className="text-4xl lg:text-5xl font-bold font-display text-foreground mb-4 animate-fade-in delay-1">
          Your Story <span className="text-gradient">Starts Here</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto animate-fade-in delay-2">
          Define your vision, build unforgettable characters, and let AI craft your cinematic masterpiece
        </p>
      </div>

      {/* Wizard Container */}
      <div className="flex-1 px-4 pb-10">
        <div className="max-w-5xl mx-auto">
          <div className="card-clean overflow-hidden animate-fade-in-up delay-3">
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