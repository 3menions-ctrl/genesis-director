import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { extractAllThumbnails } from '@/utils/extractVideoThumbnails';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

export default function ExtractThumbnails() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, videoId: '' });
  const [results, setResults] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    setIsRunning(true);
    setError(null);
    setResults({});
    
    try {
      const thumbnails = await extractAllThumbnails((current, total, videoId) => {
        setProgress({ current, total, videoId });
      });
      setResults(thumbnails);
    } catch (e) {
      console.error('[ExtractThumbnails] Error:', e);
      setError('Failed to extract thumbnails. Please try again.');
    } finally {
      setIsRunning(false);
    }
  };

  const successCount = Object.keys(results).length;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Extract Video Thumbnails</CardTitle>
            <CardDescription>
              Extract frames from videos and upload them to storage as preloaded thumbnails.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button 
              onClick={handleExtract} 
              disabled={isRunning}
              size="lg"
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Extracting {progress.current}/{progress.total}...
                </>
              ) : (
                'Extract All Thumbnails'
              )}
            </Button>

            {isRunning && progress.videoId && (
              <div className="text-sm text-muted-foreground">
                Processing: {progress.videoId}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {successCount > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="w-5 h-5" />
                  Successfully extracted {successCount} thumbnails!
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(results).map(([id, url]) => (
                    <div key={id} className="aspect-video rounded overflow-hidden bg-muted">
                      <img src={url} alt={id} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
