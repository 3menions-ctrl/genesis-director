import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, RotateCcw, ArrowLeft, ArrowRight,
  Video, Mic, Zap, Check, X, AlertCircle, Clock,
  Film, Sparkles, Loader2, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProductionPipeline } from '@/contexts/ProductionPipelineContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ProductionStage() {
  const navigate = useNavigate();
  const {
    state,
    startProduction,
    cancelProduction,
    retryFailedShots,
    goToStage,
    isGenerating,
    productionProgress,
  } = useProductionPipeline();
  
  const { production, structuredShots, scriptApproved } = state;
  
  // Redirect if script not approved
  useEffect(() => {
    if (!scriptApproved || structuredShots.length === 0) {
      navigate('/pipeline/scripting');
    }
  }, [scriptApproved, structuredShots.length, navigate]);
  
  const handleStartProduction = async () => {
    await startProduction();
  };
  
  const handleContinueToReview = () => {
    goToStage('review');
    navigate('/pipeline/review');
  };
  
  const completedShots = production.shots.filter(s => s.status === 'completed').length;
  const failedShots = production.shots.filter(s => s.status === 'failed').length;
  const pendingShots = production.shots.filter(s => s.status === 'pending').length;
  const generatingShot = production.shots.find(s => s.status === 'generating');
  
  const canProceedToReview = completedShots > 0;
  
  return (
    <div className="min-h-[85vh] flex flex-col p-6">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-6 animate-fade-in">
          <div>
            <Badge variant="outline" className="mb-4 gap-2">
              <Zap className="w-3 h-3" />
              Step 2 of 3 — Production & Synchronization
            </Badge>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">
              {state.projectTitle}
            </h1>
            <p className="text-muted-foreground">
              Anchor-chain video generation with frame chaining & ElevenLabs voiceover
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/pipeline/scripting')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Script
            </Button>
            {!isGenerating && pendingShots === structuredShots.length ? (
              <Button
                onClick={handleStartProduction}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                Start Production
              </Button>
            ) : isGenerating ? (
              <Button
                variant="destructive"
                onClick={cancelProduction}
                className="gap-2"
              >
                <Pause className="w-4 h-4" />
                Cancel
              </Button>
            ) : canProceedToReview ? (
              <Button
                onClick={handleContinueToReview}
                className="gap-2"
              >
                Continue to Review
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : null}
          </div>
        </div>
        
        {/* Progress Overview */}
        <Card className="p-6 mb-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                isGenerating ? "bg-primary/10" : completedShots === structuredShots.length ? "bg-success/10" : "bg-muted"
              )}>
                {isGenerating ? (
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                ) : completedShots === structuredShots.length ? (
                  <Check className="w-6 h-6 text-success" />
                ) : (
                  <Film className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {isGenerating 
                    ? `Generating Shot ${production.currentShotIndex + 1} of ${structuredShots.length}`
                    : completedShots === structuredShots.length
                    ? 'All Shots Complete!'
                    : 'Ready to Generate'
                  }
                </h3>
                <p className="text-sm text-muted-foreground">
                  {completedShots} completed • {failedShots} failed • {pendingShots} pending
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <span className="text-3xl font-bold text-foreground">{productionProgress}%</span>
              <p className="text-xs text-muted-foreground">Progress</p>
            </div>
          </div>
          
          <Progress value={productionProgress} className="h-3" />
          
          {/* Pipeline Features */}
          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
            <PipelineFeature
              icon={<Sparkles className="w-4 h-4" />}
              label="Master Anchor"
              status={production.masterAnchor ? 'active' : 'pending'}
            />
            <PipelineFeature
              icon={<Film className="w-4 h-4" />}
              label="Frame Chaining"
              status={production.chainContext.previousFrameUrl ? 'active' : 'pending'}
            />
            <PipelineFeature
              icon={<Mic className="w-4 h-4" />}
              label="Voice Generation"
              status={production.voiceTracks.length > 0 ? 'active' : 'pending'}
            />
            <PipelineFeature
              icon={<Zap className="w-4 h-4" />}
              label="Seed Lock"
              status="active"
              detail={`Seed: ${production.globalSeed}`}
            />
          </div>
        </Card>
        
        {/* Shots Grid */}
        <div className="flex-1 grid lg:grid-cols-3 gap-6">
          {/* Shot List */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Shot Generation Queue</h3>
              {failedShots > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={retryFailedShots}
                  className="gap-2"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry Failed ({failedShots})
                </Button>
              )}
            </div>
            
            <ScrollArea className="h-[calc(100vh-450px)]">
              <div className="space-y-3 pr-4">
                {production.shots.map((shot, index) => (
                  <ProductionShotCard
                    key={shot.id}
                    shot={shot}
                    index={index}
                    isActive={generatingShot?.id === shot.id}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
          
          {/* Live Preview */}
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="aspect-video bg-muted relative">
                {generatingShot?.videoUrl ? (
                  <video
                    src={generatingShot.videoUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                  />
                ) : production.masterAnchor?.imageUrl ? (
                  <img
                    src={production.masterAnchor.imageUrl}
                    alt="Master Anchor"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Video className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {isGenerating ? 'Generating...' : 'Preview will appear here'}
                      </p>
                    </div>
                  </div>
                )}
                
                {isGenerating && (
                  <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      <span className="text-xs text-white">Live</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h4 className="font-medium text-foreground mb-1">
                  {generatingShot?.title || 'Current Shot'}
                </h4>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {generatingShot?.description || 'Start production to see live preview'}
                </p>
              </div>
            </Card>
            
            {/* Voice Track Status */}
            <Card className="p-4">
              <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Voice Tracks
              </h4>
              <div className="space-y-2">
                {production.voiceTracks.slice(0, 5).map((track, index) => (
                  <div key={track.shotId} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{track.shotId}</span>
                    <Badge
                      variant={track.status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {track.status === 'completed' ? (
                        <Check className="w-3 h-3 mr-1" />
                      ) : track.status === 'generating' ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : null}
                      {track.status}
                    </Badge>
                  </div>
                ))}
                {production.voiceTracks.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Voice tracks will be generated during production
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Pipeline Feature Indicator
function PipelineFeature({ 
  icon, 
  label, 
  status,
  detail,
}: { 
  icon: React.ReactNode; 
  label: string; 
  status: 'active' | 'pending' | 'error';
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center",
        status === 'active' ? "bg-primary/10 text-primary" :
        status === 'error' ? "bg-destructive/10 text-destructive" :
        "bg-muted text-muted-foreground"
      )}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {detail && <p className="text-xs text-muted-foreground font-mono">{detail}</p>}
      </div>
    </div>
  );
}

// Production Shot Card
function ProductionShotCard({ 
  shot, 
  index,
  isActive,
}: { 
  shot: any; 
  index: number;
  isActive: boolean;
}) {
  return (
    <Card className={cn(
      "p-4 transition-all duration-300",
      isActive && "ring-2 ring-primary bg-primary/5",
      shot.status === 'completed' && "bg-success/5 border-success/20",
      shot.status === 'failed' && "bg-destructive/5 border-destructive/20"
    )}>
      <div className="flex items-center gap-4">
        {/* Thumbnail / Status */}
        <div className={cn(
          "w-16 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
          shot.videoUrl ? "" : "bg-muted"
        )}>
          {shot.videoUrl ? (
            <video
              src={shot.videoUrl}
              className="w-full h-full object-cover"
              muted
            />
          ) : shot.status === 'generating' ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : shot.status === 'completed' ? (
            <Check className="w-5 h-5 text-success" />
          ) : shot.status === 'failed' ? (
            <X className="w-5 h-5 text-destructive" />
          ) : (
            <span className="text-lg font-bold text-muted-foreground">{index + 1}</span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="font-mono text-xs">
              {shot.id}
            </Badge>
            <h4 className="font-medium text-foreground truncate">{shot.title}</h4>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {shot.description?.slice(0, 60)}...
          </p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={
              shot.status === 'completed' ? 'default' :
              shot.status === 'generating' ? 'secondary' :
              shot.status === 'failed' ? 'destructive' :
              'outline'
            }
            className="capitalize"
          >
            {shot.status === 'generating' && (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            )}
            {shot.status}
          </Badge>
          <span className="text-xs text-muted-foreground">{shot.durationSeconds}s</span>
        </div>
      </div>
      
      {shot.error && (
        <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          {shot.error}
        </div>
      )}
    </Card>
  );
}
