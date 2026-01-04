import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoryWizard } from '@/components/studio/StoryWizard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStudio } from '@/contexts/StudioContext';
import { 
  Loader2,
  Wand2,
  Film,
  Zap
} from 'lucide-react';
import { StoryWizardData, MovieProject, GENRE_OPTIONS } from '@/types/movie';
import { cn } from '@/lib/utils';

export default function Create() {
  const navigate = useNavigate();
  const { activeProject, updateProject, deductCredits, canAffordDuration } = useStudio();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Initializing...');
  const [storyData, setStoryData] = useState<StoryWizardData | null>(null);

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
    if (!creditsDeducted) return;
    
    setStoryData(data);
    setIsGenerating(true);
    setProgress(10);

    try {
      toast.info('Generating script...');
      
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

      if (activeProject) {
        updateProject(activeProject.id, {
          name: data.title,
          script_content: scriptData.script,
          status: 'idle',
          include_narration: data.includeNarration,
          target_duration_minutes: data.targetDurationMinutes,
        });
      }

      await saveProjectToDb(data, scriptData.script);
      toast.success(`Script generated! ${scriptData.wordCount} words`);
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
      <div className="h-full flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-spin" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                <Wand2 className="w-6 h-6 text-primary animate-pulse" />
              </div>
            </div>

            <h2 className="text-lg font-semibold text-foreground mb-2">Generating Script</h2>
            <p className="text-sm text-muted-foreground mb-6">{progressMessage}</p>

            <div className="space-y-3">
              <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{storyData?.title}</span>
                <span className="font-mono font-medium text-primary">{Math.round(progress)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Film className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">New Clip</h1>
            <p className="text-xs text-muted-foreground">Configure and generate</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="w-3.5 h-3.5" />
          <span>AI-Powered</span>
        </div>
      </div>

      {/* Wizard */}
      <div className="flex-1 overflow-auto">
        <StoryWizard
          onComplete={handleWizardComplete}
          onCancel={() => navigate('/projects')}
          initialData={storyData || undefined}
        />
      </div>
    </div>
  );
}
