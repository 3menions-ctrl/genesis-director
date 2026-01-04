import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Film, Folder, FileText, Play, Download, Bell, 
  ChevronRight, User, LogOut, CreditCard, Settings,
  Sparkles, Check, Plus, Home, Search, Command,
  Zap, Share2, HelpCircle, Keyboard, Wand2, Video, Music,
  Mic, Image, Coins
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
  const { credits, buyCredits, activeProject, createProject, selectedDurationSeconds } = useStudio();
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
      className="border-r border-white/10"
      style={{ 
        background: 'linear-gradient(180deg, #0f0f0f 0%, #080808 50%, #0a0a0a 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5), 4px 0 24px rgba(0,0,0,0.3)'
      }}
    >
      <SidebarHeader className="p-4 pb-6">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0 group">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
              <Film className="w-5 h-5 text-white" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="animate-fade-in">
              <h1 className="text-lg font-display font-bold tracking-tight text-white">
                Apex<span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent"> Studio</span>
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
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/10 to-transparent" />
                    )}
                    <div className={cn(
                      "relative flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-300",
                      isOnProjects && "bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30",
                      !isOnProjects && "bg-white/5 group-hover:bg-white/10 group-hover:scale-105"
                    )}>
                      <Folder className={cn(
                        "w-5 h-5 transition-all",
                        isOnProjects ? "text-white" : "text-white/50 group-hover:text-white/80"
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

              {/* New Project Button */}
              {!isCollapsed && (
                <SidebarMenuItem>
                  <Button
                    onClick={handleNewProject}
                    className="w-full justify-start gap-3 px-3 py-3 h-auto bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0 rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all duration-300 hover:scale-[1.02]"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="font-semibold text-sm">New Movie</span>
                    <Sparkles className="w-4 h-4 ml-auto animate-pulse" />
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
                              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-cyan-500/10 to-transparent rounded-xl" />
                            )}
                            
                            <div className={cn(
                              "relative z-10 flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-300",
                              isActive && "bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/30",
                              isPast && "bg-emerald-500/20 ring-2 ring-emerald-500/50",
                              !isActive && !isPast && "bg-white/5 group-hover:bg-white/10"
                            )}>
                              {isPast ? (
                                <Check className="w-4 h-4 text-emerald-400" strokeWidth={3} />
                              ) : (
                                <item.icon className={cn(
                                  "w-4 h-4 transition-all",
                                  isActive && "text-white",
                                  !isActive && !isPast && "text-white/40 group-hover:text-white/70"
                                )} />
                              )}
                            </div>
                            
                            {!isCollapsed && (
                              <div className="relative z-10 flex-1 min-w-0">
                                <span className={cn(
                                  "font-medium text-sm block",
                                  isActive && "text-white",
                                  isPast && "text-emerald-400",
                                  !isActive && !isPast && "text-white/40 group-hover:text-white/70"
                                )}>
                                  {item.title}
                                </span>
                              </div>
                            )}
                            
                            {!isCollapsed && isActive && (
                              <div className="relative z-10 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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

        {/* Active Project Card */}
        {!isCollapsed && activeProject && (
          <div className="mt-8 animate-fade-in">
            <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  activeProject.status === 'completed' && "bg-emerald-400 shadow-lg shadow-emerald-500/50",
                  activeProject.status === 'generating' && "bg-amber-400 animate-pulse shadow-lg shadow-amber-500/50",
                  activeProject.status === 'rendering' && "bg-blue-400 animate-pulse shadow-lg shadow-blue-500/50",
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
        className="h-8 gap-1.5 px-3 text-xs font-semibold rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
      >
        <User className="w-3.5 h-3.5" />
        Sign In
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Avatar className="h-7 w-7 ring-2 ring-gray-200">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-[10px] font-bold text-white">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <ChevronRight className="w-3 h-3 rotate-90 text-gray-400 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-white border-gray-200 shadow-2xl p-1.5">
        <div className="px-2 py-2 flex items-center gap-2.5 border-b border-gray-100 mb-1">
          <Avatar className="h-9 w-9 ring-2 ring-gray-100">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {profile?.display_name || 'Creator'}
            </p>
            <p className="text-[11px] text-gray-500 truncate">{profile?.email}</p>
          </div>
        </div>

        {/* Credits display in menu */}
        <div className="px-2 py-2 mb-1 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700">Credits</span>
            </div>
            <span className="text-sm font-bold text-amber-700">
              {profile?.credits_balance?.toLocaleString() || 0}
            </span>
          </div>
        </div>
        
        <DropdownMenuItem 
          onClick={handleProfile}
          className="gap-2.5 py-2 px-2 rounded-lg cursor-pointer text-gray-700 hover:text-gray-900 hover:bg-gray-50"
        >
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-sm">Profile & Credits</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 py-2 px-2 rounded-lg cursor-pointer text-gray-700 hover:text-gray-900 hover:bg-gray-50">
          <Settings className="w-4 h-4 text-gray-400" />
          <span className="text-sm">Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 py-2 px-2 rounded-lg cursor-pointer text-gray-700 hover:text-gray-900 hover:bg-gray-50">
          <Keyboard className="w-4 h-4 text-gray-400" />
          <span className="text-sm">Shortcuts</span>
          <kbd className="ml-auto text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">?</kbd>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-gray-100 my-1" />
        
        <DropdownMenuItem className="gap-2.5 py-2 px-2 rounded-lg cursor-pointer text-gray-700 hover:text-gray-900 hover:bg-gray-50">
          <HelpCircle className="w-4 h-4 text-gray-400" />
          <span className="text-sm">Help & Support</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-gray-100 my-1" />
        
        <DropdownMenuItem 
          onClick={handleSignOut}
          className="gap-2.5 py-2 px-2 rounded-lg cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
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

  // Get current step info
  const currentStep = WORKFLOW_STEPS.find(step => location.pathname === step.url);
  const currentStepIndex = WORKFLOW_STEPS.findIndex(step => location.pathname === step.url);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed': 
        return { color: 'bg-emerald-500', ring: 'ring-emerald-500/20', text: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'generating': 
        return { color: 'bg-violet-500 animate-pulse', ring: 'ring-violet-500/20', text: 'text-violet-600', bg: 'bg-violet-50' };
      case 'rendering': 
        return { color: 'bg-amber-500 animate-pulse', ring: 'ring-amber-500/20', text: 'text-amber-600', bg: 'bg-amber-50' };
      default: 
        return { color: 'bg-gray-400', ring: 'ring-gray-400/20', text: 'text-gray-600', bg: 'bg-gray-50' };
    }
  };

  const statusConfig = activeProject ? getStatusConfig(activeProject.status) : null;

  return (
    <TooltipProvider delayDuration={200}>
      <header 
        className="h-14 px-3 flex items-center justify-between bg-white/95 backdrop-blur-xl border-b border-gray-200/80 sticky top-0 z-50"
        style={{ fontFamily: "'Instrument Sans', sans-serif" }}
      >
        {/* Left Section */}
        <div className="flex items-center gap-2">
          <SidebarTrigger className="hover:bg-gray-100 rounded-lg h-8 w-8 text-gray-500 hover:text-gray-700 transition-all" />
          
          <div className="hidden md:flex items-center">
            {/* Workflow Steps as Pills */}
            <div className="flex items-center bg-gray-100/80 rounded-lg p-0.5 ml-2">
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
                      "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      isActive && "bg-white text-gray-900 shadow-sm",
                      !isActive && isPast && "text-gray-600 hover:text-gray-900",
                      !isActive && !isPast && "text-gray-400",
                      isClickable && !isActive && "hover:text-gray-700"
                    )}
                  >
                    {isPast && !isActive ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <step.icon className={cn("w-3 h-3", isActive ? "text-violet-600" : "")} />
                    )}
                    <span className="hidden lg:inline">{step.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Section - Project Info */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
          {activeProject ? (
            <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-gray-50/80 border border-gray-200/60">
              <div className={cn("w-2 h-2 rounded-full ring-4", statusConfig?.color, statusConfig?.ring)} />
              <span className="text-sm font-semibold text-gray-900 max-w-[180px] truncate">
                {activeProject.name}
              </span>
              {isGenerating && (
                <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${generationProgress.percent}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-gray-500">{generationProgress.percent}%</span>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={() => navigate('/create')}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200/60 hover:border-violet-300 transition-colors group"
            >
              <Plus className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-sm font-medium text-violet-700 group-hover:text-violet-800">New Project</span>
            </button>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1.5">
          {/* Search */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all group">
                <Search className="w-4 h-4" />
                <span className="text-xs text-gray-400 group-hover:text-gray-500">Search</span>
                <kbd className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 group-hover:bg-gray-200 text-[10px] font-mono text-gray-400 transition-colors">
                  ⌘K
                </kbd>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-gray-900 text-white border-0">
              Command palette
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-gray-200 mx-1 hidden lg:block" />

          {/* AI Generate Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <Wand2 className="w-4 h-4" />
                <span className="hidden xl:inline text-xs font-medium">AI Tools</span>
                <ChevronRight className="w-3 h-3 rotate-90 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-white border-gray-200 shadow-xl p-1.5">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-2 py-1">
                Generate with AI
              </DropdownMenuLabel>
              {QUICK_ACTIONS.map((action) => (
                <DropdownMenuItem 
                  key={action.id} 
                  className="gap-2.5 py-2 px-2 rounded-lg cursor-pointer text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                >
                  <div className={cn("p-1.5 rounded-md bg-gradient-to-br", action.color)}>
                    <action.icon className="w-3 h-3 text-white" />
                  </div>
                  <span className="flex-1 text-sm">{action.label}</span>
                  <kbd className="text-[10px] font-mono text-gray-400">{action.shortcut}</kbd>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Credits */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 hover:border-amber-300 transition-colors">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-bold text-amber-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {(credits.remaining / 1000).toFixed(1)}k
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-gray-900 text-white border-0">
              {credits.remaining.toLocaleString()} credits remaining
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Notifications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-violet-500 ring-2 ring-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-gray-900 text-white border-0">
              Notifications
            </TooltipContent>
          </Tooltip>

          {/* Share */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100">
                <Share2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-gray-900 text-white border-0">
              Share
            </TooltipContent>
          </Tooltip>

          {/* Export */}
          <Button
            onClick={() => navigate('/export')}
            disabled={activeProject?.status !== 'completed'}
            size="sm"
            className={cn(
              "h-8 gap-1.5 px-3 text-xs font-semibold rounded-lg transition-all",
              activeProject?.status === 'completed'
                ? "bg-gray-900 hover:bg-gray-800 text-white"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* User Menu */}
          <UserMenu />
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
