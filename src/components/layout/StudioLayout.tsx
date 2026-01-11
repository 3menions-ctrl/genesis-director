import { ReactNode, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Folder, FileText, Play,
  ChevronRight, User, LogOut, Settings,
  Check, Zap, HelpCircle, Keyboard, Coins,
  Home, Activity, TrendingUp, Video,
  LayoutTemplate, Clock, Plus, Sparkles
} from 'lucide-react';

import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
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
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Main navigation - simplified
const MAIN_NAV = [
  { title: 'Projects', url: '/projects', icon: Folder },
  { title: 'Templates', url: '/templates', icon: LayoutTemplate },
];

// Iron-Clad Pipeline workflow steps (primary workflow)
const PIPELINE_STEPS = [
  { title: 'Scripting', url: '/pipeline/scripting', icon: FileText, step: 1 },
  { title: 'Production', url: '/pipeline/production', icon: Zap, step: 2 },
  { title: 'Review', url: '/pipeline/review', icon: Play, step: 3 },
];

// Quick templates for new project creation
const QUICK_TEMPLATES = [
  { id: 'cinematic', name: 'Cinematic', icon: '🎬' },
  { id: 'commercial', name: 'Commercial', icon: '📺' },
  { id: 'explainer', name: 'Explainer', icon: '💡' },
];

interface RecentProject {
  id: string;
  title: string;
  status: string;
  updated_at: string;
}

function StudioSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { credits, activeProject, createProject } = useStudio();
  const { user } = useAuth();
  const isCollapsed = state === 'collapsed';
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // Fetch recent projects - wait for valid session
  useEffect(() => {
    const fetchRecent = async () => {
      if (!user) return;
      
      // CRITICAL: Verify Supabase client has valid session before querying
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('StudioLayout: No valid session yet, skipping fetch');
        return;
      }
      
      const { data, error } = await supabase
        .from('movie_projects')
        .select('id, title, status, updated_at')
        .eq('user_id', session.user.id) // Use session user ID, not React state
        .order('updated_at', { ascending: false })
        .limit(3);
      
      if (error) {
        console.error('Error fetching recent projects:', error);
        return;
      }
      if (data) setRecentProjects(data);
    };
    fetchRecent();
  }, [user]);

  // Check if we're in the pipeline workflow
  const isInPipeline = PIPELINE_STEPS.some(item => location.pathname === item.url);
  const currentPipelineIndex = PIPELINE_STEPS.findIndex(item => location.pathname === item.url);

  const handleNewProject = () => {
    createProject();
    navigate('/create');
  };

  const handleQuickTemplate = (templateId: string) => {
    navigate(`/create?template=${templateId}`);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500';
      case 'generating': case 'rendering': return 'bg-amber-500 animate-pulse';
      case 'failed': return 'bg-red-500';
      default: return 'bg-white/30';
    }
  };

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-white/[0.06]"
      style={{ 
        background: 'linear-gradient(180deg, #09090b 0%, #0a0a0a 100%)',
      }}
    >
      <SidebarHeader className={cn("p-3", isCollapsed ? "px-2" : "px-4")}>
        <div className="flex items-center gap-2.5">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => navigate('/projects')}
                  className="relative shrink-0 group"
                >
                  <div className="absolute inset-0 bg-white/20 rounded-lg blur-md opacity-0 group-hover:opacity-40 transition-opacity" />
                  <div className="relative w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-lg shadow-white/10">
                    <span className="text-base font-bold text-black">AS</span>
                  </div>
                </button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" className="bg-zinc-900 border-white/10 text-white">
                  Apex Studio
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {!isCollapsed && (
            <span className="text-sm font-semibold text-white tracking-tight">
              Apex Studio
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className={cn("px-2", isCollapsed ? "px-1.5" : "px-3")}>
        {/* New Project Button */}
        <SidebarGroup className="mb-1">
          <SidebarGroupContent>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleNewProject}
                    className={cn(
                      "w-full gap-2 bg-white hover:bg-white/90 text-black border-0 font-medium shadow-lg shadow-white/5 transition-all",
                      isCollapsed ? "h-9 w-9 p-0" : "h-9 justify-start px-3"
                    )}
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span className="text-sm">New Project</span>}
                  </Button>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right" className="bg-zinc-900 border-white/10 text-white">
                    New Project
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {MAIN_NAV.map((navItem) => {
                const isActive = location.pathname === navItem.url || 
                  (navItem.url === '/projects' && location.pathname === '/');
                return (
                  <SidebarMenuItem key={navItem.url}>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton asChild isActive={isActive}>
                            <NavLink 
                              to={navItem.url} 
                              className={cn(
                                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all group",
                                isActive && "bg-white/[0.08]",
                                !isActive && "hover:bg-white/[0.04]",
                                isCollapsed && "justify-center px-0"
                              )}
                              activeClassName=""
                            >
                              <div className={cn(
                                "flex items-center justify-center w-7 h-7 rounded-md shrink-0 transition-all",
                                isActive && "bg-white/10",
                                !isActive && "group-hover:bg-white/[0.06]"
                              )}>
                                <navItem.icon className={cn(
                                  "w-4 h-4 transition-colors",
                                  isActive ? "text-white" : "text-white/50 group-hover:text-white/70"
                                )} />
                              </div>
                              {!isCollapsed && (
                                <span className={cn(
                                  "text-sm font-medium",
                                  isActive ? "text-white" : "text-white/50 group-hover:text-white/70"
                                )}>
                                  {navItem.title}
                                </span>
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right" className="bg-zinc-900 border-white/10 text-white">
                            {navItem.title}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Templates */}
        {!isCollapsed && (
          <SidebarGroup className="mt-4">
            <div className="px-2.5 mb-2">
              <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-semibold p-0 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Quick Start
              </SidebarGroupLabel>
            </div>
            <SidebarGroupContent>
              <div className="grid grid-cols-3 gap-1.5 px-1">
                {QUICK_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleQuickTemplate(template.id)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all group"
                  >
                    <span className="text-base">{template.icon}</span>
                    <span className="text-[10px] text-white/40 group-hover:text-white/60 font-medium">
                      {template.name}
                    </span>
                  </button>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Recent Projects */}
        {!isCollapsed && recentProjects.length > 0 && (
          <SidebarGroup className="mt-4">
            <div className="px-2.5 mb-2 flex items-center justify-between">
              <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-semibold p-0 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Recent
              </SidebarGroupLabel>
            </div>
            <SidebarGroupContent>
              <div className="space-y-0.5">
                {recentProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-all group text-left"
                  >
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      getStatusColor(project.status)
                    )} />
                    <span className="text-xs text-white/50 group-hover:text-white/70 truncate flex-1 font-medium">
                      {project.title}
                    </span>
                    <span className="text-[10px] text-white/30 shrink-0">
                      {formatTimeAgo(project.updated_at)}
                    </span>
                  </button>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Pipeline Steps - only show when in pipeline */}
        {isInPipeline && (
          <SidebarGroup className="mt-4">
            {!isCollapsed && (
              <div className="px-2.5 mb-2">
                <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-semibold p-0">
                  Pipeline
                </SidebarGroupLabel>
              </div>
            )}
            <SidebarGroupContent>
              <div className="space-y-0.5">
                {PIPELINE_STEPS.map((item, index) => {
                  const isActive = location.pathname === item.url;
                  const isPast = index < currentPipelineIndex;
                  return (
                    <SidebarMenuItem key={item.title} className="list-none">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton asChild isActive={isActive}>
                              <NavLink 
                                to={item.url} 
                                className={cn(
                                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all group",
                                  isActive && "bg-white/[0.08]",
                                  !isActive && "hover:bg-white/[0.04]",
                                  isCollapsed && "justify-center px-0"
                                )}
                                activeClassName=""
                              >
                                <div className={cn(
                                  "flex items-center justify-center w-7 h-7 rounded-md shrink-0 transition-all",
                                  isActive && "bg-white shadow-sm shadow-white/20",
                                  isPast && "bg-white/20",
                                  !isActive && !isPast && "group-hover:bg-white/[0.06]"
                                )}>
                                  {isPast ? (
                                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                                  ) : (
                                    <item.icon className={cn(
                                      "w-3.5 h-3.5 transition-colors",
                                      isActive && "text-black",
                                      !isActive && !isPast && "text-white/40 group-hover:text-white/60"
                                    )} />
                                  )}
                                </div>
                                {!isCollapsed && (
                                  <span className={cn(
                                    "text-sm font-medium",
                                    isActive && "text-white",
                                    isPast && "text-white/60",
                                    !isActive && !isPast && "text-white/40 group-hover:text-white/60"
                                  )}>
                                    {item.title}
                                  </span>
                                )}
                              </NavLink>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right" className="bg-zinc-900 border-white/10 text-white">
                              {item.title}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </SidebarMenuItem>
                  );
                })}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className={cn("p-3 mt-auto", isCollapsed ? "px-1.5" : "px-3")}>
        {!isCollapsed ? (
          <CreditsDisplay credits={credits} />
        ) : (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => navigate('/profile')}
                  className="w-full flex items-center justify-center p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-all"
                >
                  <Coins className="w-4 h-4 text-white/60" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-zinc-900 border-white/10 text-white">
                {credits.remaining.toLocaleString()} credits
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
        
        <DropdownMenuItem onClick={() => navigate('/help')} className="gap-2.5 py-2 px-2 rounded-lg cursor-pointer text-foreground hover:bg-muted">
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
  const { activeProject, credits } = useStudio();
  const navigate = useNavigate();
  const location = useLocation();

  const currentPipelineIndex = PIPELINE_STEPS.findIndex(step => location.pathname === step.url);
  
  // Determine page title based on route
  const getPageInfo = () => {
    if (location.pathname === '/create') return { title: 'Create', subtitle: 'AI Video Studio' };
    if (location.pathname === '/script-review') return { title: 'Script Review', subtitle: null };
    if (location.pathname === '/production') return { title: 'Production', subtitle: null };
    if (location.pathname === '/studio') return { title: 'Studio', subtitle: null };
    if (location.pathname === '/clips') return { title: 'Clips', subtitle: null };
    return { title: activeProject?.name || 'Project', subtitle: null };
  };
  
  const pageInfo = getPageInfo();

  return (
    <header className="h-12 px-4 flex items-center justify-between bg-background/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50">
      {/* Left Section - Sidebar trigger + Breadcrumb */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <SidebarTrigger className="hover:bg-muted rounded-lg h-8 w-8 text-muted-foreground hover:text-foreground transition-colors" />
        
        {/* Breadcrumb navigation */}
        <nav className="hidden md:flex items-center gap-2 text-sm">
          <button 
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <Folder className="w-4 h-4" />
            <span>Projects</span>
          </button>
          
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
          
          <div className="flex items-center gap-2">
            <span className="text-foreground font-medium truncate max-w-[200px]">
              {activeProject?.name || pageInfo.title}
            </span>
            {pageInfo.subtitle && (
              <span className="text-muted-foreground text-xs hidden lg:inline">
                {pageInfo.subtitle}
              </span>
            )}
          </div>
        </nav>
        
        {/* Mobile: Just show current page */}
        <div className="md:hidden flex items-center gap-2">
          <button 
            onClick={() => navigate('/projects')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Folder className="w-4 h-4" />
          </button>
          <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
          <span className="text-foreground font-medium text-sm truncate max-w-[120px]">
            {activeProject?.name || pageInfo.title}
          </span>
        </div>
      </div>

      {/* Center Section - Pipeline Steps */}
      <div className="flex-1 flex justify-center min-w-0 px-4">
        <div className="hidden sm:flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/50">
          {PIPELINE_STEPS.map((step, index) => {
            const isActive = location.pathname === step.url;
            const isPast = index < currentPipelineIndex;
            const isClickable = true;
            
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
          <main className="flex-1 overflow-auto relative">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
