import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoryWizard } from '@/components/studio/StoryWizard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStudio } from '@/contexts/StudioContext';
import { 
  Sparkles, 
  Loader2,
  Library,
  Film,
  Wand2,
  Zap,
  Clock,
  ChevronRight,
  X
} from 'lucide-react';
import { StoryWizardData, MovieProject, GENRE_OPTIONS } from '@/types/movie';
import { cn } from '@/lib/utils';

export default function Create() {
  const navigate = useNavigate();
  const { activeProject, updateProject } = useStudio();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Initializing...');
  const [storyData, setStoryData] = useState<StoryWizardData | null>(null);
  const [previousProjects, setPreviousProjects] = useState<MovieProject[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadPreviousProjects();
  }, []);

  // Simulate progress steps
  useEffect(() => {
    if (isGenerating) {
      const messages = [
        { at: 10, msg: 'Analyzing story elements...' },
        { at: 30, msg: 'Building character arcs...' },
        { at: 50, msg: 'Crafting dialogue...' },
        { at: 70, msg: 'Weaving plot threads...' },
        { at: 85, msg: 'Polishing the narrative...' },
        { at: 95, msg: 'Final touches...' },
      ];
      
      const interval = setInterval(() => {
        setProgress(p => {
          const next = Math.min(p + Math.random() * 8, 95);
          const currentMsg = messages.filter(m => m.at <= next).pop();
          if (currentMsg) setProgressMessage(currentMsg.msg);
          return next;
        });
      }, 800);
      
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

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
      includeNarration: true,
    });
    setShowHistory(false);
  };

  if (isGenerating) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-6">
        <div className="relative w-full max-w-lg">
          {/* Animated background */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-10 shadow-2xl shadow-violet-500/10">
            {/* Animated icon */}
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 animate-spin-slow opacity-20" />
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Wand2 className="w-10 h-10 text-white animate-pulse" />
              </div>
              {/* Orbiting sparkles */}
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
                <Sparkles className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 text-amber-400" />
              </div>
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>
                <Sparkles className="absolute top-1/2 -right-1 -translate-y-1/2 w-3 h-3 text-pink-400" />
              </div>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                Creating Your Story
              </h2>
              <p className="text-gray-500">
                {storyData?.genre && (
                  <span className="inline-flex items-center gap-1.5">
                    <span>{GENRE_OPTIONS.find(g => g.value === storyData.genre)?.emoji}</span>
                    <span>{storyData.title}</span>
                  </span>
                )}
              </p>
            </div>

            {/* Progress */}
            <div className="space-y-4">
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-full blur-sm transition-all duration-700 ease-out opacity-50"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                  <span>{progressMessage}</span>
                </div>
                <span className="font-mono font-semibold text-violet-600">{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Fun facts */}
            <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100">
              <p className="text-xs text-center text-violet-600">
                ✨ Our AI is crafting {storyData?.characters.filter(c => c.name).length || 0} unique character arc{(storyData?.characters.filter(c => c.name).length || 0) !== 1 ? 's' : ''} for your ~{storyData?.targetDurationMinutes}-minute film
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex">
      {/* Main Content */}
      <div className="flex-1 p-6 lg:p-10">
        <div className="max-w-4xl mx-auto">
          {/* Hero Header */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-100 to-purple-100 border border-violet-200/50 mb-6">
              <Zap className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-medium text-violet-700">AI-Powered Story Creation</span>
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              Craft Your <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">Cinematic Vision</span>
            </h1>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Define your story, build your characters, and let AI transform your imagination into a compelling script
            </p>
          </div>

          {/* Continue Previous Projects Banner */}
          {previousProjects.length > 0 && !showHistory && (
            <button
              onClick={() => setShowHistory(true)}
              className="w-full mb-8 p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/50 hover:border-amber-300 transition-all group flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100">
                  <Library className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Continue a Previous Story</p>
                  <p className="text-sm text-gray-500">{previousProjects.length} projects available</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>
          )}

          {/* History Panel */}
          {showHistory && previousProjects.length > 0 && (
            <div className="mb-8 p-6 rounded-2xl bg-white border border-gray-200 shadow-lg animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Continue a Story</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {previousProjects.slice(0, 6).map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleContinueStory(project)}
                    className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white hover:border-violet-200 hover:shadow-md transition-all text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{GENRE_OPTIONS.find(g => g.value === project.genre)?.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate group-hover:text-violet-700 transition-colors">
                          {project.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{project.target_duration_minutes}m</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Story Wizard */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xl shadow-gray-200/50 overflow-hidden">
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