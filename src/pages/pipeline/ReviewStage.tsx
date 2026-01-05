import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Download, Share2, ArrowLeft, Check, Play, Pause,
  Volume2, VolumeX, Film, Music, Mic, Eye,
  FileVideo, RotateCcw, ExternalLink, Sparkles, Loader2,
  Maximize2, Minimize2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProductionPipeline } from '@/contexts/ProductionPipelineContext';
import { AudioMixMode, Shot } from '@/types/production-pipeline';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const AUDIO_MIX_OPTIONS: { id: AudioMixMode; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'full', label: 'Full Mix', icon: <Volume2 className="w-4 h-4" />, description: 'Dialogue, music, and SFX' },
  { id: 'dialogue-only', label: 'Dialogue Only', icon: <Mic className="w-4 h-4" />, description: 'Voice narration only' },
  { id: 'music-only', label: 'Music Only', icon: <Music className="w-4 h-4" />, description: 'Background music only' },
  { id: 'mute', label: 'Visual Only', icon: <VolumeX className="w-4 h-4" />, description: 'No audio - muted' },
];

// Clip type for both in-memory and database-loaded clips
interface ReviewClip {
  id: string;
  index: number;
  title: string;
  videoUrl: string;
  durationSeconds: number;
  mood?: string;
  status: 'completed';
}

