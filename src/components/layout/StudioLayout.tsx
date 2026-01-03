import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Film, Folder, FileText, Play, Download, Settings, Bell, 
  Sparkles, ChevronRight, User, LogOut, CreditCard
} from 'lucide-react';
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
  { title: 'Projects', url: '/projects', icon: Folder, step: 1 },
  { title: 'Script', url: '/script', icon: FileText, step: 2 },
  { title: 'Production', url: '/production', icon: Play, step: 3 },
  { title: 'Export', url: '/export', icon: Download, step: 4 },
];

function StudioSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { credits, buyCredits, activeProject } = useStudio();
  const isCollapsed = state === 'collapsed';

  const currentStepIndex = NAV_ITEMS.findIndex(
    item => location.pathname === item.url || (item.url === '/projects' && location.pathname === '/')
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border/20 bg-sidebar/80 backdrop-blur-xl">
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0 group">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary via-primary/60 to-accent blur-lg opacity-60 group-hover:opacity-80 transition-opacity" />
            {/* Icon container */}
            <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
              <Film className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden animate-fade-in">
              <h1 className="text-xl font-display font-bold tracking-tight">
                <span className="text-gradient-primary">Apex</span>
                <span className="text-foreground"> Studio</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Beta</span>
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {NAV_ITEMS.map((item, index) => {
                const isActive = location.pathname === item.url || 
                  (item.url === '/projects' && location.pathname === '/');
                const isPast = index < currentStepIndex;
                const isFuture = index > currentStepIndex;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <NavLink 
                        to={item.url} 
                        className={cn(
                          "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                          isActive && "bg-primary/10"
                        )}
                        activeClassName=""
                      >
                        {/* Active indicator line */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary" />
                        )}
                        
                        {/* Step indicator / Icon */}
                        <div className={cn(
                          "flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-all duration-200",
                          isActive && "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
                          isPast && "bg-success/20 text-success",
                          isFuture && "bg-muted/50 text-muted-foreground",
                          !isActive && !isPast && !isFuture && "bg-muted/50 text-muted-foreground"
                        )}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        
                        {/* Label */}
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            "font-medium text-sm block",
                            isActive && "text-foreground",
                            isPast && "text-foreground/80",
                            isFuture && "text-muted-foreground"
                          )}>
                            {item.title}
                          </span>
                        </div>
                        
                        {/* Step number */}
                        <span className={cn(
                          "text-xs font-mono shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground/50"
                        )}>
                          {item.step}
                        </span>
                        
                        {/* Hover arrow */}
                        <ChevronRight className={cn(
                          "w-4 h-4 opacity-0 -translate-x-2 transition-all duration-200",
                          "group-hover:opacity-100 group-hover:translate-x-0",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )} />
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Active Project Card */}
        {!isCollapsed && activeProject && (
          <div className="mt-6 animate-fade-in">
            <div className="px-2 mb-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Active Project</span>
            </div>
            <div className="mx-2 p-3 rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <p className="text-sm font-medium text-foreground truncate">{activeProject.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={activeProject.status as 'idle' | 'generating' | 'rendering' | 'completed'} className="text-[10px]">
                  {activeProject.status}
                </Badge>
                {activeProject.duration_seconds && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {Math.floor(activeProject.duration_seconds / 60)}:{String(activeProject.duration_seconds % 60).padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>
          </div>
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
    <header className="h-14 px-4 flex items-center justify-between border-b border-border/20 bg-background/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="hover:bg-muted/50" />
        
        {activeProject && (
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="w-px h-5 bg-border/50" />
            <span className="text-sm font-medium text-foreground">{activeProject.name}</span>
            <Badge variant={activeProject.status as 'idle' | 'generating' | 'rendering' | 'completed'} className="text-[10px]">
              {activeProject.status}
            </Badge>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />
        </Button>

        <Button
          variant="glow"
          size="sm"
          onClick={exportVideo}
          disabled={activeProject?.status !== 'completed'}
          className="gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Export 4K
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-1">
              <Avatar className="h-8 w-8 ring-2 ring-border/30 hover:ring-primary/50 transition-all">
                <AvatarImage src="" />
                <AvatarFallback className="bg-gradient-to-br from-primary/30 to-accent/30 text-sm font-semibold">
                  JS
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-popover/95 backdrop-blur-xl border-border/50">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">John Smith</p>
              <p className="text-xs text-muted-foreground">john@example.com</p>
            </div>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem className="gap-2">
              <User className="w-4 h-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <CreditCard className="w-4 h-4" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4" />
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
          {/* Primary orb */}
          <div className="absolute top-[-10%] right-[10%] w-[700px] h-[700px] bg-primary/[0.04] rounded-full blur-[120px] orb-1" />
          {/* Accent orb */}
          <div className="absolute bottom-[-5%] left-[5%] w-[600px] h-[600px] bg-accent/[0.06] rounded-full blur-[100px] orb-2" />
          {/* Warm orb */}
          <div className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] bg-warning/[0.03] rounded-full blur-[80px] orb-3" />
          
          {/* Subtle grid overlay */}
          <div 
            className="absolute inset-0 opacity-[0.012]"
            style={{
              backgroundImage: `linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: '80px 80px'
            }}
          />
          
          {/* Gradient overlay at top */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-background to-transparent" />
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