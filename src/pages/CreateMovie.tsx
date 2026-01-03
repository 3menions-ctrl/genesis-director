import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudioLayout } from '@/components/layout/StudioLayout';
import { StoryWizard } from '@/components/studio/StoryWizard';
import { ScriptEditor } from '@/components/studio/ScriptEditor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Film, 
  Sparkles, 
  ArrowRight, 
  Play, 
  Pause, 
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  Users,
  FileText,
  Mic,
  Video,
  RotateCcw,
  Save,
  Library,
  Plus
} from 'lucide-react';
import { StoryWizardData, MovieProject, GENRE_OPTIONS } from '@/types/movie';

type CreationStep = 'wizard' | 'script' | 'generating' | 'editing' | 'voice' | 'video' | 'complete';

export default function CreateMovie() {
  const navigate = useNavigate();
  const [step, setStep] = useState<CreationStep>('wizard');
  const [storyData, setStoryData] = useState<StoryWizardData | null>(null);
  const [generatedScript, setGeneratedScript] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [savedProject, setSavedProject] = useState<MovieProject | null>(null);
  const [previousProjects, setPreviousProjects] = useState<MovieProject[]>([]);
  const [showProjectHistory, setShowProjectHistory] = useState(false);

  // Load previous projects
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
    setStep('generating');
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

      setGeneratedScript(scriptData.script);
      setProgress(100);
      setStep('editing');
      toast.success(`Script generated! ${scriptData.wordCount} words, ~${scriptData.estimatedDuration} min`);

      // Save project to database
      await saveProject(data, scriptData.script);

    } catch (err) {
      console.error('Script generation error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate script');
      setStep('wizard');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveProject = async (data: StoryWizardData, script: string) => {
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
        setSavedProject(project as unknown as MovieProject);
        
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

  const handleGenerateVoice = async () => {
    if (!generatedScript) return;
    
    setStep('voice');
    setProgress(0);

    try {
      toast.info('Generating voice narration...');
      setProgress(30);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-voice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: generatedScript }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate voice');
      }

      const audioBlob = await response.blob();
      const audioObjectUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(audioObjectUrl);
      setProgress(100);
      
      toast.success('Voice narration generated!');
      setStep('editing');
    } catch (err) {
      console.error('Voice generation error:', err);
      toast.error('Failed to generate voice');
      setStep('editing');
    }
  };

  const handleGenerateVideo = async () => {
    if (!generatedScript) return;

    setStep('video');
    setProgress(0);

    try {
      toast.info('Starting video generation...');
      setProgress(20);

      // Build a cinematic prompt from the script
      const videoPrompt = `Cinematic ${storyData?.genre || 'drama'} movie. ${storyData?.mood || 'Epic'} mood. 
        Setting: ${storyData?.setting || 'Modern world'}. 
        Visualize: ${generatedScript.slice(0, 600)}.
        High quality cinematography, professional lighting, smooth camera movements.`;

      const { data: videoData, error } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: videoPrompt,
          duration: Math.min(10, storyData?.targetDurationMinutes || 5),
        },
      });

      if (error || !videoData?.success) {
        throw new Error(videoData?.error || 'Failed to start video generation');
      }

      // Poll for completion
      const taskId = videoData.taskId;
      setProgress(40);
      
      const pollInterval = setInterval(async () => {
        const { data: statusData } = await supabase.functions.invoke('check-video-status', {
          body: { taskId },
        });

        if (statusData?.status === 'SUCCEEDED' && statusData?.videoUrl) {
          clearInterval(pollInterval);
          setVideoUrl(statusData.videoUrl);
          setProgress(100);
          setStep('complete');
          toast.success('Movie generation complete!');
          
          // Update project
          if (savedProject) {
            await supabase
              .from('movie_projects')
              .update({ 
                video_url: statusData.videoUrl,
                status: 'completed'
              })
              .eq('id', savedProject.id);
          }
        } else if (statusData?.status === 'FAILED') {
          clearInterval(pollInterval);
          throw new Error('Video generation failed');
        } else {
          setProgress(prev => Math.min(prev + 5, 90));
        }
      }, 5000);

    } catch (err) {
      console.error('Video generation error:', err);
      toast.error('Failed to generate video');
      setStep('editing');
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
    setShowProjectHistory(false);
    setStep('wizard');
  };

  const handleStartNew = () => {
    setStoryData(null);
    setGeneratedScript('');
    setAudioUrl(null);
    setVideoUrl(null);
    setSavedProject(null);
    setStep('wizard');
    setProgress(0);
  };

  return (
    <StudioLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Film className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Create Movie</h1>
                  <p className="text-sm text-muted-foreground">
                    {storyData?.title || 'Build your story step by step'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProjectHistory(!showProjectHistory)}
                >
                  <Library className="w-4 h-4 mr-2" />
                  History ({previousProjects.length})
                </Button>
                
                {step !== 'wizard' && (
                  <Button variant="outline" size="sm" onClick={handleStartNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Movie
                  </Button>
                )}
              </div>
            </div>

            {/* Progress for generation steps */}
            {['generating', 'voice', 'video'].includes(step) && (
              <div className="mt-4">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {step === 'generating' && 'Generating script...'}
                  {step === 'voice' && 'Creating voice narration...'}
                  {step === 'video' && 'Rendering video...'}
                  {' '}{progress}%
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Project History Sidebar */}
        {showProjectHistory && previousProjects.length > 0 && (
          <div className="fixed right-0 top-20 w-80 h-[calc(100vh-80px)] bg-background border-l border-border/50 p-4 overflow-y-auto z-20">
            <h3 className="font-semibold mb-4">Previous Projects</h3>
            <div className="space-y-3">
              {previousProjects.map((project) => (
                <div
                  key={project.id}
                  className="p-3 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium text-sm">{project.title}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                      {GENRE_OPTIONS.find(g => g.value === project.genre)?.emoji} {project.genre}
                    </Badge>
                    <span>{project.target_duration_minutes}m</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs flex-1"
                      onClick={() => handleContinueStory(project)}
                    >
                      Continue Story
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Wizard Step */}
          {step === 'wizard' && (
            <StoryWizard
              onComplete={handleWizardComplete}
              onCancel={() => navigate('/production')}
              initialData={storyData || undefined}
            />
          )}

          {/* Generating Step */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-primary animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Creating Your Movie Script
              </h2>
              <p className="text-muted-foreground mb-4">
                Crafting a {storyData?.targetDurationMinutes}-minute {storyData?.genre} story with {storyData?.characters.filter(c => c.name).length} characters...
              </p>
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">This may take a minute...</span>
              </div>
            </div>
          )}

          {/* Editing Step */}
          {step === 'editing' && (
            <div className="space-y-6">
              {/* Story Summary */}
              {storyData && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary">
                        {GENRE_OPTIONS.find(g => g.value === storyData.genre)?.emoji} {storyData.genre}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {storyData.targetDurationMinutes} min
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        {storyData.characters.filter(c => c.name).length} characters
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!audioUrl && (
                        <Button onClick={handleGenerateVoice} variant="outline" size="sm">
                          <Mic className="w-4 h-4 mr-2" />
                          Generate Voice
                        </Button>
                      )}
                      <Button onClick={handleGenerateVideo} size="sm">
                        <Video className="w-4 h-4 mr-2" />
                        Generate Video
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Script Editor */}
              <ScriptEditor
                script={generatedScript}
                onChange={setGeneratedScript}
                isGenerating={isGenerating}
              />

              {/* Audio Player */}
              {audioUrl && (
                <div className="p-4 rounded-xl border border-border/50 bg-muted/30">
                  <div className="flex items-center gap-4">
                    <Mic className="w-5 h-5 text-primary" />
                    <span className="font-medium">Voice Narration</span>
                    <audio src={audioUrl} controls className="flex-1" />
                    <Button size="sm" variant="ghost" asChild>
                      <a href={audioUrl} download="narration.mp3">
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Voice Generation Step */}
          {step === 'voice' && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Mic className="w-10 h-10 text-primary animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Generating Voice Narration
              </h2>
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {/* Video Generation Step */}
          {step === 'video' && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Video className="w-10 h-10 text-primary animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Rendering Your Movie
              </h2>
              <p className="text-muted-foreground mb-4">
                This may take a few minutes...
              </p>
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && videoUrl && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-foreground">
                  Your Movie is Ready!
                </h2>
                <p className="text-muted-foreground">
                  "{storyData?.title}" has been generated successfully
                </p>
              </div>

              <div className="rounded-2xl overflow-hidden border border-border/50">
                <video
                  src={videoUrl}
                  controls
                  className="w-full aspect-video bg-black"
                />
              </div>

              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" onClick={handleStartNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Another
                </Button>
                <Button asChild>
                  <a href={videoUrl} download={`${storyData?.title || 'movie'}.mp4`}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Movie
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </StudioLayout>
  );
}
