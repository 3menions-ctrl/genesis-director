import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Image, 
  Check, 
  X, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { SceneBreakdown, SceneImage } from '@/types/studio';
import { cn } from '@/lib/utils';

interface SceneImagePreviewProps {
  scenes: SceneBreakdown[];
  sceneImages: SceneImage[];
  isGenerating: boolean;
  generationProgress: number;
  onApprove: (sceneNumber: number) => void;
  onReject: (sceneNumber: number) => void;
  onRegenerate: (sceneNumber: number) => void;
  onApproveAll: () => void;
  onGenerateImages: () => void;
  onProceedToVideo: () => void;
}

export function SceneImagePreview({
  scenes,
  sceneImages,
  isGenerating,
  generationProgress,
  onApprove,
  onReject,
  onRegenerate,
  onApproveAll,
  onGenerateImages,
  onProceedToVideo,
}: SceneImagePreviewProps) {
  const [selectedScene, setSelectedScene] = useState<number>(0);
  const [showPrompt, setShowPrompt] = useState(false);

  const hasImages = sceneImages.length > 0;
  const allApproved = hasImages && sceneImages.every(img => img.approved);
  const approvedCount = sceneImages.filter(img => img.approved).length;
  const currentImage = sceneImages.find(img => img.sceneNumber === scenes[selectedScene]?.sceneNumber);

  const navigateScene = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && selectedScene > 0) {
      setSelectedScene(selectedScene - 1);
    } else if (direction === 'next' && selectedScene < scenes.length - 1) {
      setSelectedScene(selectedScene + 1);
    }
  };

  if (!hasImages && !isGenerating) {
    return (
      <Card className="p-6 bg-card/50 backdrop-blur border-border/50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Image className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Generate Reference Images</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create reference images for each scene to ensure visual consistency across your video.
            </p>
          </div>
          <Button onClick={onGenerateImages} className="gap-2">
            <Sparkles className="w-4 h-4" />
            Generate Scene Images
          </Button>
          <p className="text-xs text-muted-foreground">
            {scenes.length} scene{scenes.length !== 1 ? 's' : ''} will be generated
          </p>
        </div>
      </Card>
    );
  }

  if (isGenerating) {
    return (
      <Card className="p-6 bg-card/50 backdrop-blur border-border/50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Generating Reference Images</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Creating consistent visuals for your scenes...
            </p>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${generationProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {Math.round(generationProgress)}% complete
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden bg-card/50 backdrop-blur border-border/50">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">Scene Reference Images</h3>
            <p className="text-xs text-muted-foreground">
              {approvedCount}/{sceneImages.length} approved
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!allApproved && (
            <Button variant="outline" size="sm" onClick={onApproveAll}>
              <Check className="w-4 h-4 mr-1" />
              Approve All
            </Button>
          )}
          {allApproved && (
            <Button size="sm" onClick={onProceedToVideo} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Generate Video
            </Button>
          )}
        </div>
      </div>

      {/* Main Preview */}
      <div className="relative aspect-video bg-muted/50">
        {currentImage ? (
          <img 
            src={currentImage.imageUrl} 
            alt={`Scene ${currentImage.sceneNumber}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-muted-foreground">No image generated for this scene</p>
          </div>
        )}

        {/* Navigation Arrows */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
          onClick={() => navigateScene('prev')}
          disabled={selectedScene === 0}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
          onClick={() => navigateScene('next')}
          disabled={selectedScene === scenes.length - 1}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

        {/* Status Badge */}
        {currentImage && (
          <div className="absolute top-3 right-3">
            <Badge 
              variant={currentImage.approved ? "default" : "secondary"}
              className={cn(
                currentImage.approved && "bg-green-500/90 hover:bg-green-500"
              )}
            >
              {currentImage.approved ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Approved
                </>
              ) : (
                'Pending Review'
              )}
            </Badge>
          </div>
        )}

        {/* Scene Info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Scene {scenes[selectedScene]?.sceneNumber}: {scenes[selectedScene]?.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {scenes[selectedScene]?.durationSeconds}s • {scenes[selectedScene]?.mood}
              </p>
            </div>
            {currentImage && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPrompt(!showPrompt)}
                  title={showPrompt ? "Hide prompt" : "Show prompt"}
                >
                  {showPrompt ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRegenerate(currentImage.sceneNumber)}
                  disabled={currentImage.regenerating}
                >
                  <RefreshCw className={cn("w-4 h-4 mr-1", currentImage.regenerating && "animate-spin")} />
                  Regenerate
                </Button>
                {!currentImage.approved ? (
                  <Button
                    size="sm"
                    onClick={() => onApprove(currentImage.sceneNumber)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReject(currentImage.sceneNumber)}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Unapprove
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prompt Display */}
      {showPrompt && currentImage && (
        <div className="p-3 bg-muted/30 border-t border-border/50">
          <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
            {currentImage.prompt}
          </p>
        </div>
      )}

      {/* Thumbnail Strip */}
      <ScrollArea className="p-3 border-t border-border/50">
        <div className="flex gap-2">
          {scenes.map((scene, index) => {
            const image = sceneImages.find(img => img.sceneNumber === scene.sceneNumber);
            return (
              <button
                key={scene.sceneNumber}
                onClick={() => setSelectedScene(index)}
                className={cn(
                  "relative flex-shrink-0 w-24 h-14 rounded-md overflow-hidden border-2 transition-all",
                  selectedScene === index 
                    ? "border-primary ring-2 ring-primary/30" 
                    : "border-border/50 hover:border-border"
                )}
              >
                {image ? (
                  <img 
                    src={image.imageUrl} 
                    alt={`Scene ${scene.sceneNumber}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Image className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                {image?.approved && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-background/80 px-1 py-0.5">
                  <p className="text-[10px] text-center truncate">{scene.sceneNumber}</p>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}