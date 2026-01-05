import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Film, Folder, FileText, Play, Download,
  ChevronRight, User, LogOut, Settings,
  Check, Plus, Zap, HelpCircle, Keyboard, Coins,
  Home, Video, Mic, Music, Sparkles
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
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
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Main navigation - always visible
const MAIN_NAV = [
  { title: 'Projects', url: '/projects', icon: Home },
];

// Project workflow steps - shown when in a project flow
const WORKFLOW_STEPS = [
  { title: 'Create', url: '/create', icon: Plus, step: 1 },
  { title: 'Script', url: '/script', icon: FileText, step: 2 },
  { title: 'Production', url: '/production', icon: Play, step: 3 },
  { title: 'Export', url: '/export', icon: Download, step: 4 },
];

// Iron-Clad Pipeline workflow steps
const PIPELINE_STEPS = [
  { title: 'Scripting', url: '/pipeline/scripting', icon: FileText, step: 1 },
  { title: 'Production', url: '/pipeline/production', icon: Zap, step: 2 },
  { title: 'Review', url: '/pipeline/review', icon: Play, step: 3 },
];

// Quick actions for header
const QUICK_ACTIONS = [
  { id: 'generate-video', label: 'Generate Video', icon: Video, shortcut: '⌘G' },
  { id: 'generate-voice', label: 'AI Voice', icon: Mic, shortcut: '⌘V' },
  { id: 'generate-music', label: 'AI Music', icon: Music, shortcut: '⌘M' },
  { id: 'generate-image', label: 'AI Image', icon: Sparkles, shortcut: '⌘I' },
];

function StudioSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { credits, buyCredits, activeProject, createProject, selectedDurationSeconds } = useStudio();
  const isCollapsed = state === 'collapsed';

  // Check if we're in a project workflow
  const isInWorkflow = WORKFLOW_STEPS.some(item => location.pathname === item.url);
  const isInPipeline = PIPELINE_STEPS.some(item => location.pathname === item.url);
  const isOnProjects = location.pathname === '/projects' || location.pathname === '/';
  
  const currentStepIndex = WORKFLOW_STEPS.findIndex(item => location.pathname === item.url);
  const currentPipelineIndex = PIPELINE_STEPS.findIndex(item => location.pathname === item.url);

  const handleNewProject = () => {
    createProject();
    navigate('/create');
  };
  
  const handleNewPipeline = () => {
    navigate('/pipeline/scripting');
  };

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-white/10"
      style={{ 
        background: 'linear-gradient(180deg, #0a0a0a 0%, #050505 50%, #080808 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.5), 4px 0 24px rgba(0,0,0,0.3)'
      }}
    >
      <SidebarHeader className="p-4 pb-6">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0 group">
            <div className="absolute inset-0 bg-white/20 rounded-xl blur-lg opacity-0 group-hover:opacity-60 transition-opacity" />
            <div className="relative w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-lg">
              <Film className="w-5 h-5 text-black" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="animate-fade-in">
              <h1 className="text-lg font-display font-bold tracking-tight text-white">
                Apex<span className="text-white/60"> Studio</span>
              </h1>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {/* Projects Link */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isOnProjects} tooltip="Projects">
                  <NavLink 
                    to="/projects" 
                    className={cn(
                      "relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group overflow-hidden",
                      isOnProjects && "bg-white/10",
                      !isOnProjects && "hover:bg-white/5"
                    )}
                    activeClassName=""
                  >
                    {isOnProjects && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
                    )}
                    <div className={cn(
                      "relative flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-300",
                      isOnProjects && "bg-white shadow-lg shadow-white/20",
                      !isOnProjects && "bg-white/5 group-hover:bg-white/10 group-hover:scale-105"
                    )}>
                      <Folder className={cn(
                        "w-5 h-5 transition-all",
                        isOnProjects ? "text-black" : "text-white/50 group-hover:text-white/80"
                      )} />
                    </div>
                    {!isCollapsed && (
                      <span className={cn(
                        "relative font-medium text-sm",
                        isOnProjects ? "text-white" : "text-white/50 group-hover:text-white/80"
                      )}>
                        Projects
                      </span>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* New Clip Button */}
              {!isCollapsed && (
                <SidebarMenuItem>
                  <Button
                    onClick={handleNewProject}
                    className="w-full justify-center gap-2 h-10 bg-white hover:bg-white/90 text-black border-0 rounded-xl transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="font-medium text-sm">New Clip</span>
                  </Button>
                </SidebarMenuItem>
              )}
              
              {/* Iron-Clad Pipeline Button */}
              {!isCollapsed && (
                <SidebarMenuItem>
                  <Button
                    onClick={handleNewPipeline}
                    variant="outline"
                    className="w-full justify-center gap-2 h-10 bg-transparent hover:bg-white/10 text-white/70 hover:text-white border-white/20 rounded-xl transition-all"
                  >
                    <Zap className="w-4 h-4" />
                    <span className="font-medium text-sm">Iron-Clad Pipeline</span>
                  </Button>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Workflow Steps */}
        {(isInWorkflow || activeProject) && (
          <SidebarGroup className="mt-8">
            {!isCollapsed && (
              <div className="px-1 mb-4">
                <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold p-0">
                  Workflow
                </SidebarGroupLabel>
              </div>
            )}
            <SidebarGroupContent>
              <div className="relative">
                {/* Connecting line */}
                {!isCollapsed && (
                  <div className="absolute left-[27px] top-6 bottom-6 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
                )}
                
                <div className="flex flex-col gap-2">
                  {WORKFLOW_STEPS.map((item, index) => {
                    const isActive = location.pathname === item.url;
                    const isPast = index < currentStepIndex;
                    const isFuture = index > currentStepIndex && currentStepIndex >= 0;
                    
                    return (
                      <SidebarMenuItem key={item.title} className="list-none">
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                          <NavLink 
                            to={item.url} 
                            className={cn(
                              "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group",
                              isActive && "bg-white/10",
                              !isActive && "hover:bg-white/5"
                            )}
                            activeClassName=""
                          >
                            {isActive && (
                              <div className="absolute inset-0 bg-gradient-to-r from-white/15 via-white/5 to-transparent rounded-xl" />
                            )}
                            
                            <div className={cn(
                              "relative z-10 flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-300",
                              isActive && "bg-white shadow-lg shadow-white/20",
                              isPast && "bg-white/20 ring-2 ring-white/30",
                              !isActive && !isPast && "bg-white/5 group-hover:bg-white/10"
                            )}>
                              {isPast ? (
                                <Check className="w-4 h-4 text-white" strokeWidth={3} />
                              ) : (
                                <item.icon className={cn(
                                  "w-4 h-4 transition-all",
                                  isActive && "text-black",
                                  !isActive && !isPast && "text-white/40 group-hover:text-white/70"
                                )} />
                              )}
                            </div>
                            
                            {!isCollapsed && (
                              <div className="relative z-10 flex-1 min-w-0">
                                <span className={cn(
                                  "font-medium text-sm block",
                                  isActive && "text-white",
                                  isPast && "text-white/70",
                                  !isActive && !isPast && "text-white/40 group-hover:text-white/70"
                                )}>
                                  {item.title}
                                </span>
                              </div>
                            )}
                            
                            {!isCollapsed && isActive && (
                              <div className="relative z-10 w-2 h-2 rounded-full bg-white animate-pulse" />
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Iron-Clad Pipeline Steps */}
        {isInPipeline && (
          <SidebarGroup className="mt-8">
            {!isCollapsed && (
              <div className="px-1 mb-4">
                <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold p-0">
                  Iron-Clad Pipeline
                </SidebarGroupLabel>
              </div>
            )}
            <SidebarGroupContent>
              <div className="relative">
                {!isCollapsed && (
                  <div className="absolute left-[27px] top-6 bottom-6 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
                )}
                <div className="flex flex-col gap-2">
                  {PIPELINE_STEPS.map((item, index) => {
                    const isActive = location.pathname === item.url;
                    const isPast = index < currentPipelineIndex;
                    return (
                      <SidebarMenuItem key={item.title} className="list-none">
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                          <NavLink 
                            to={item.url} 
                            className={cn(
                              "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group",
                              isActive && "bg-white/10",
                              !isActive && "hover:bg-white/5"
                            )}
                            activeClassName=""
                          >
                            {isActive && (
                              <div className="absolute inset-0 bg-gradient-to-r from-white/15 via-white/5 to-transparent rounded-xl" />
                            )}
                            <div className={cn(
                              "relative z-10 flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-300",
                              isActive && "bg-white shadow-lg shadow-white/20",
                              isPast && "bg-white/20 ring-2 ring-white/30",
                              !isActive && !isPast && "bg-white/5 group-hover:bg-white/10"
                            )}>
                              {isPast ? (
                                <Check className="w-4 h-4 text-white" strokeWidth={3} />
                              ) : (
                                <item.icon className={cn(
                                  "w-4 h-4 transition-all",
                                  isActive && "text-black",
                                  !isActive && !isPast && "text-white/40 group-hover:text-white/70"
                                )} />
                              )}
                            </div>
                            {!isCollapsed && (
                              <span className={cn(
                                "font-medium text-sm",
                                isActive && "text-white",
                                isPast && "text-white/70",
                                !isActive && !isPast && "text-white/40 group-hover:text-white/70"
                              )}>
                                {item.title}
                              </span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isCollapsed && activeProject && (
          <div className="mt-8 animate-fade-in">
            <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  activeProject.status === 'completed' && "bg-white shadow-lg shadow-white/50",
                  activeProject.status === 'generating' && "bg-white/70 animate-pulse shadow-lg shadow-white/30",
                  activeProject.status === 'rendering' && "bg-white/60 animate-pulse shadow-lg shadow-white/20",
                  activeProject.status === 'idle' && "bg-white/30"
                )} />
                <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold">
                  Current
                </span>
              </div>
              <p className="text-sm font-semibold text-white truncate mb-2">
                {activeProject.name}
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-[11px] text-white/50 capitalize">
                <Zap className="w-3 h-3" />
                {activeProject.status}
              </div>
            </div>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 mt-auto">
        {!isCollapsed && (
          <div className="animate-fade-in">
            <CreditsDisplay 
              credits={credits} 
              onBuyCredits={buyCredits} 
              selectedDurationSeconds={selectedDurationSeconds}
            />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleProfile = () => {
    navigate('/profile');
  };

  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name.slice(0, 2).toUpperCase();
    }
    if (profile?.email) {
      return profile.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  if (!user) {
    return (
      <Button 
        onClick={() => navigate('/auth')} 
        size="sm"
        className="h-8 gap-1.5 px-3 text-xs font-semibold rounded-lg bg-foreground hover:bg-foreground/90 text-background"
      >
        <User className="w-3.5 h-3.5" />
        Sign In
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-muted transition-colors">
          <Avatar className="h-7 w-7 ring-2 ring-border">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-foreground text-[10px] font-bold text-background">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <ChevronRight className="w-3 h-3 rotate-90 text-muted-foreground hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-2xl p-1.5">
        <div className="px-2 py-2 flex items-center gap-2.5 border-b border-border mb-1">
          <Avatar className="h-9 w-9 ring-2 ring-border">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-foreground text-xs font-bold text-background">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {profile?.display_name || 'Creator'}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
          </div>
        </div>

        {/* Credits display in menu */}
        <div className="px-2 py-2 mb-1 rounded-lg bg-muted border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-foreground" />
              <span className="text-sm font-medium text-foreground">Credits</span>
            </div>
            <span className="text-sm font-bold text-foreground">
              {profile?.credits_balance?.toLocaleString() || 0}
            </span>
          </div>
        </div>
        
        <DropdownMenuItem 
          onClick={handleProfile}
          className="gap-2.5 py-2 px-2 rounded-lg cursor-pointer text-foreground hover:bg-muted"
        >
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Profile & Credits</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 py-2 px-2 rounded-lg cursor-pointer text-foreground hover:bg-muted">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 py-2 px-2 rounded-lg cursor-pointer text-foreground hover:bg-muted">
          <Keyboard className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Shortcuts</span>
          <kbd className="ml-auto text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">?</kbd>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-border my-1" />
        
        <DropdownMenuItem className="gap-2.5 py-2 px-2 rounded-lg cursor-pointer text-foreground hover:bg-muted">
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Help & Support</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-border my-1" />
        
        <DropdownMenuItem 
          onClick={handleSignOut}
          className="gap-2.5 py-2 px-2 rounded-lg cursor-pointer text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StudioHeader() {
  const { activeProject, credits, isGenerating, generationProgress } = useStudio();
  const navigate = useNavigate();
  const location = useLocation();

  const currentStepIndex = WORKFLOW_STEPS.findIndex(step => location.pathname === step.url);

  return (
    <header className="h-12 px-4 flex items-center justify-between bg-background/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50">
      {/* Left Section - Sidebar trigger + Breadcrumb */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <SidebarTrigger className="hover:bg-muted rounded-lg h-8 w-8 text-muted-foreground hover:text-foreground transition-colors" />
        
        {/* Breadcrumb navigation */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <button 
            onClick={() => navigate('/projects')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Projects
          </button>
          {activeProject && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="text-foreground font-medium truncate max-w-[160px]">
                {activeProject.name}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Center Section - Workflow Steps */}
      <div className="flex-1 flex justify-center min-w-0 px-4">
        <div className="hidden sm:flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/50">
          {WORKFLOW_STEPS.map((step, index) => {
            const isActive = location.pathname === step.url;
            const isPast = index < currentStepIndex;
            const isClickable = activeProject || index === 0;
            
            return (
              <button
                key={step.title}
                onClick={() => isClickable && navigate(step.url)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                  isActive && "bg-foreground text-background shadow-sm",
                  !isActive && isPast && "text-foreground/70 hover:bg-muted",
                  !isActive && !isPast && "text-muted-foreground",
                  isClickable && !isActive && "hover:text-foreground cursor-pointer",
                  !isClickable && "opacity-50 cursor-not-allowed"
                )}
              >
                {isPast && !isActive ? (
                  <Check className="w-3 h-3 text-foreground" />
                ) : (
                  <step.icon className="w-3 h-3" />
                )}
                <span className="hidden lg:inline">{step.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Generation Progress */}
        {isGenerating && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground/10 border border-foreground/20">
            <div className="w-2 h-2 rounded-full bg-foreground animate-pulse" />
            <span className="text-xs font-medium text-foreground">{generationProgress.percent}%</span>
          </div>
        )}

        {/* Credits */}
        <button 
          onClick={() => navigate('/profile')}
          className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-muted border border-border hover:bg-muted/80 transition-colors"
        >
          <Coins className="w-3.5 h-3.5 text-foreground" />
          <span className="text-xs font-bold text-foreground">
            {credits.remaining.toLocaleString()}
          </span>
        </button>

        {/* User Menu */}
        <UserMenu />
      </div>
    </header>
  );
}

export function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        {/* Background gradients - fixed position */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] via-transparent to-foreground/[0.02]" />
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-foreground/[0.03] to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-foreground/[0.02] to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        </div>

        {/* Sidebar - uses SidebarInset pattern for proper spacing */}
        <StudioSidebar />

        {/* Main content area - flex-1 ensures it takes remaining space */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0 relative z-10">
          <StudioHeader />
          <main className="flex-1 overflow-auto relative">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
