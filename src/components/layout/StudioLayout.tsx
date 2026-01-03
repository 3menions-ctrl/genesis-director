import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Film, Folder, FileText, Play, Download, Bell, 
  ChevronRight, User, LogOut, CreditCard, Settings,
  Sparkles, Check
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
    <Sidebar 
      collapsible="icon" 
      className="border-r-0"
      style={{ 
        background: 'linear-gradient(180deg, hsl(262 40% 12%) 0%, hsl(262 45% 8%) 100%)'
      }}
    >
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          {/* Logo */}
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
              <p className="text-xs text-violet-300/60 mt-0.5">AI Video Creator</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
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
                          "relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group",
                          isActive && "bg-gradient-to-r from-violet-500/20 to-purple-500/10 border border-violet-500/30",
                          !isActive && "hover:bg-white/5"
                        )}
                        activeClassName=""
                      >
                        {/* Icon */}
                        <div className={cn(
                          "flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-all duration-200",
                          isActive && "bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25",
                          isPast && "bg-emerald-500/20 border border-emerald-500/30",
                          isFuture && "bg-white/5 group-hover:bg-white/10"
                        )}>
                          <item.icon className={cn(
                            "w-4 h-4 transition-all",
                            isActive && "text-white",
                            isPast && "text-emerald-400",
                            isFuture && "text-violet-300/60 group-hover:text-violet-200"
                          )} />
                          
                          {isPast && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        
                        {/* Label */}
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            "font-medium text-sm block",
                            isActive && "text-white",
                            isPast && "text-violet-200",
                            isFuture && "text-violet-300/60 group-hover:text-violet-200"
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
                <div className="status-dot status-generating mt-1.5" />
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
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-gray-900 hover:bg-gray-100">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-violet-500" />
        </Button>

        {/* Export Button */}
        <Button
          onClick={exportVideo}
          disabled={activeProject?.status !== 'completed'}
          className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25 border-0"
        >
          <Sparkles className="w-4 h-4" />
          Export 4K
        </Button>

        {/* User Menu */}
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
        {/* Subtle background pattern */}
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
