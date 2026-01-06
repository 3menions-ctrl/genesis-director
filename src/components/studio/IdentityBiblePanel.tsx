import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  Loader2, 
  Check, 
  RefreshCw, 
  ImageIcon,
  Sparkles,
  X
} from 'lucide-react';
import { useProductionPipeline } from '@/contexts/ProductionPipelineContext';
import { cn } from '@/lib/utils';

/**
 * IdentityBiblePanel
 * 
 * Displays and manages the 3-point Identity Bible character reference system.
 * Shows front, side, and 3/4 views generated from the uploaded reference image.
 */
export function IdentityBiblePanel() {
  const { 
    state, 
    generateIdentityBible, 
    clearIdentityBible 
  } = useProductionPipeline();
  
  const { identityBible, identityBibleGenerating, referenceImage } = state;
  
  const hasReferenceImage = !!referenceImage?.imageUrl;
  const isComplete = identityBible?.isComplete;
  
  if (!hasReferenceImage && !isComplete) {
    return null; // Don't show panel if no reference image
  }
  
  return (
    <Card className="p-4 border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="font-medium text-foreground">Identity Bible</h4>
            <p className="text-xs text-muted-foreground">
              3-point character reference for consistency
            </p>
          </div>
        </div>
        
        {isComplete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearIdentityBible}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {identityBibleGenerating ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating character views with Vertex AI...
          </div>
          <Progress value={33} className="h-2" />
          <div className="grid grid-cols-3 gap-2">
            {['Front', 'Side', '3/4'].map((view) => (
              <div 
                key={view}
                className="aspect-square bg-muted rounded-lg animate-pulse flex items-center justify-center"
              >
                <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
              </div>
            ))}
          </div>
        </div>
      ) : isComplete ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="gap-1 bg-green-600">
              <Check className="w-3 h-3" />
              Complete
            </Badge>
            <span className="text-xs text-muted-foreground">
              {identityBible.consistencyAnchors.length} visual anchors extracted
            </span>
          </div>
          
          {/* 3-Point Character Views */}
          <div className="grid grid-cols-3 gap-2">
            <ViewThumbnail 
              label="Front" 
              imageUrl={identityBible.frontViewUrl} 
            />
            <ViewThumbnail 
              label="Side" 
              imageUrl={identityBible.sideViewUrl} 
            />
            <ViewThumbnail 
              label="3/4" 
              imageUrl={identityBible.threeQuarterViewUrl} 
            />
          </div>
          
          {/* Character Description Preview */}
          <div className="p-2 bg-background/50 rounded-lg border border-border/50">
            <p className="text-xs text-muted-foreground line-clamp-3">
              {identityBible.characterDescription.substring(0, 150)}...
            </p>
          </div>
          
          {/* Regenerate Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={generateIdentityBible}
            className="w-full gap-2"
          >
            <RefreshCw className="w-3 h-3" />
            Regenerate Views
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Generate a 3-point character bible for pixel-perfect identity consistency across all shots.
          </p>
          
          {/* Reference Image Preview */}
          {referenceImage?.imageUrl && (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <img 
                src={referenceImage.imageUrl} 
                alt="Reference" 
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <Button
            onClick={generateIdentityBible}
            className="w-full gap-2"
            disabled={!hasReferenceImage}
          >
            <Sparkles className="w-4 h-4" />
            Generate Identity Bible
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Uses Vertex AI Imagen to create front, side, and 3/4 character views
          </p>
        </div>
      )}
    </Card>
  );
}

function ViewThumbnail({ label, imageUrl }: { label: string; imageUrl: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  return (
    <div className="space-y-1">
      <div className={cn(
        "aspect-square rounded-lg overflow-hidden bg-muted relative",
        !loaded && !error && "animate-pulse"
      )}>
        {!error ? (
          <img 
            src={imageUrl} 
            alt={`${label} view`}
            className={cn(
              "w-full h-full object-cover transition-opacity",
              loaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <p className="text-xs text-center text-muted-foreground">{label}</p>
    </div>
  );
}
