import { Film, Download, Share2, Menu, Sparkles, Bell, Settings, User } from 'lucide-react';
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
    <header className="h-16 px-4 lg:px-6 flex items-center justify-between border-b border-border/30 bg-card/40 backdrop-blur-xl relative z-50">
      {/* Left Section - Logo & Project */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-3">
          {/* Animated Logo */}
          <div className="relative group">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-accent blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
            <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
              <Film className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-gradient-primary">Apex</span>
                <span className="text-foreground"> Studio</span>
              </h1>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                BETA
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{projectName}</p>
          </div>
        </div>

        {/* Breadcrumb divider on larger screens */}
        <div className="hidden lg:flex items-center gap-3 text-muted-foreground/50">
          <span>/</span>
          <span className="text-sm text-foreground/80 font-medium">{projectName}</span>
        </div>
      </div>

      {/* Center Section - Status */}
      <div className="hidden md:flex items-center gap-3">
        <Badge variant={statusVariant} className="gap-1.5 px-3 py-1">
          {status === 'generating' && <Sparkles className="w-3 h-3" />}
          {status === 'rendering' && (
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
          )}
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      </div>

      {/* Right Section - Actions & User */}
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
          className="hidden sm:flex border-border/50 hover:border-primary/50"
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
          <span className="hidden sm:inline">Export</span> 4K
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-1">
              <Avatar className="h-8 w-8 border-2 border-border/50 hover:border-primary/50 transition-colors">
                <AvatarImage src="" />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-sm font-medium">
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
