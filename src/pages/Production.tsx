import { useNavigate } from 'react-router-dom';
import { 
  Play, RotateCcw, ArrowLeft, Sparkles, 
  Download, Film, Clock, Wand2, ChevronRight,
  Video, CheckCircle2, Rocket, Zap,
  FileText, Share2, ExternalLink, Eye, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStudio } from '@/contexts/StudioContext';
import { VideoPlaylist } from '@/components/studio/VideoPlaylist';
import { GenerationProgressModal } from '@/components/studio/GenerationProgressModal';
import { cn } from '@/lib/utils';
import { useState, useRef } from 'react';
import { toast } from 'sonner';

export default function Production() {
  const navigate = useNavigate();
  const { 
    activeProject, 
    generatePreview, 
    cancelGeneration, 
    isGenerating, 
    generationProgress, 
    credits, 
    isLoading 
  } = useStudio();
  
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const status = activeProject?.status || 'idle';

  const handleGenerate = async () => {
    setGenerationError(null);
    setShowProgressModal(true);
    try {
      await generatePreview();
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Generation failed');
    }
  };

  const handleCancelGeneration = () => {
    cancelGeneration();
    setShowProgressModal(false);
  };

  const handleShare = () => {
    toast.success('Share link copied to clipboard!');
  };

  // Close modal when generation completes
  if (!isGenerating && showProgressModal && !generationError && status === 'completed') {
    setShowProgressModal(false);
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center space-y-6">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-accent opacity-20 animate-pulse" />
            <div className="absolute inset-3 rounded-xl bg-card flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground font-medium">Loading studio...</p>
        </div>
      </div>
    );
  }

  // No project selected
  if (!activeProject) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-br from-primary/5 to-accent/3 rounded-full blur-[150px]" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in max-w-xl">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto shadow-xl">
            <Film className="w-12 h-12 text-primary-foreground" />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl font-display font-bold text-foreground">
              Production Studio
            </h1>
            <p className="text-lg text-muted-foreground">
              Transform your scripts into stunning AI-generated videos
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/create')} className="gap-3">
              <Rocket className="w-5 h-5" />
              Create New Project
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/projects')} className="gap-2">
              Browse Projects
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No script
  if (!activeProject.script_content?.trim()) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/5 rounded-full blur-[120px]" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in max-w-lg">
          <div className="w-24 h-24 rounded-3xl bg-muted flex items-center justify-center mx-auto">
            <Wand2 className="w-12 h-12 text-primary" />
          </div>
          
          <div className="space-y-4">
            <h2 className="text-3xl font-display font-bold text-foreground">Script Required</h2>
            <p className="text-lg text-muted-foreground">
              Add a script to your project before generating video
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/script')} className="gap-3">
              <Sparkles className="w-5 h-5" />
              Write Script
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/create')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Story Wizard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const wordCount = activeProject.script_content?.split(/\s+/).filter(w => w.trim()).length || 0;
  const estimatedDuration = Math.ceil((wordCount / 150) * 60);
  const estimatedClips = Math.ceil(estimatedDuration / 8);

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 animate-fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-bold text-foreground">{activeProject.name}</h1>
              <Badge 
                variant="outline" 
                className={cn(
                  "capitalize",
                  status === 'completed' && "border-success text-success bg-success/10",
                  status === 'generating' && "border-primary text-primary bg-primary/10",
                  status === 'idle' && "border-muted-foreground/30"
                )}
              >
                {status === 'idle' ? 'Ready' : status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {wordCount} words • ~{estimatedDuration}s video • {estimatedClips} clips
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/script')} className="gap-2">
              <FileText className="w-4 h-4" />
              Edit Script
            </Button>
            
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-2 min-w-[140px]"
            >
              {status === 'completed' ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Regenerate
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </header>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Video Preview - Large Card */}
          <div className="lg:col-span-2 space-y-6">
            <div 
              ref={videoContainerRef}
              className="glass-card overflow-hidden animate-fade-in"
              style={{ animationDelay: '50ms' }}
            >
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <div className="absolute inset-0">
                  {/* Completed State */}
                  {status === 'completed' && (
                    <div className="absolute inset-0">
                      {activeProject.video_clips && activeProject.video_clips.length > 0 ? (
                        <VideoPlaylist 
                          clips={activeProject.video_clips} 
                          showControls={true}
                        />
                      ) : activeProject.video_url ? (
                        <VideoPlaylist 
                          clips={[activeProject.video_url]} 
                          showControls={true}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-success/10 flex items-center justify-center">
                          <div className="text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-success flex items-center justify-center mx-auto">
                              <CheckCircle2 className="w-8 h-8 text-white" />
                            </div>
                            <p className="text-lg font-medium text-foreground">Video Ready</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Idle State */}
                  {status !== 'completed' && (
                    <div className="absolute inset-0 bg-muted flex items-center justify-center">
                      <div className="text-center space-y-6 p-8">
                        <div 
                          className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto cursor-pointer hover:bg-primary/20 transition-colors group"
                          onClick={handleGenerate}
                        >
                          <Play className="w-10 h-10 text-primary ml-1 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-semibold text-foreground">Ready to Create</h3>
                          <p className="text-muted-foreground max-w-sm">
                            Click generate to transform your script into a cinematic video
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>~{Math.ceil(estimatedClips * 2)} min</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Film className="w-4 h-4" />
                            <span>{estimatedClips} clips</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Video Clips Grid */}
            {status === 'completed' && activeProject.video_clips && activeProject.video_clips.length > 0 && (
              <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Film className="w-4 h-4 text-primary" />
                    Video Clips ({activeProject.video_clips.length})
                  </h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      toast.info('Downloading all clips...');
                      for (let i = 0; i < activeProject.video_clips!.length; i++) {
                        try {
                          const response = await fetch(activeProject.video_clips![i]);
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${activeProject.name}-clip-${i + 1}.mp4`;
                          document.body.appendChild(a);
                          a.click();
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                          await new Promise(r => setTimeout(r, 500));
                        } catch {
                          window.open(activeProject.video_clips![i], '_blank');
                        }
                      }
                      toast.success('Downloads complete!');
                    }}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download All
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {activeProject.video_clips.map((clipUrl, index) => (
                    <div key={index} className="group relative rounded-xl overflow-hidden bg-muted aspect-video">
                      <video 
                        src={clipUrl} 
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-white hover:bg-white/20"
                          onClick={() => window.open(clipUrl, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-white hover:bg-white/20"
                          onClick={async () => {
                            try {
                              const response = await fetch(clipUrl);
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${activeProject.name}-clip-${index + 1}.mp4`;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                              toast.success(`Clip ${index + 1} downloading!`);
                            } catch {
                              window.open(clipUrl, '_blank');
                            }
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="absolute bottom-1 left-1 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-medium">
                        Clip {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Cards */}
          <div className="space-y-6">
            
            {/* Project Info Card */}
            <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: '75ms' }}>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Project Overview
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "capitalize",
                      status === 'completed' && "border-success text-success bg-success/10",
                      status === 'generating' && "border-primary text-primary bg-primary/10",
                      status === 'idle' && "border-muted-foreground/30"
                    )}
                  >
                    {status === 'idle' ? 'Ready' : status}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Word Count</span>
                  <span className="text-sm font-medium text-foreground">{wordCount}</span>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Est. Duration</span>
                  <span className="text-sm font-medium text-foreground">{estimatedDuration}s</span>
                </div>
                
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">Clips</span>
                  <span className="text-sm font-medium text-foreground">{estimatedClips}</span>
                </div>
              </div>
            </div>

            {/* Script Preview Card */}
            <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Script Preview
                </h3>
                <Button variant="ghost" size="sm" onClick={() => navigate('/script')} className="gap-1 text-xs h-7 px-2">
                  Edit
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
              
              <div className="bg-muted/50 rounded-xl p-4 max-h-[200px] overflow-y-auto">
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {activeProject.script_content?.slice(0, 400)}
                  {(activeProject.script_content?.length || 0) > 400 && '...'}
                </p>
              </div>
            </div>

            {/* Credits Card */}
            <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: '125ms' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Credits
                </h3>
                <span className="text-lg font-bold text-primary">{credits.remaining.toLocaleString()}</span>
              </div>
              
              <div className="space-y-3">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(credits.remaining / credits.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {credits.remaining.toLocaleString()} of {credits.total.toLocaleString()} credits remaining
                </p>
              </div>
              
              <Button variant="outline" size="sm" className="w-full mt-4 gap-2">
                <Sparkles className="w-4 h-4" />
                Get More Credits
              </Button>
            </div>

            {/* Quick Actions Card */}
            {status === 'completed' && (
              <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: '150ms' }}>
                <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={() => navigate('/export')}
                  >
                    <Download className="w-4 h-4" />
                    Export Video
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={handleShare}
                  >
                    <Share2 className="w-4 h-4" />
                    Share Project
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start gap-3"
                    onClick={handleGenerate}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Regenerate
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generation Progress Modal */}
      <GenerationProgressModal
        open={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        step={generationProgress.step}
        percent={generationProgress.percent}
        estimatedSecondsRemaining={generationProgress.estimatedSecondsRemaining}
        currentClip={generationProgress.currentClip}
        totalClips={generationProgress.totalClips}
        onCancel={handleCancelGeneration}
        error={generationError}
      />
    </div>
  );
}
