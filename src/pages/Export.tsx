import { useNavigate } from 'react-router-dom';
import { 
  Download, Share2, ArrowLeft, Check, Copy, ExternalLink, 
  AlertCircle, Film, FileVideo, Music, Subtitles, Sparkles,
  Globe, Shield, Star
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
          <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-[hsl(280,85%,60%)]/[0.06] rounded-full blur-[150px] orb-float-2" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in-up">
          <div className="w-24 h-24 mx-auto icon-box p-6">
            <AlertCircle className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-display text-foreground">No Project Selected</h2>
            <p className="text-lg text-muted-foreground">Select a project to export</p>
          </div>
          <Button variant="glow" size="xl" onClick={() => navigate('/projects')} className="gap-3">
            <ArrowLeft className="w-5 h-5" />
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
          <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-warning/[0.06] rounded-full blur-[150px] orb-float-1" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in-up">
          <div className="w-24 h-24 mx-auto icon-box-warning p-6">
            <Film className="w-10 h-10 text-warning" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-display text-foreground">Video Not Ready</h2>
            <p className="text-lg text-muted-foreground">Generate your video first</p>
          </div>
          <Button variant="glow" size="xl" onClick={() => navigate('/production')} className="gap-3">
            <ArrowLeft className="w-5 h-5" />
            Go to Production
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10 animate-fade-in-up">
        <div className="flex items-start justify-between gap-8">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="icon-box-success p-3">
                <Check className="w-6 h-6 text-success" />
              </div>
              <Badge variant="success" className="text-xs gap-1.5">
                <Star className="w-3 h-3" />
                Ready to Export
              </Badge>
            </div>
            <div>
              <h1 className="text-4xl lg:text-5xl font-display text-foreground mb-3 tracking-tight">
                Export Your <span className="text-gradient-aurora">Video</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Download or share your finished creation
              </p>
            </div>
          </div>
          
          <Button variant="outline" size="lg" onClick={() => navigate('/production')} className="gap-2 shrink-0">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Preview */}
          <div className="card-premium overflow-hidden hover-lift animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="aspect-video relative">
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(to bottom, transparent 40%, hsl(var(--card))),
                    url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=60')`,
                }}
              />
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <Badge variant="success">Ready</Badge>
                <Badge variant="outline" className="font-mono text-xs backdrop-blur-xl bg-background/60">02:04</Badge>
              </div>
            </div>
            <div className="p-6 border-t border-border/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground text-xl">{activeProject.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {activeProject.credits_used?.toLocaleString()} credits used
                  </p>
                </div>
                <Button variant="aurora" size="lg" onClick={() => handleExport('MP4 4K')} className="gap-2">
                  <Download className="w-5 h-5" />
                  Download 4K
                </Button>
              </div>
            </div>
          </div>

          {/* Formats */}
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-foreground">Video Formats</h3>
            <div className="space-y-3">
              {EXPORT_FORMATS.map((format, index) => (
                <button
                  key={format.id}
                  onClick={() => handleExport(format.name)}
                  className={cn(
                    "w-full p-5 rounded-2xl transition-all duration-400 flex items-center gap-5 text-left group shine-effect animate-scale-in",
                    format.recommended
                      ? "card-aurora"
                      : "card-premium hover:border-primary/30"
                  )}
                  style={{ animationDelay: `${(index + 2) * 60}ms` }}
                >
                  <div className={cn(
                    "p-3.5 rounded-xl shrink-0",
                    format.recommended ? "icon-box" : "bg-muted/40 group-hover:bg-primary/10"
                  )}>
                    <format.icon className={cn(
                      "w-6 h-6 transition-colors",
                      format.recommended ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-foreground text-lg">{format.name}</span>
                      {format.recommended && (
                        <Badge variant="aurora" className="text-[10px]">Recommended</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      {format.resolution} • {format.size}
                    </p>
                  </div>
                  <Download className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Additional */}
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-foreground">Additional Assets</h3>
            <div className="grid grid-cols-2 gap-4">
              {ADDITIONAL_EXPORTS.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => toast.success(`Exporting ${item.name}...`)}
                  className="p-5 rounded-xl card-premium hover:border-primary/30 transition-all duration-300 flex items-center gap-4 text-left group animate-scale-in"
                  style={{ animationDelay: `${(index + 5) * 60}ms` }}
                >
                  <div className="p-3 rounded-xl bg-muted/40 group-hover:bg-primary/10 transition-colors">
                    <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block">{item.name}</span>
                    <span className="text-sm text-muted-foreground">{item.format}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Share */}
          <div className="card-premium p-6 space-y-5 hover-lift animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-3">
              <div className="icon-box p-3">
                <Share2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">Share</h3>
                <p className="text-xs text-muted-foreground">Get a shareable link</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-4 rounded-xl glass-subtle">
              <span className="text-sm text-muted-foreground truncate flex-1 font-mono">
                apex.studio/share/abc123
              </span>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 control-btn-primary" onClick={handleShare}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <Button variant="outline" className="w-full gap-2" onClick={handleShare}>
              <ExternalLink className="w-4 h-4" />
              Copy Share Link
            </Button>
          </div>

          {/* License */}
          <div 
            className="card-premium p-6 space-y-5 hover-lift animate-fade-in-up" 
            style={{ 
              animationDelay: '250ms',
              background: 'linear-gradient(135deg, hsl(var(--success) / 0.08), hsl(var(--success) / 0.02))'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="icon-box-success p-3">
                <Shield className="w-5 h-5 text-success" />
              </div>
              <span className="font-semibold text-foreground text-lg">Commercial License</span>
            </div>
            <p className="text-muted-foreground">
              Full commercial rights included with your export
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success" className="text-xs gap-1.5">
                <Check className="w-3 h-3" />
                Royalty Free
              </Badge>
              <Badge variant="success" className="text-xs gap-1.5">
                <Globe className="w-3 h-3" />
                Worldwide
              </Badge>
            </div>
          </div>

          {/* Details */}
          <div className="card-premium p-6 space-y-5 hover-lift animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <h4 className="font-semibold text-foreground text-lg flex items-center gap-2">
              <FileVideo className="w-5 h-5 text-muted-foreground" />
              Video Details
            </h4>
            <div className="space-y-4">
              {[
                { label: 'Duration', value: '02:04' },
                { label: 'Resolution', value: '4K UHD' },
                { label: 'Frame Rate', value: '30 fps' },
                { label: 'Credits Used', value: activeProject.credits_used?.toLocaleString() || '0' },
              ].map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-border/10 last:border-0">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}