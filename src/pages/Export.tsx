import { useNavigate } from 'react-router-dom';
import { Download, Share2, ArrowLeft, Check, Copy, ExternalLink, AlertCircle, Film, FileVideo, Music, Subtitles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStudio } from '@/contexts/StudioContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const EXPORT_FORMATS = [
  { id: 'mp4_4k', name: 'MP4 4K', resolution: '3840 × 2160', size: '~850 MB', recommended: true, icon: FileVideo },
  { id: 'mp4_1080p', name: 'MP4 1080p', resolution: '1920 × 1080', size: '~250 MB', recommended: false, icon: FileVideo },
  { id: 'mp4_720p', name: 'MP4 720p', resolution: '1280 × 720', size: '~120 MB', recommended: false, icon: FileVideo },
];

const ADDITIONAL_EXPORTS = [
  { id: 'audio', name: 'Audio Only', format: 'MP3 / WAV', icon: Music },
  { id: 'subtitles', name: 'Subtitles', format: 'SRT / VTT', icon: Subtitles },
];

export default function Export() {
  const navigate = useNavigate();
  const { activeProject, exportVideo } = useStudio();

  const status = activeProject?.status || 'idle';
  const isReady = status === 'completed';

  const handleExport = (format: string) => {
    toast.success(`Exporting ${format}...`);
    exportVideo();
  };

  const handleShare = () => {
    navigator.clipboard.writeText('https://apex.studio/share/abc123');
    toast.success('Share link copied to clipboard!');
  };

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="w-20 h-20 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No project selected</h2>
        <p className="text-muted-foreground mb-6">Select a project to export</p>
        <Button variant="glow" onClick={() => navigate('/projects')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go to Projects
        </Button>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="w-20 h-20 rounded-2xl bg-warning/10 border border-warning/30 flex items-center justify-center mb-6">
          <Film className="w-8 h-8 text-warning" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Video not ready</h2>
        <p className="text-muted-foreground mb-6">Generate your video first before exporting</p>
        <Button variant="glow" onClick={() => navigate('/production')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go to Production
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Export Video</h1>
          <p className="text-muted-foreground">Download your finished video or share it</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/production')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Production
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Export Options */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Preview Card */}
          <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
            <div className="aspect-video bg-gradient-to-br from-muted/30 to-background relative">
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(to bottom, transparent 60%, hsl(var(--card))),
                    url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=60')`,
                }}
              />
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <Badge variant="completed">Ready to Export</Badge>
                <Badge variant="outline" className="font-mono text-xs bg-background/80">
                  02:04
                </Badge>
              </div>
            </div>
            <div className="p-4 border-t border-border/30">
              <h3 className="font-semibold text-foreground">{activeProject.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {activeProject.credits_used?.toLocaleString()} credits used
              </p>
            </div>
          </div>

          {/* Export Format Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Video Format</h3>
            <div className="space-y-3">
              {EXPORT_FORMATS.map((format) => (
                <button
                  key={format.id}
                  onClick={() => handleExport(format.name)}
                  className={cn(
                    "w-full p-4 rounded-xl border transition-all flex items-center gap-4 text-left group",
                    format.recommended
                      ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
                      : "border-border/50 bg-card/50 hover:border-primary/30"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-xl shrink-0",
                    format.recommended ? "bg-primary/20" : "bg-muted/50"
                  )}>
                    <format.icon className={cn(
                      "w-6 h-6",
                      format.recommended ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{format.name}</span>
                      {format.recommended && (
                        <Badge variant="default" className="text-[10px]">Recommended</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format.resolution} • {format.size}
                    </p>
                  </div>
                  <Download className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Additional Exports */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Additional Exports</h3>
            <div className="grid grid-cols-2 gap-3">
              {ADDITIONAL_EXPORTS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toast.success(`Exporting ${item.name}...`)}
                  className="p-4 rounded-xl border border-border/50 bg-card/50 hover:border-primary/30 transition-all flex items-center gap-3 text-left group"
                >
                  <div className="p-2.5 rounded-lg bg-muted/50 group-hover:bg-primary/20 transition-colors">
                    <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <span className="font-medium text-foreground block">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.format}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Share Card */}
          <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Share2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Share</h3>
                <p className="text-xs text-muted-foreground">Get a shareable link</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
              <span className="text-sm text-muted-foreground truncate flex-1">
                apex.studio/share/abc123
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleShare}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <Button variant="outline" className="w-full" onClick={handleShare}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Copy Share Link
            </Button>
          </div>

          {/* License Info */}
          <div className="rounded-2xl border border-success/30 bg-success/5 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-success" />
              </div>
              <span className="font-semibold text-foreground">Commercial License</span>
            </div>
            <p className="text-sm text-muted-foreground">
              This video includes a commercial license. You can use it for any business or personal purpose.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">Royalty Free</Badge>
              <Badge variant="outline" className="text-xs">No Attribution</Badge>
              <Badge variant="outline" className="text-xs">Worldwide</Badge>
            </div>
          </div>

          {/* Project Stats */}
          <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
            <h4 className="font-semibold text-foreground">Project Details</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-mono text-foreground">02:04</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Resolution</span>
                <span className="font-mono text-foreground">4K UHD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frame Rate</span>
                <span className="font-mono text-foreground">30 fps</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credits Used</span>
                <span className="font-mono text-foreground">{activeProject.credits_used?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
