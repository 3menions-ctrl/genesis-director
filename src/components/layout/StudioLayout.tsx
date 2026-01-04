import { ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Film, Folder, FileText, Play, Download, Bell, 
  ChevronRight, User, LogOut, CreditCard, Settings,
  Sparkles, Check, Plus, Home, Search, Command,
  Zap, Clock, Share2, HelpCircle, Keyboard, 
  LayoutGrid, Moon, Sun, Wand2, Video, Music,
  Mic, Image, Palette, MoreHorizontal
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

// Quick actions for header
const QUICK_ACTIONS = [
  { id: 'generate-video', label: 'Generate Video', icon: Video, shortcut: '⌘G', color: 'from-violet-500 to-purple-500' },
  { id: 'generate-voice', label: 'AI Voice', icon: Mic, shortcut: '⌘V', color: 'from-blue-500 to-cyan-500' },
  { id: 'generate-music', label: 'AI Music', icon: Music, shortcut: '⌘M', color: 'from-pink-500 to-rose-500' },
  { id: 'generate-image', label: 'AI Image', icon: Image, shortcut: '⌘I', color: 'from-amber-500 to-orange-500' },
];

function StudioSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { credits, buyCredits, activeProject, createProject } = useStudio();
  const isCollapsed = state === 'collapsed';

  // Check if we're in a project workflow
  const isInWorkflow = WORKFLOW_STEPS.some(item => location.pathname === item.url);
  const isOnProjects = location.pathname === '/projects' || location.pathname === '/';
  
  const currentStepIndex = WORKFLOW_STEPS.findIndex(item => location.pathname === item.url);

  const handleNewProject = () => {
    createProject();
    navigate('/create');
  };

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r-0"
      style={{ 
        background: 'linear-gradient(180deg, hsl(262 40% 12%) 0%, hsl(262 45% 8%) 100%)'
      }}
    >
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="icon-box p-2.5">
              <Film className="w-5 h-5 text-white" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="animate-fade-in">
              <h1 className="text-xl font-display font-bold tracking-tight text-white">
                Apex<span className="text-violet-400"> Studio</span>
              </h1>
              <p className="text-xs text-violet-300/60 mt-0.5">AI Movie Creator</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {/* Projects Link */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isOnProjects} tooltip="Projects">
                  <NavLink 
                    to="/projects" 
                    className={cn(
                      "relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group",
                      isOnProjects && "bg-gradient-to-r from-violet-500/20 to-purple-500/10 border border-violet-500/30",
                      !isOnProjects && "hover:bg-white/5"
                    )}
                    activeClassName=""
                  >
                    <div className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-all duration-200",
                      isOnProjects && "bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25",
                      !isOnProjects && "bg-white/5 group-hover:bg-white/10"
                    )}>
                      <Folder className={cn(
                        "w-4 h-4 transition-all",
                        isOnProjects ? "text-white" : "text-violet-300/60 group-hover:text-violet-200"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn(
                        "font-medium text-sm block",
                        isOnProjects ? "text-white" : "text-violet-300/60 group-hover:text-violet-200"
                      )}>
                        Projects
                      </span>
                      <span className="text-[11px] font-mono text-violet-400/40">
                        Library
                      </span>
                    </div>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* New Project Button */}
              {!isCollapsed && (
                <SidebarMenuItem>
                  <Button
                    onClick={handleNewProject}
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 py-3 h-auto text-violet-300/60 hover:text-white hover:bg-white/5"
                  >
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-dashed border-violet-500/30">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-sm">New Movie</span>
                  </Button>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Workflow Steps - Only show when in workflow or have active project */}
        {(isInWorkflow || activeProject) && (
          <SidebarGroup className="mt-6">
            {!isCollapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-violet-400/50 font-semibold px-3 mb-2">
                Workflow
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {WORKFLOW_STEPS.map((item, index) => {
                  const isActive = location.pathname === item.url;
                  const isPast = index < currentStepIndex;
                  const isFuture = index > currentStepIndex && currentStepIndex >= 0;
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <NavLink 
                          to={item.url} 
                          className={cn(
                            "relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group",
                            isActive && "bg-gradient-to-r from-violet-500/20 to-purple-500/10 border border-violet-500/30",
                            !isActive && "hover:bg-white/5"
                          )}
                          activeClassName=""
                        >
                          <div className={cn(
                            "relative flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-all duration-200",
                            isActive && "bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25",
                            isPast && "bg-emerald-500/20 border border-emerald-500/30",
                            isFuture && "bg-white/5 group-hover:bg-white/10",
                            !isActive && !isPast && !isFuture && "bg-white/5 group-hover:bg-white/10"
                          )}>
                            <item.icon className={cn(
                              "w-4 h-4 transition-all",
                              isActive && "text-white",
                              isPast && "text-emerald-400",
                              (isFuture || (!isActive && !isPast)) && "text-violet-300/60 group-hover:text-violet-200"
                            )} />
                            
                            {isPast && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <span className={cn(
                              "font-medium text-sm block",
                              isActive && "text-white",
                              isPast && "text-violet-200",
                              (isFuture || (!isActive && !isPast)) && "text-violet-300/60 group-hover:text-violet-200"
                            )}>
                              {item.title}
                            </span>
                            <span className={cn(
                              "text-[11px] font-mono",
                              isActive ? "text-violet-300" : "text-violet-400/40"
                            )}>
                              Step {item.step}
                            </span>
                          </div>
                          
                          <ChevronRight className={cn(
                            "w-4 h-4 opacity-0 -translate-x-1 transition-all duration-200",
                            "group-hover:opacity-100 group-hover:translate-x-0",
                            isActive ? "text-violet-300" : "text-violet-400/40"
                          )} />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Active Project Card */}
        {!isCollapsed && activeProject && (
          <div className="mt-8 animate-fade-in-up delay-2">
            <div className="px-1 mb-3">
              <span className="text-[10px] uppercase tracking-widest text-violet-400/50 font-semibold">
                Current Project
              </span>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "status-dot mt-1.5",
                  activeProject.status === 'completed' && "status-completed",
                  activeProject.status === 'generating' && "status-generating",
                  activeProject.status === 'rendering' && "status-generating",
                  activeProject.status === 'idle' && "status-idle"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {activeProject.name}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 capitalize">
                      {activeProject.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!isCollapsed && (
          <div className="animate-fade-in-up delay-3">
            <CreditsDisplay credits={credits} onBuyCredits={buyCredits} />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function StudioHeader() {
  const { activeProject, credits } = useStudio();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Get current step info for breadcrumbs
  const currentStep = WORKFLOW_STEPS.find(step => location.pathname === step.url);
  const currentStepIndex = WORKFLOW_STEPS.findIndex(step => location.pathname === step.url);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500';
      case 'generating': return 'bg-violet-500 animate-pulse';
      case 'rendering': return 'bg-amber-500 animate-pulse';
      default: return 'bg-gray-400';
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <header className="h-16 px-4 flex items-center justify-between bg-background/80 backdrop-blur-2xl border-b border-border/50 sticky top-0 z-50" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
        {/* Left Section - Sidebar Toggle + Breadcrumbs */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="hover:bg-muted rounded-xl h-10 w-10 text-muted-foreground hover:text-foreground transition-colors" />
          
          {/* Breadcrumbs */}
          <nav className="hidden md:flex items-center gap-1.5">
            <button 
              onClick={() => navigate('/projects')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Projects</span>
            </button>
            
            {activeProject && (
              <>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/30">
                  <div className={cn("w-2 h-2 rounded-full", getStatusColor(activeProject.status))} />
                  <span className="text-sm font-medium text-foreground max-w-[120px] truncate">
                    {activeProject.name}
                  </span>
                </div>
              </>
            )}
            
            {currentStep && (
              <>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                <div className="flex items-center gap-2 px-2.5 py-1.5">
                  <currentStep.icon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-medium text-foreground">{currentStep.title}</span>
                </div>
              </>
            )}
          </nav>
        </div>

        {/* Center Section - Command Search */}
        <div className="hidden lg:flex items-center">
          <button className="flex items-center gap-3 px-4 py-2 rounded-xl bg-muted/30 border border-border/50 hover:border-border hover:bg-muted/50 transition-all group min-w-[280px]">
            <Search className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-sm text-muted-foreground group-hover:text-muted-foreground/80 transition-colors flex-1 text-left">
              Search or run command...
            </span>
            <kbd className="hidden sm:flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-background border border-border text-[10px] font-mono text-muted-foreground">
              <Command className="w-3 h-3" />
              <span>K</span>
            </kbd>
          </button>
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-2">
          {/* Quick AI Actions */}
          <div className="hidden xl:flex items-center gap-1 mr-2">
            {QUICK_ACTIONS.slice(0, 3).map((action) => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  >
                    <action.icon className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="flex items-center gap-2 bg-popover border-border">
                  <span>{action.label}</span>
                  <kbd className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {action.shortcut}
                  </kbd>
                </TooltipContent>
              </Tooltip>
            ))}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover border-border shadow-xl">
                <DropdownMenuLabel className="text-xs text-muted-foreground">AI Tools</DropdownMenuLabel>
                {QUICK_ACTIONS.map((action) => (
                  <DropdownMenuItem key={action.id} className="gap-3 py-2.5 cursor-pointer">
                    <div className={cn("p-1.5 rounded-lg bg-gradient-to-br", action.color)}>
                      <action.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="flex-1">{action.label}</span>
                    <kbd className="text-[10px] font-mono text-muted-foreground">{action.shortcut}</kbd>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="w-px h-6 bg-border/50 hidden xl:block" />

          {/* Credits Indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-colors">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-semibold text-amber-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {credits.remaining.toLocaleString()}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-popover border-border">
              <span>Credits remaining</span>
            </TooltipContent>
          </Tooltip>

          {/* Notifications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50">
                <Bell className="w-[18px] h-[18px]" />
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 ring-2 ring-background" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-popover border-border">
              <span>Notifications</span>
            </TooltipContent>
          </Tooltip>

          {/* Help */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden sm:flex h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50">
                <HelpCircle className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-popover border-border">
              <span>Help & Support</span>
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-border/50 mx-1" />

          {/* Export Button */}
          <Button
            onClick={() => navigate('/export')}
            disabled={activeProject?.status !== 'completed'}
            className={cn(
              "gap-2 rounded-xl font-medium shadow-lg transition-all",
              activeProject?.status === 'completed'
                ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-violet-500/25"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          {/* Share */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 rounded-xl border-border/50 hover:border-border hover:bg-muted/50"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-popover border-border">
              <span>Share project</span>
            </TooltipContent>
          </Tooltip>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-1 h-10 w-10 rounded-xl hover:bg-transparent">
                <Avatar className="h-9 w-9 ring-2 ring-border/50 hover:ring-primary/50 transition-all">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-semibold text-white">
                    JS
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-popover border-border shadow-2xl p-2">
              <div className="px-3 py-3 flex items-center gap-3">
                <Avatar className="h-11 w-11 ring-2 ring-border/50">
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-base font-semibold text-white">
                    JS
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">John Smith</p>
                  <p className="text-xs text-muted-foreground">john@example.com</p>
                </div>
              </div>
              
              <div className="px-3 py-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-foreground">{credits.remaining.toLocaleString()} Credits</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10">
                    Buy More
                  </Button>
                </div>
              </div>
              
              <DropdownMenuSeparator className="bg-border/50 my-2" />
              
              <DropdownMenuGroup>
                <DropdownMenuItem className="gap-3 py-2.5 rounded-xl cursor-pointer text-foreground hover:bg-muted/50">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 py-2.5 rounded-xl cursor-pointer text-foreground hover:bg-muted/50">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  Billing
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 py-2.5 rounded-xl cursor-pointer text-foreground hover:bg-muted/50">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 py-2.5 rounded-xl cursor-pointer text-foreground hover:bg-muted/50">
                  <Keyboard className="w-4 h-4 text-muted-foreground" />
                  Keyboard Shortcuts
                  <kbd className="ml-auto text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">?</kbd>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              
              <DropdownMenuSeparator className="bg-border/50 my-2" />
              
              <DropdownMenuItem 
                className="gap-3 py-2.5 rounded-xl cursor-pointer justify-between text-foreground hover:bg-muted/50"
                onClick={() => setIsDarkMode(!isDarkMode)}
              >
                <div className="flex items-center gap-3">
                  {isDarkMode ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
                  <span>Dark Mode</span>
                </div>
                <div className={cn(
                  "w-8 h-5 rounded-full transition-colors flex items-center px-0.5",
                  isDarkMode ? "bg-primary justify-end" : "bg-muted justify-start"
                )}>
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="bg-border/50 my-2" />
              
              <DropdownMenuItem className="gap-3 py-2.5 rounded-xl cursor-pointer text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                <LogOut className="w-4 h-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  );
}

export function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        {/* Background gradients - fixed position */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 via-transparent to-purple-50/30" />
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-violet-100/40 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-purple-100/30 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
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
