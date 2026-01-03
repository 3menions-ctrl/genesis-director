import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoryWizard } from '@/components/studio/StoryWizard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStudio } from '@/contexts/StudioContext';
import { 
  Sparkles, 
  Loader2,
  Clock,
  Users,
  Library,
  ArrowLeft
} from 'lucide-react';
import { StoryWizardData, MovieProject, GENRE_OPTIONS } from '@/types/movie';

export default function Create() {
  const navigate = useNavigate();
  const { activeProject, updateProject } = useStudio();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [storyData, setStoryData] = useState<StoryWizardData | null>(null);
  const [previousProjects, setPreviousProjects] = useState<MovieProject[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadPreviousProjects();
  }, []);

  const loadPreviousProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('movie_projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data && !error) {
        setPreviousProjects(data as unknown as MovieProject[]);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const handleWizardComplete = async (data: StoryWizardData) => {
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
          target_duration_minutes: data.targetDurationMinutes,
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

  const handleContinueStory = (project: MovieProject) => {
    setStoryData({
      title: `${project.title} - Part 2`,
      genre: project.genre,
      storyStructure: project.story_structure,
      targetDurationMinutes: project.target_duration_minutes,
      setting: project.setting || '',
      timePeriod: project.time_period || 'Present Day',
      mood: project.mood || 'Epic & Grand',
      movieIntroStyle: (project.movie_intro_style as any) || 'cinematic',
      characters: [],
      synopsis: `Continuation of "${project.title}"`,
      parentProjectId: project.id,
    });
    setShowHistory(false);
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Sparkles className="w-10 h-10 text-primary animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Creating Your Movie Script
        </h2>
        <p className="text-muted-foreground mb-4">
          Crafting a {storyData?.targetDurationMinutes}-minute {storyData?.genre} story with {storyData?.characters.filter(c => c.name).length} characters...
        </p>
        <div className="w-64">
          <Progress value={progress} className="h-2 mb-2" />
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>This may take a minute...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Create New Movie</h1>
              <p className="text-sm text-muted-foreground">Define your story, characters, and style</p>
            </div>
          </div>

          {previousProjects.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              <Library className="w-4 h-4 mr-2" />
              Continue Previous ({previousProjects.length})
            </Button>
          )}
        </div>
      </div>

      {/* History Sidebar */}
      {showHistory && previousProjects.length > 0 && (
        <div className="mb-8 p-4 rounded-xl border border-border/50 bg-muted/30">
          <h3 className="font-semibold mb-4">Continue a Story</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {previousProjects.slice(0, 6).map((project) => (
              <button
                key={project.id}
                onClick={() => handleContinueStory(project)}
                className="p-3 rounded-xl border border-border/50 bg-background hover:bg-muted/50 transition-colors text-left"
              >
                <div className="font-medium text-sm truncate">{project.title}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">
                    {GENRE_OPTIONS.find(g => g.value === project.genre)?.emoji} {project.genre}
                  </Badge>
                  <span>{project.target_duration_minutes}m</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Story Wizard */}
      <StoryWizard
        onComplete={handleWizardComplete}
        onCancel={() => navigate('/projects')}
        initialData={storyData || undefined}
      />
    </div>
  );
}
