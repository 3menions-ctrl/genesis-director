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
    <Sidebar collapsible="icon" className="border-r border-border/10 bg-sidebar/60 backdrop-blur-2xl">
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-primary/30 blur-lg" />
            <div className="icon-container p-2.5">
              <Film className="w-5 h-5 text-primary" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden animate-fade-in">
              <h1 className="text-xl font-display tracking-tight">
                <span className="text-gradient">Apex</span>
                <span className="text-foreground/90"> Studio</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-success pulse-soft" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Beta</span>
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
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <NavLink 
                        to={item.url} 
                        className={cn(
                          "relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group",
                          isActive && "glass"
                        )}
                        activeClassName=""
                      >
                        {/* Active line indicator */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary" />
                        )}
                        
                        {/* Icon */}
                        <div className={cn(
                          "flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-all duration-300",
                          isActive && "icon-container",
                          isPast && "icon-container-success",
                          !isActive && !isPast && "bg-muted/30 text-muted-foreground group-hover:bg-muted/50"
                        )}>
                          <item.icon className={cn(
                            "w-[18px] h-[18px] transition-colors",
                            isActive && "text-primary",
                            isPast && "text-success",
                            !isActive && !isPast && "text-muted-foreground group-hover:text-foreground"
                          )} />
                        </div>
                        
                        {/* Label */}
                        <span className={cn(
                          "font-medium text-sm flex-1",
                          isActive && "text-foreground",
                          !isActive && "text-muted-foreground group-hover:text-foreground"
                        )}>
                          {item.title}
                        </span>
                        
                        {/* Step number */}
                        <span className={cn(
                          "text-[11px] font-mono transition-colors",
                          isActive ? "text-primary/70" : "text-muted-foreground/40"
                        )}>
                          {item.step}
                        </span>
                        
                        {/* Hover chevron */}
                        <ChevronRight className={cn(
                          "w-4 h-4 opacity-0 -translate-x-1 transition-all duration-200",
                          "group-hover:opacity-100 group-hover:translate-x-0",
                          isActive ? "text-primary/50" : "text-muted-foreground/50"
                        )} />
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Active Project */}
        {!isCollapsed && activeProject && (
          <div className="mt-6 animate-fade-in">
            <div className="px-3 mb-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">Active</span>
            </div>
            <div className="mx-2 p-3 glass-subtle">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary pulse-soft" />
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
    <header className="h-14 px-4 flex items-center justify-between border-b border-border/10 bg-background/60 backdrop-blur-2xl sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="hover:bg-foreground/5 rounded-lg" />
        
        {activeProject && (
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="w-px h-5 bg-border/30" />
            <span className="text-sm font-medium text-foreground/80">{activeProject.name}</span>
            <Badge variant={activeProject.status as 'idle' | 'generating' | 'rendering' | 'completed'} className="text-[10px]">
              {activeProject.status}
            </Badge>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-primary" />
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
              <Avatar className="h-8 w-8 ring-2 ring-border/20 hover:ring-primary/30 transition-all">
                <AvatarImage src="" />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-sm font-medium">
                  JS
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 glass border-border/20">
            <div className="px-3 py-2.5">
              <p className="text-sm font-medium">John Smith</p>
              <p className="text-xs text-muted-foreground">john@example.com</p>
            </div>
            <DropdownMenuSeparator className="bg-border/20" />
            <DropdownMenuItem className="gap-2.5 py-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 py-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 py-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/20" />
            <DropdownMenuItem className="gap-2.5 py-2 text-destructive focus:text-destructive">
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
        {/* Ambient Background */}
        <div className="fixed inset-0 pointer-events-none z-0">
          {/* Gradient orbs */}
          <div className="absolute top-[-20%] right-[10%] w-[800px] h-[800px] bg-primary/[0.03] rounded-full blur-[150px] orb-1" />
          <div className="absolute bottom-[-10%] left-[5%] w-[700px] h-[700px] bg-accent/[0.04] rounded-full blur-[120px] orb-2" />
          <div className="absolute top-[40%] left-[-15%] w-[600px] h-[600px] bg-warning/[0.02] rounded-full blur-[100px] orb-3" />
          
          {/* Subtle noise texture */}
          <div 
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
          
          {/* Top gradient fade */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background to-transparent" />
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