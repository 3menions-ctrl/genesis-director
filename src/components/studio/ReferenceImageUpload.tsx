import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Upload, Image, Check, Loader2, AlertCircle, 
  Camera, Sparkles, Eye, Palette, Sun, User, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ReferenceImageAnalysis } from '@/types/production-pipeline';

interface ReferenceImageUploadProps {
  onAnalysisComplete: (analysis: ReferenceImageAnalysis) => void;
  onClear?: () => void;
  existingAnalysis?: ReferenceImageAnalysis;
  className?: string;
}

export function ReferenceImageUpload({ 
  onAnalysisComplete, 
  onClear,
  existingAnalysis,
  className 
}: ReferenceImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingAnalysis?.imageUrl || null);
  const [analysis, setAnalysis] = useState<ReferenceImageAnalysis | null>(existingAnalysis || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with external state changes (e.g., when reset is called)
  useEffect(() => {
    if (!existingAnalysis) {
      setPreviewUrl(null);
      setAnalysis(null);
      setError(null);
    } else {
      setPreviewUrl(existingAnalysis.imageUrl || null);
      setAnalysis(existingAnalysis);
    }
  }, [existingAnalysis]);

  const handleClear = () => {
    setPreviewUrl(null);
    setAnalysis(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClear?.();
    toast.success('Reference image cleared');
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processImage = async (file: File) => {
    setError(null);
    setIsAnalyzing(true);

    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Image must be less than 10MB');
      }

      // Create preview
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setPreviewUrl(result);
          // Extract base64 data (remove data:image/xxx;base64, prefix)
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
      });
      reader.readAsDataURL(file);
      const imageBase64 = await base64Promise;

      toast.info('Analyzing reference image with AI vision...');

      // Call the analysis edge function
      const { data, error: fnError } = await supabase.functions.invoke('analyze-reference-image', {
        body: { imageBase64 },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      // Use the storage URL returned from the edge function (HTTP URL for Replicate)
      // Fall back to local preview for display purposes only
      const analysisResult: ReferenceImageAnalysis = {
        ...data.analysis,
        // CRITICAL: Use the URL from the edge function - it's an HTTP URL that Replicate can access
        imageUrl: data.analysis.imageUrl || previewUrl,
      };

      // Update preview to use the stored URL if available
      if (data.analysis.imageUrl && data.analysis.imageUrl.startsWith('http')) {
        setPreviewUrl(data.analysis.imageUrl);
      }

      setAnalysis(analysisResult);
      onAnalysisComplete(analysisResult);
      toast.success('Reference image analyzed! Visual anchors extracted.');

    } catch (err) {
      console.error('Image analysis error:', err);
      const message = err instanceof Error ? err.message : 'Failed to analyze image';
      setError(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processImage(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Render analysis results
  if (analysis?.analysisComplete) {
    return (
      <Card className={cn("p-4 border-primary/30 bg-primary/5", className)}>
        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0 relative">
            {previewUrl && (
              <img 
                src={previewUrl} 
                alt="Reference" 
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute top-1 right-1 flex gap-1">
              {analysis.imageOrientation && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                  {analysis.imageOrientation.veoAspectRatio}
                </Badge>
              )}
              <Badge variant="default" className="text-xs gap-1 px-1.5 py-0.5">
                <Check className="w-3 h-3" />
              </Badge>
            </div>
          </div>

          {/* Analysis Summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-foreground text-sm">Reference Image Locked</h4>
            </div>
            
            <ScrollArea className="h-28">
              <div className="space-y-2 text-xs text-muted-foreground pr-2">
                {analysis.characterIdentity?.description && (
                  <div className="flex items-start gap-2">
                    <User className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                    <span className="line-clamp-2">{analysis.characterIdentity.description}</span>
                  </div>
                )}
                {analysis.environment?.setting && (
                  <div className="flex items-start gap-2">
                    <Eye className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                    <span className="line-clamp-2">{analysis.environment.setting}</span>
                  </div>
                )}
                {analysis.lighting?.style && (
                  <div className="flex items-start gap-2">
                    <Sun className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                    <span>{analysis.lighting.style}</span>
                  </div>
                )}
                {analysis.colorPalette?.mood && (
                  <div className="flex items-start gap-2">
                    <Palette className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                    <span>{analysis.colorPalette.mood}</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClick}
            >
              <Camera className="w-4 h-4 mr-1" />
              Change
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </Card>
    );
  }

  // Upload state
  return (
    <Card 
      className={cn(
        "p-6 border-2 border-dashed transition-all cursor-pointer",
        isDragging && "border-primary bg-primary/5",
        error && "border-destructive/50",
        !isDragging && !error && "border-muted-foreground/30 hover:border-primary/50",
        className
      )}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center text-center">
        {isAnalyzing ? (
          <>
            <Loader2 className="w-10 h-10 text-primary mb-3 animate-spin" />
            <h4 className="font-semibold text-foreground mb-1">Analyzing Reference Image</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Extracting visual features for production consistency...
            </p>
            <Progress value={66} className="w-48" />
          </>
        ) : error ? (
          <>
            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
            <h4 className="font-semibold text-foreground mb-1">Analysis Failed</h4>
            <p className="text-sm text-destructive mb-3">{error}</p>
            <Button variant="outline" size="sm">Try Again</Button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h4 className="font-semibold text-foreground mb-1">Upload Reference Image</h4>
            <p className="text-sm text-muted-foreground mb-1">
              This image becomes the visual anchor for your entire production
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Character identity, lighting, and environment will be extracted and maintained across all clips
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs gap-1">
                <Image className="w-3 h-3" />
                JPG, PNG, WebP
              </Badge>
              <Badge variant="outline" className="text-xs">
                Max 10MB
              </Badge>
            </div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </Card>
  );
}
