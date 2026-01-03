import { useNavigate } from 'react-router-dom';
import { 
  Download, Share2, ArrowLeft, Check, Copy, ExternalLink, 
  AlertCircle, Film, FileVideo, Music, Subtitles, Sparkles,
  Globe, Shield
} from 'lucide-react';
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
    toast.success('Share link copied!');
  };

  if (!activeProject) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] orb-2" />
        </div>
        
        <div className="relative z-10 text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 mx-auto icon-container">
            <AlertCircle className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-display text-foreground">No Project Selected</h2>
            <p className="text-muted-foreground">Select a project to export</p>
          </div>
          <Button variant="glow" size="lg" onClick={() => navigate('/projects')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-warning/5 rounded-full blur-[120px] orb-1" />
        </div>
        
        <div className="relative z-10 text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 mx-auto icon-container-warning">
            <Film className="w-8 h-8 text-warning" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-display text-foreground">Video Not Ready</h2>
            <p className="text-muted-foreground">Generate your video first</p>
          </div>
          <Button variant="glow" size="lg" onClick={() => navigate('/production')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Go to Production
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10 animate-fade-in">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="icon-container-success p-2.5">
                <Check className="w-5 h-5 text-success" />
              </div>
              <Badge variant="completed" className="text-xs">
                Ready to Export
              </Badge>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-display text-foreground mb-2">
                Export Your Video
              </h1>
              <p className="text-muted-foreground">
                Download or share your finished creation
              </p>
            </div>
          </div>
          
          <Button variant="outline" onClick={() => navigate('/production')} className="gap-2 shrink-0">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Preview */}
          <div className="glass overflow-hidden hover-lift animate-fade-in">
            <div className="aspect-video relative">
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(to bottom, transparent 50%, hsl(var(--card))),
                    url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=60')`,
                }}
              />
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <Badge variant="completed">Ready</Badge>
                <Badge variant="outline" className="font-mono text-xs">02:04</Badge>
              </div>
            </div>
            <div className="p-5 border-t border-border/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground text-lg">{activeProject.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {activeProject.credits_used?.toLocaleString()} credits
                  </p>
                </div>
                <Button variant="glow" onClick={() => handleExport('MP4 4K')} className="gap-2">
                  <Download className="w-4 h-4" />
                  Download 4K
                </Button>
              </div>
            </div>
          </div>

          {/* Formats */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">Video Formats</h3>
            <div className="space-y-3">
              {EXPORT_FORMATS.map((format, index) => (
                <button
                  key={format.id}
                  onClick={() => handleExport(format.name)}
                  className={cn(
                    "w-full p-4 rounded-xl transition-all duration-200 flex items-center gap-4 text-left group shine animate-scale-up",
                    format.recommended
                      ? "glass border-primary/20 hover:border-primary/40"
                      : "glass-subtle hover:bg-foreground/[0.02]"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={cn(
                    "p-3 rounded-xl shrink-0",
                    format.recommended ? "icon-container" : "bg-muted/30"
                  )}>
                    <format.icon className={cn(
                      "w-5 h-5",
                      format.recommended ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{format.name}</span>
                      {format.recommended && (
                        <Badge className="text-[10px]">Best</Badge>
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

          {/* Additional */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">Additional</h3>
            <div className="grid grid-cols-2 gap-3">
              {ADDITIONAL_EXPORTS.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => toast.success(`Exporting ${item.name}...`)}
                  className="p-4 rounded-xl glass-subtle hover:bg-foreground/[0.02] transition-all flex items-center gap-3 text-left group animate-scale-up"
                  style={{ animationDelay: `${(index + 3) * 50}ms` }}
                >
                  <div className="p-2.5 rounded-lg bg-muted/30 group-hover:bg-primary/10 transition-colors">
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
          {/* Share */}
          <div className="glass p-6 space-y-5 hover-lift animate-fade-in delay-2">
            <div className="flex items-center gap-3">
              <div className="icon-container p-2.5">
                <Share2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Share</h3>
                <p className="text-xs text-muted-foreground">Get a link</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl glass-subtle">
              <span className="text-sm text-muted-foreground truncate flex-1 font-mono">
                apex.studio/share/abc123
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleShare}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <Button variant="outline" className="w-full gap-2" onClick={handleShare}>
              <ExternalLink className="w-4 h-4" />
              Copy Link
            </Button>
          </div>

          {/* License */}
          <div className="glass p-6 space-y-4 hover-lift animate-fade-in delay-3" style={{ background: 'linear-gradient(135deg, hsl(160 65% 45% / 0.06), hsl(160 65% 45% / 0.02))' }}>
            <div className="flex items-center gap-3">
              <div className="icon-container-success p-2.5">
                <Shield className="w-5 h-5 text-success" />
              </div>
              <span className="font-semibold text-foreground">Commercial License</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Full commercial rights included
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success" className="text-xs gap-1">
                <Check className="w-3 h-3" />
                Royalty Free
              </Badge>
              <Badge variant="success" className="text-xs gap-1">
                <Globe className="w-3 h-3" />
                Worldwide
              </Badge>
            </div>
          </div>

          {/* Details */}
          <div className="glass p-6 space-y-4 hover-lift animate-fade-in delay-4">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <FileVideo className="w-4 h-4 text-muted-foreground" />
              Details
            </h4>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Duration', value: '02:04' },
                { label: 'Resolution', value: '4K UHD' },
                { label: 'Frame Rate', value: '30 fps' },
                { label: 'Credits', value: activeProject.credits_used?.toLocaleString() || '0' },
              ].map((item, index) => (
                <div key={index} className="flex justify-between items-center py-1.5 border-b border-border/10 last:border-0">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}