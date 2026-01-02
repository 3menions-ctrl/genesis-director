import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Film, Folder, FileText, Play, Download, Settings, Bell, ChevronsLeft } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { CreditsDisplay } from '@/components/studio/CreditsDisplay';
import { useStudio } from '@/contexts/StudioContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { title: 'Projects', url: '/projects', icon: Folder, description: 'Manage your videos' },
  { title: 'Script', url: '/script', icon: FileText, description: 'Write & edit content' },
  { title: 'Production', url: '/production', icon: Play, description: 'Generate & preview' },
  { title: 'Export', url: '/export', icon: Download, description: 'Download & share' },
];

function StudioSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { credits, buyCredits, activeProject } = useStudio();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-border/30">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-accent blur-md opacity-50" />
            <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
              <Film className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">
                  <span className="text-gradient-primary">Apex</span>
                  <span className="text-foreground"> Studio</span>
                </h1>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary mt-1">
                BETA
              </Badge>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workflow</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item, index) => {
                const isActive = location.pathname === item.url || 
                  (item.url === '/projects' && location.pathname === '/');
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <NavLink 
                        to={item.url} 
                        className="flex items-center gap-3"
                        activeClassName="bg-primary/10 text-primary"
                      >
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
                          isActive 
                            ? "bg-primary/20 text-primary" 
                            : "bg-muted/50 text-muted-foreground"
                        )}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{item.title}</span>
                          {!isCollapsed && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono shrink-0">
                          {index + 1}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Active Project Indicator */}
        {!isCollapsed && activeProject && (
          <SidebarGroup>
            <SidebarGroupLabel>Active Project</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-sm font-medium truncate">{activeProject.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={activeProject.status as any} className="text-[10px]">
                      {activeProject.status}
                    </Badge>
                    {activeProject.duration_seconds && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {Math.floor(activeProject.duration_seconds / 60)}:{String(activeProject.duration_seconds % 60).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!isCollapsed && (
          <CreditsDisplay credits={credits} onBuyCredits={buyCredits} />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function StudioHeader() {
  const { activeProject, exportVideo } = useStudio();

  return (
    <header className="h-14 px-4 flex items-center justify-between border-b border-border/30 bg-card/40 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        
        {activeProject && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-sm">{activeProject.name}</span>
            <Badge variant={activeProject.status as any} className="text-[10px]">
              {activeProject.status}
            </Badge>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Bell className="w-4 h-4" />
        </Button>

        <Button
          variant="glow"
          size="sm"
          onClick={exportVideo}
          disabled={activeProject?.status !== 'completed'}
        >
          <Download className="w-4 h-4 mr-2" />
          Export 4K
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
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

export function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background relative overflow-hidden">
        {/* Ambient Background Effects */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] animate-float" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-warning/5 rounded-full blur-[80px]" />
          <div 
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }}
          />
        </div>

        <StudioSidebar />

        <div className="flex-1 flex flex-col min-h-screen relative z-10">
          <StudioHeader />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
