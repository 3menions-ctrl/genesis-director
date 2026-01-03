import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Film, Folder, FileText, Play, Download, Bell, 
  Sparkles, ChevronRight, User, LogOut, CreditCard, Settings,
  Zap, Crown
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
  { title: 'Projects', url: '/projects', icon: Folder, step: 1, color: 'primary' },
  { title: 'Script', url: '/script', icon: FileText, step: 2, color: 'info' },
  { title: 'Production', url: '/production', icon: Play, step: 3, color: 'accent' },
  { title: 'Export', url: '/export', icon: Download, step: 4, color: 'success' },
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
    <Sidebar collapsible="icon" className="border-r border-border/10 bg-sidebar/80 backdrop-blur-2xl">
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3.5">
          {/* Logo with aurora glow */}
          <div className="relative shrink-0 group">
            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-primary/40 via-[hsl(280,85%,60%)]/30 to-accent/40 blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative icon-box p-3">
              <Film className="w-5 h-5 text-primary" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden animate-fade-in-up">
              <h1 className="text-xl font-display tracking-tight">
                <span className="text-gradient-aurora">Apex</span>
                <span className="text-foreground"> Studio</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="aurora" className="text-[10px] px-2 py-0">
                  <Crown className="w-2.5 h-2.5 mr-1" />
                  PRO
                </Badge>
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1.5">
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
                          "relative flex items-center gap-3.5 px-3 py-3.5 rounded-xl transition-all duration-300 group",
                          isActive && "glass-interactive",
                          !isActive && "hover:bg-foreground/5"
                        )}
                        activeClassName=""
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {/* Active glow line */}
                        {isActive && (
                          <>
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-primary via-primary to-primary/50" />
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-primary blur-sm" />
                          </>
                        )}
                        
                        {/* Icon container */}
                        <div className={cn(
                          "relative flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-300",
                          isActive && "icon-box",
                          isPast && "icon-box-success",
                          isFuture && "bg-muted/40 group-hover:bg-muted/60"
                        )}>
                          <item.icon className={cn(
                            "w-[18px] h-[18px] transition-all duration-300",
                            isActive && "text-primary",
                            isPast && "text-success",
                            isFuture && "text-muted-foreground group-hover:text-foreground"
                          )} />
                          
                          {/* Completion check for past steps */}
                          {isPast && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-success flex items-center justify-center shadow-lg shadow-success/30">
                              <svg className="w-2.5 h-2.5 text-success-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        {/* Label & step */}
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            "font-medium text-sm block transition-colors",
                            isActive && "text-foreground",
                            isPast && "text-foreground/80",
                            isFuture && "text-muted-foreground group-hover:text-foreground"
                          )}>
                            {item.title}
                          </span>
                          <span className={cn(
                            "text-[11px] font-mono transition-colors",
                            isActive ? "text-primary/70" : "text-muted-foreground/50"
                          )}>
                            Step {item.step}
                          </span>
                        </div>
                        
                        {/* Hover arrow */}
                        <ChevronRight className={cn(
                          "w-4 h-4 opacity-0 -translate-x-2 transition-all duration-200",
                          "group-hover:opacity-100 group-hover:translate-x-0",
                          isActive ? "text-primary/60" : "text-muted-foreground/50"
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
          <div className="mt-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="px-3 mb-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 font-medium">
                Active Project
              </span>
            </div>
            <div className="mx-1 p-4 card-aurora rounded-xl">
              <div className="flex items-start gap-3">
                <div className="relative">
                  <div className="status-dot status-generating" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {activeProject.name}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge 
                      variant={activeProject.status as 'idle' | 'generating' | 'rendering' | 'completed'} 
                      className="text-[10px]"
                    >
                      {activeProject.status}
                    </Badge>
                    {activeProject.duration_seconds && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {Math.floor(activeProject.duration_seconds / 60)}:{String(activeProject.duration_seconds % 60).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!isCollapsed && (
          <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <CreditsDisplay credits={credits} onBuyCredits={buyCredits} />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function StudioHeader() {
  const { activeProject, exportVideo } = useStudio();

  return (
    <header className="h-16 px-5 flex items-center justify-between border-b border-border/10 bg-background/50 backdrop-blur-2xl sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="hover:bg-foreground/5 rounded-xl h-9 w-9" />
        
        {activeProject && (
          <div className="flex items-center gap-4 animate-fade-in-up">
            <div className="w-px h-6 bg-border/30" />
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">{activeProject.name}</span>
              <Badge 
                variant={activeProject.status as 'idle' | 'generating' | 'rendering' | 'completed'} 
                className="text-[10px]"
              >
                {activeProject.status}
              </Badge>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative group">
          <Bell className="w-[18px] h-[18px] text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent animate-pulse" />
        </Button>

        {/* Export Button */}
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

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-1">
              <Avatar className="h-9 w-9 ring-2 ring-border/30 hover:ring-primary/40 transition-all duration-300">
                <AvatarImage src="" />
                <AvatarFallback className="bg-gradient-to-br from-primary/30 via-[hsl(280,85%,60%)]/20 to-accent/30 text-sm font-semibold text-foreground">
                  JS
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 glass border-border/30 p-2">
            <div className="px-3 py-3">
              <p className="text-sm font-semibold text-foreground">John Smith</p>
              <p className="text-xs text-muted-foreground">john@example.com</p>
            </div>
            <DropdownMenuSeparator className="bg-border/20 my-2" />
            <DropdownMenuItem className="gap-3 py-2.5 rounded-lg cursor-pointer">
              <User className="w-4 h-4 text-muted-foreground" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 py-2.5 rounded-lg cursor-pointer">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 py-2.5 rounded-lg cursor-pointer">
              <Settings className="w-4 h-4 text-muted-foreground" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/20 my-2" />
            <DropdownMenuItem className="gap-3 py-2.5 rounded-lg cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
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
        {/* Premium Ambient Background */}
        <div className="fixed inset-0 pointer-events-none z-0 noise-overlay">
          {/* Aurora orbs */}
          <div className="absolute top-[-30%] right-[-10%] w-[900px] h-[900px] rounded-full bg-primary/[0.07] blur-[150px] orb-float-1 pulse-aurora" />
          <div className="absolute bottom-[-20%] left-[-15%] w-[800px] h-[800px] rounded-full bg-accent/[0.06] blur-[130px] orb-float-2 pulse-aurora" />
          <div className="absolute top-[30%] left-[40%] w-[600px] h-[600px] rounded-full bg-[hsl(280,85%,60%)]/[0.04] blur-[120px] orb-float-3 pulse-aurora" />
          <div className="absolute bottom-[20%] right-[20%] w-[500px] h-[500px] rounded-full bg-info/[0.04] blur-[100px] orb-float-1" style={{ animationDelay: '-10s' }} />
          
          {/* Radial gradient overlay */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.05) 0%, transparent 50%)'
            }}
          />
          
          {/* Top fade */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-background via-background/80 to-transparent" />
          
          {/* Subtle grid */}
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `
                linear-gradient(hsl(var(--foreground) / 0.5) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--foreground) / 0.5) 1px, transparent 1px)
              `,
              backgroundSize: '100px 100px'
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