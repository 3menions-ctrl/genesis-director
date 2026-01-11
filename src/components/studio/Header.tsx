import { Download, Share2, Menu, Bell, Settings, User } from 'lucide-react';
import apexLogo from '@/assets/apex-logo.png';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    <header className="h-16 px-4 lg:px-6 flex items-center justify-between border-b border-border/50 glass-card rounded-none relative z-50">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="w-5 h-5 text-foreground" />
        </Button>

        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center shadow-lg overflow-hidden">
              <img src={apexLogo} alt="Apex Studio" className="w-8 h-8 object-contain" />
            </div>
          </div>
          
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground tracking-tight">
                Apex Studio
              </h1>
              <Badge variant="outline" className="text-[10px] font-mono">
                BETA
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{projectName}</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-3 text-muted-foreground/50">
          <span>/</span>
          <span className="text-sm text-foreground/80 font-medium">{projectName}</span>
        </div>
      </div>

      {/* Center Section */}
      <div className="hidden md:flex items-center gap-3">
        <Badge variant={statusVariant} className="gap-1.5 px-3 py-1">
          {status === 'generating' && (
            <div className="w-2 h-2 rounded-full bg-current animate-pulse-soft" />
          )}
          {status === 'rendering' && (
            <div className="w-2 h-2 rounded-full bg-current animate-pulse-soft" />
          )}
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:flex text-muted-foreground hover:text-foreground"
        >
          <Bell className="w-4 h-4" />
        </Button>

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
          size="sm"
          onClick={onExport}
          disabled={status !== 'completed'}
        >
          <Download className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Export</span> 4K
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-1">
              <Avatar className="h-8 w-8 border border-border hover:border-foreground/20 transition-colors">
                <AvatarImage src="" />
                <AvatarFallback className="bg-muted text-foreground text-sm font-medium">
                  JS
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">John Smith</p>
              <p className="text-xs text-muted-foreground">john@example.com</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