export default function ReviewStage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  const {
    state,
    setAudioMixMode,
    exportFinalVideo,
    goToStage,
  } = useProductionPipeline();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState([1]);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [databaseClips, setDatabaseClips] = useState<ReviewClip[]>([]);
  const [projectTitle, setProjectTitle] = useState(state.projectTitle || 'Your Production');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const videoContainerRef = useRef<HTMLDivElement>(null);
  
  const { production, audioMixMode, structuredShots } = state;
  
  // Load completed clips from database as fallback
  useEffect(() => {
    const loadDatabaseClips = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        // Fetch projects with video_clips from database
        const { data: projects, error } = await supabase
          .from('movie_projects')
          .select('id, title, video_clips, video_url, status')
          .eq('user_id', user.id)
          .not('video_clips', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('[ReviewStage] Database fetch error:', error);
          setIsLoading(false);
          return;
        }
        
        console.log('[ReviewStage] Query result:', projects);
        
        if (projects && projects.length > 0) {
          const project = projects[0];
          const videoClips = project.video_clips as string[] | null;
          
          if (videoClips && Array.isArray(videoClips) && videoClips.length > 0) {
            const clips: ReviewClip[] = videoClips.map((url, index) => ({
              id: `db_clip_${index}`,
              index,
              title: `Clip ${index + 1}`,
              videoUrl: url,
              durationSeconds: 5, // Default duration
              mood: 'cinematic',
              status: 'completed' as const,
            }));
            
            setDatabaseClips(clips);
            setProjectTitle(project.title || 'Your Production');
            console.log('[ReviewStage] Loaded', clips.length, 'clips from database:', clips.map(c => c.videoUrl));
          } else {
            console.log('[ReviewStage] Project found but no video_clips:', project);
          }
        } else {
          console.log('[ReviewStage] No projects with video_clips found for user');
        }
      } catch (err) {
        console.error('[ReviewStage] Failed to load clips:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDatabaseClips();
  }, [user]);
  
  // Get completed clips - prefer in-memory state, fallback to database
  const inMemoryClips: ReviewClip[] = production.shots
    .filter(s => s.status === 'completed' && s.videoUrl)
    .map(s => ({
      id: s.id,
      index: s.index,
      title: s.title,
      videoUrl: s.videoUrl!,
      durationSeconds: s.durationSeconds,
      mood: s.mood,
      status: 'completed' as const,
    }))
    .sort((a, b) => a.index - b.index);
  
  // Use in-memory clips if available, otherwise use database clips
  const completedClips = inMemoryClips.length > 0 ? inMemoryClips : databaseClips;
  
  console.log('[ReviewStage] In-memory clips:', inMemoryClips.length, 'Database clips:', databaseClips.length, 'Using:', completedClips.length);
  
  const currentClip = completedClips[currentClipIndex];
  
  // Simple clip navigation - no complex crossfade that causes issues
  const transitionToClip = useCallback((newIndex: number) => {
    if (newIndex === currentClipIndex) return;
    if (newIndex < 0 || newIndex >= completedClips.length) return;
    
    const nextClip = completedClips[newIndex];
    if (!nextClip?.videoUrl) return;
    
    // Simple immediate switch
    setCurrentClipIndex(newIndex);
    setCurrentTime(0);
    
    // Update video source and play if was playing
    if (videoRef.current) {
      videoRef.current.src = nextClip.videoUrl;
      videoRef.current.load();
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [currentClipIndex, completedClips, isPlaying]);
  
  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleEnded = () => {
      // Auto-advance to next clip with smooth transition
      if (currentClipIndex < completedClips.length - 1) {
        transitionToClip(currentClipIndex + 1);
      } else {
        setIsPlaying(false);
      }
    };
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('ended', handleEnded);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('ended', handleEnded);
    };
  }, [currentClipIndex, completedClips.length, transitionToClip]);
  
  // Apply volume changes
  useEffect(() => {
    const vol = audioMixMode === 'mute' ? 0 : volume[0];
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
  }, [volume, audioMixMode]);
  
  // Fullscreen handlers
  const toggleFullscreen = useCallback(() => {
    if (!videoContainerRef.current) return;
    
    if (!isFullscreen) {
      if (videoContainerRef.current.requestFullscreen) {
        videoContainerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [isFullscreen]);
  
  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  // Play/pause toggle
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);
  
  // Keyboard shortcuts for fullscreen and playback
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        document.exitFullscreen();
      }
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
      if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      }
      // Arrow keys for clip navigation
      if (e.key === 'ArrowRight' && currentClipIndex < completedClips.length - 1) {
        transitionToClip(currentClipIndex + 1);
      }
      if (e.key === 'ArrowLeft' && currentClipIndex > 0) {
        transitionToClip(currentClipIndex - 1);
      }
    };
    
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isFullscreen, toggleFullscreen, togglePlayPause, currentClipIndex, completedClips.length, transitionToClip]);
  
  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };
  
  const handleAudioModeChange = (mode: AudioMixMode) => {
    setAudioMixMode(mode);
    toast.info(`Audio mode: ${AUDIO_MIX_OPTIONS.find(o => o.id === mode)?.label}`);
  };
  
  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Try the in-memory export first
      let url = await exportFinalVideo();
      
      // If no in-memory result, use the first database clip
      if (!url && completedClips.length > 0) {
        url = completedClips[0].videoUrl;
      }
      
      if (url) {
        toast.success('Export ready!');
        // Download the file
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectTitle || 'video'}.mp4`;
        a.click();
      } else {
        toast.error('No video available to export');
      }
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleShare = () => {
    navigator.clipboard.writeText(`https://studio.apex.ai/view/${state.projectId}`);
    toast.success('Share link copied!');
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const totalDuration = completedClips.reduce((sum, clip) => sum + clip.durationSeconds, 0);
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Loading Clips...</h2>
          <p className="text-muted-foreground">
            Fetching your completed productions
          </p>
        </Card>
      </div>
    );
  }
  
  if (completedClips.length === 0) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">No Completed Clips</h2>
          <p className="text-muted-foreground mb-4">
            Complete the production stage to review your video
          </p>
          <Button onClick={() => navigate('/pipeline/production')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Production
          </Button>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-[85vh] flex flex-col p-6">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-6 animate-fade-in">
          <div>
            <Badge variant="outline" className="mb-4 gap-2">
              <Eye className="w-3 h-3" />
              Step 3 of 3 — Final Review & Deployment
            </Badge>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">
              {projectTitle}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{completedClips.length} clips</span>
              <span>~{Math.round(totalDuration)}s total</span>
              <Badge variant="success" className="gap-1">
                <Check className="w-3 h-3" />
                Ready for Export
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/pipeline/production')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              variant="outline"
              onClick={handleShare}
              className="gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="gap-2"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export MP4
                </>
              )}
            </Button>
          </div>
        </div>
        
        <div className="flex-1 grid lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            {/* Main Video */}
            <Card className="overflow-hidden animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div 
                ref={videoContainerRef}
                className={cn(
                  "aspect-video bg-black relative group",
                  isFullscreen && "!aspect-auto w-full h-full"
                )}
              >
                {/* Video Player */}
                {currentClip?.videoUrl ? (
                  <video
                    ref={videoRef}
                    src={currentClip.videoUrl}
                    className="absolute inset-0 w-full h-full object-contain"
                    muted={audioMixMode === 'mute'}
                    onClick={togglePlayPause}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-white/60">No video available</p>
                  </div>
                )}
                
                {/* Fullscreen toggle button (visible on hover) */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="absolute top-4 right-4 z-10 text-white bg-black/40 hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-5 h-5" />
                  ) : (
                    <Maximize2 className="w-5 h-5" />
                  )}
                </Button>
                
                {/* Large play button overlay when paused */}
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-10 h-10 text-white ml-1" />
                    </div>
                  </div>
                )}
                
                {/* Overlay Controls */}
                <div className={cn(
                  "absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-10",
                  "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                  isFullscreen && "p-6"
                )}>
                  {/* Progress Bar */}
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleSeek}
                    className="mb-3"
                  />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={togglePlayPause}
                        className="text-white hover:bg-white/20"
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </Button>
                      <span className="text-white text-sm font-mono">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-24">
                        {audioMixMode === 'mute' ? (
                          <VolumeX className="w-4 h-4 text-white/60" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-white" />
                        )}
                        <Slider
                          value={volume}
                          max={1}
                          step={0.1}
                          onValueChange={setVolume}
                          disabled={audioMixMode === 'mute'}
                          className="flex-1"
                        />
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs">
                        Clip {currentClipIndex + 1}/{completedClips.length}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleFullscreen}
                        className="text-white hover:bg-white/20"
                      >
                        {isFullscreen ? (
                          <Minimize2 className="w-4 h-4" />
                        ) : (
                          <Maximize2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            
            {/* Clip Timeline */}
            <Card className="p-4 animate-fade-in" style={{ animationDelay: '150ms' }}>
              <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <Film className="w-4 h-4" />
                Clip Timeline
              </h4>
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {completedClips.map((clip, index) => (
                    <button
                      key={clip.id}
                      onClick={() => transitionToClip(index)}
                      className={cn(
                        "shrink-0 w-24 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer",
                        currentClipIndex === index 
                          ? "ring-2 ring-primary scale-105" 
                          : "opacity-70 hover:opacity-100 hover:scale-102"
                      )}
                    >
                      <div className="aspect-video bg-muted relative">
                        {clip.videoUrl && (
                          <video
                            src={clip.videoUrl}
                            className="w-full h-full object-cover"
                            muted
                          />
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                          <span className="text-xs text-white font-mono">
                            {clip.durationSeconds}s
                          </span>
                        </div>
                        {/* Clip number indicator */}
                        <div className="absolute top-1 left-1 bg-black/60 rounded px-1">
                          <span className="text-xs text-white font-mono">{index + 1}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </div>
          
          {/* Sidebar Controls */}
          <div className="space-y-4">
            {/* Audio Toggle */}
            <Card className="p-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
              <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                Audio Mix Mode
              </h4>
              <div className="space-y-2">
                {AUDIO_MIX_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleAudioModeChange(option.id)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-all flex items-center gap-3",
                      audioMixMode === option.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {option.icon}
                    <div>
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className={cn(
                        "text-xs",
                        audioMixMode === option.id ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {option.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
            
            {/* Current Shot Info */}
            {currentClip && (
              <Card className="p-4 animate-fade-in" style={{ animationDelay: '250ms' }}>
                <h4 className="font-medium text-foreground mb-3">Current Shot</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <Badge variant="secondary" className="font-mono">{currentClip.id}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Title</span>
                    <span className="text-foreground truncate max-w-[150px]">{currentClip.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="text-foreground">{currentClip.durationSeconds}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mood</span>
                    <span className="text-foreground capitalize">{currentClip.mood}</span>
                  </div>
                </div>
              </Card>
            )}
            
            {/* Export Options */}
            <Card className="p-4 bg-primary/5 border-primary/20 animate-fade-in" style={{ animationDelay: '300ms' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Ready to Deploy</h4>
                  <p className="text-xs text-muted-foreground">
                    All {completedClips.length} clips generated
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Button 
                  onClick={handleExport} 
                  disabled={isExporting}
                  className="w-full gap-2"
                >
                  <FileVideo className="w-4 h-4" />
                  Export Full Video
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleShare}
                  className="w-full gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Get Share Link
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
