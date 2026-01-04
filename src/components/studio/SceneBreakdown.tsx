import { Film, Clock, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Scene {
  id: number;
  title: string;
  description: string;
  clipCount: number;
  durationSeconds: number;
}

interface SceneBreakdownProps {
  script: string;
  clipDuration?: number;
}

// Parse script to extract scenes
function parseScenes(script: string, clipDuration: number): Scene[] {
  if (!script?.trim()) return [];
  
  const scenes: Scene[] = [];
  
  // Split by common scene markers
  const scenePatterns = [
    /\[SCENE[:\s]+([^\]]+)\]/gi,
    /(?:^|\n)((?:INT\.|EXT\.|INT\/EXT\.?)[^\n]+)/gi,
    /(?:^|\n)(?:SCENE\s*\d*[:\s]*([^\n]+))/gi,
  ];
  
  let sceneMatches: { index: number; title: string }[] = [];
  
  // Try to find scene markers
  for (const pattern of scenePatterns) {
    let match;
    while ((match = pattern.exec(script)) !== null) {
      sceneMatches.push({
        index: match.index,
        title: match[1]?.trim() || match[0]?.trim() || 'Scene'
      });
    }
  }
  
  // Sort by index and remove duplicates that are too close
  sceneMatches = sceneMatches
    .sort((a, b) => a.index - b.index)
    .filter((scene, i, arr) => {
      if (i === 0) return true;
      return scene.index - arr[i - 1].index > 50;
    });
  
  // If no scenes found, create scenes based on paragraphs
  if (sceneMatches.length === 0) {
    const paragraphs = script.split(/\n\s*\n/).filter(p => p.trim());
    const wordsPerClip = 18;
    
    // Group paragraphs into scenes (roughly 3-4 clips per scene)
    let currentWords = 0;
    let currentParagraphs: string[] = [];
    let sceneNum = 1;
    
    for (const para of paragraphs) {
      const words = para.split(/\s+/).filter(w => w.trim()).length;
      currentWords += words;
      currentParagraphs.push(para);
      
      // Create a scene when we have enough content for 3+ clips
      if (currentWords >= wordsPerClip * 3 || para === paragraphs[paragraphs.length - 1]) {
        const clipCount = Math.max(1, Math.ceil(currentWords / wordsPerClip));
        scenes.push({
          id: sceneNum,
          title: `Scene ${sceneNum}`,
          description: currentParagraphs[0]?.slice(0, 80).trim() + (currentParagraphs[0]?.length > 80 ? '...' : ''),
          clipCount,
          durationSeconds: clipCount * clipDuration
        });
        sceneNum++;
        currentWords = 0;
        currentParagraphs = [];
      }
    }
  } else {
    // Use found scene markers
    const wordsPerClip = 18;
    
    for (let i = 0; i < sceneMatches.length; i++) {
      const start = sceneMatches[i].index;
      const end = i < sceneMatches.length - 1 ? sceneMatches[i + 1].index : script.length;
      const sceneContent = script.slice(start, end);
      const wordCount = sceneContent.split(/\s+/).filter(w => w.trim()).length;
      const clipCount = Math.max(1, Math.ceil(wordCount / wordsPerClip));
      
      // Clean up title
      let title = sceneMatches[i].title
        .replace(/^\[SCENE[:\s]*/i, '')
        .replace(/\]$/, '')
        .replace(/^(INT\.|EXT\.|INT\/EXT\.?)\s*/i, '')
        .trim();
      
      // Truncate long titles
      if (title.length > 40) {
        title = title.slice(0, 40) + '...';
      }
      
      scenes.push({
        id: i + 1,
        title: title || `Scene ${i + 1}`,
        description: sceneContent.slice(sceneMatches[i].title.length, sceneMatches[i].title.length + 80).trim() + '...',
        clipCount,
        durationSeconds: clipCount * clipDuration
      });
    }
  }
  
  return scenes;
}

export function SceneBreakdown({ script, clipDuration = 4 }: SceneBreakdownProps) {
  const scenes = parseScenes(script, clipDuration);
  const totalClips = scenes.reduce((sum, s) => sum + s.clipCount, 0);
  const totalDuration = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  
  if (scenes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No scenes detected in script</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {scenes.length} scenes • {totalClips} clips
        </span>
        <span className="font-medium text-foreground">
          {totalDuration < 60 ? `${totalDuration}s` : `${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`} total
        </span>
      </div>
      
      {/* Scene List */}
      <div className="space-y-3">
        {scenes.map((scene, index) => (
          <div 
            key={scene.id}
            className={cn(
              "relative rounded-xl border border-border/50 p-4 transition-all hover:border-border",
              "bg-gradient-to-r from-muted/30 to-transparent"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Scene Number */}
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{scene.id}</span>
              </div>
              
              {/* Scene Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="font-medium text-foreground truncate">{scene.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {scene.clipCount} clips
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {scene.durationSeconds}s
                    </span>
                  </div>
                </div>
                
                {/* Clip Indicators */}
                <div className="flex items-center gap-1 mt-2">
                  {[...Array(scene.clipCount)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        "bg-primary/60 hover:bg-primary"
                      )}
                      style={{ 
                        width: `${Math.max(8, 100 / Math.max(scene.clipCount, 8))}%`,
                        maxWidth: '20px'
                      }}
                      title={`Clip ${i + 1} (${clipDuration}s)`}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Connector line to next scene */}
            {index < scenes.length - 1 && (
              <div className="absolute left-7 -bottom-3 w-0.5 h-3 bg-border/50" />
            )}
          </div>
        ))}
      </div>
      
      {/* Footer info */}
      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          Each clip is {clipDuration} seconds. Clips within a scene are combined for seamless playback.
        </p>
      </div>
    </div>
  );
}
