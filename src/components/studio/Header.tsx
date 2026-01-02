import { Film, Download, Share2, Menu, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProjectStatus } from '@/types/studio';

interface HeaderProps {
  projectName: string;
  status: ProjectStatus;
  onExport?: () => void;
  onShare?: () => void;
  onMenuClick?: () => void;
}

export function Header({ projectName, status, onExport, onShare, onMenuClick }: HeaderProps) {
  const statusVariant = {
    idle: 'idle',
    generating: 'generating',
    rendering: 'rendering',
    completed: 'completed',
  }[status] as 'idle' | 'generating' | 'rendering' | 'completed';

  return (
    <header className="h-16 px-4 flex items-center justify-between border-b border-border/50 bg-card/40 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary/50 shadow-lg shadow-primary/20">
            <Film className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">Apex Studio</h1>
              <Badge variant="outline" className="text-xs font-mono">BETA</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{projectName}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={statusVariant} className="hidden sm:flex">
          {status === 'generating' && <Sparkles className="w-3 h-3 mr-1" />}
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>

        <Button
          variant="outline"
          size="sm"
          onClick={onShare}
          className="hidden sm:flex"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>

        <Button
          variant="glow"
          size="sm"
          onClick={onExport}
          disabled={status !== 'completed'}
        >
          <Download className="w-4 h-4 mr-2" />
          Export 4K
        </Button>
      </div>
    </header>
  );
}
