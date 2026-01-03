import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Film, Folder, FileText, Play, Download, Bell, 
  ChevronRight, User, LogOut, CreditCard, Settings,
  Sparkles, Check, Plus, Home
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
  const { activeProject, exportVideo } = useStudio();
  const navigate = useNavigate();

  return (
    <header className="h-16 px-6 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="hover:bg-gray-100 rounded-lg h-9 w-9 text-gray-600" />
        
        {activeProject && (
          <div className="flex items-center gap-4 animate-fade-in">
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">{activeProject.name}</span>
              <span className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium capitalize",
                activeProject.status === 'idle' && "bg-gray-100 text-gray-600",
                activeProject.status === 'generating' && "bg-violet-100 text-violet-700",
                activeProject.status === 'rendering' && "bg-amber-100 text-amber-700",
                activeProject.status === 'completed' && "bg-emerald-100 text-emerald-700"
              )}>
                {activeProject.status}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-gray-900 hover:bg-gray-100">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-violet-500" />
        </Button>

        <Button
          onClick={() => navigate('/export')}
          disabled={activeProject?.status !== 'completed'}
          className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25 border-0"
        >
          <Sparkles className="w-4 h-4" />
          Export 4K
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-1">
              <Avatar className="h-9 w-9 ring-2 ring-gray-200 hover:ring-violet-300 transition-all">
                <AvatarImage src="" />
                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-semibold text-white">
                  JS
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white border-gray-200 shadow-xl p-2">
            <div className="px-3 py-3">
              <p className="text-sm font-semibold text-gray-900">John Smith</p>
              <p className="text-xs text-gray-500">john@example.com</p>
            </div>
            <DropdownMenuSeparator className="bg-gray-100" />
            <DropdownMenuItem className="gap-3 py-2.5 rounded-lg cursor-pointer text-gray-700 hover:text-gray-900 hover:bg-gray-50">
              <User className="w-4 h-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 py-2.5 rounded-lg cursor-pointer text-gray-700 hover:text-gray-900 hover:bg-gray-50">
              <CreditCard className="w-4 h-4" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 py-2.5 rounded-lg cursor-pointer text-gray-700 hover:text-gray-900 hover:bg-gray-50">
              <Settings className="w-4 h-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-100" />
            <DropdownMenuItem className="gap-3 py-2.5 rounded-lg cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50">
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
      <div className="min-h-screen flex w-full relative">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 via-transparent to-purple-50/30" />
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-violet-100/40 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-purple-100/30 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
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
