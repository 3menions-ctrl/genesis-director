import { memo, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  MessageSquare, 
  Users, 
  DollarSign, 
  Calculator, 
  FolderKanban, 
  Activity, 
  AlertTriangle, 
  History, 
  Coins, 
  Shield, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Film,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  messageCount?: number;
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: BarChart3, group: 'main' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, group: 'main', badge: true },
  { id: 'users', label: 'Users', icon: Users, group: 'main' },
  { id: 'gallery', label: 'Gallery', icon: Film, group: 'main' },
  { id: 'financials', label: 'Financials', icon: DollarSign, group: 'finance' },
  { id: 'costs', label: 'Cost Analysis', icon: Calculator, group: 'finance' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, group: 'production' },
  { id: 'pipeline', label: 'Pipeline', icon: Activity, group: 'production' },
  { id: 'failed', label: 'Failed Clips', icon: AlertTriangle, group: 'production' },
  { id: 'audit', label: 'Audit Log', icon: History, group: 'system' },
  { id: 'packages', label: 'Packages', icon: Coins, group: 'system' },
  { id: 'moderation', label: 'Moderation', icon: Shield, group: 'system' },
  { id: 'avatars', label: 'Avatar Gen', icon: Sparkles, group: 'system' },
  { id: 'config', label: 'Config', icon: Settings, group: 'system' },
];

const groups = [
  { id: 'main', label: 'Main' },
  { id: 'finance', label: 'Finance' },
  { id: 'production', label: 'Production' },
  { id: 'system', label: 'System' },
];

export const AdminSidebar = memo(forwardRef<HTMLElement, AdminSidebarProps>(function AdminSidebar({ activeTab, onTabChange, messageCount = 0 }, ref) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        ref={ref}
        className={cn(
          "fixed left-0 top-16 bottom-0 z-40 flex flex-col border-r transition-all duration-300",
          "bg-sidebar border-sidebar-border",
          expanded ? "w-52" : "w-16"
        )}
      >
        {/* Toggle */}
        <div className="flex justify-end p-2.5 border-b border-sidebar-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronLeft className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
          {groups.map((group) => {
            const groupItems = navItems.filter(item => item.group === group.id);
            return (
              <div key={group.id} className="space-y-0.5">
                {expanded && (
                  <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/30">
                    {group.label}
                  </p>
                )}
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const showBadge = item.badge && messageCount > 0;

                  const button = (
                    <button
                      key={item.id}
                      className={cn(
                        "relative flex items-center w-full rounded-lg transition-all duration-200",
                        expanded ? "gap-2.5 px-3 py-2 text-sm" : "justify-center p-2.5",
                        isActive 
                          ? "bg-sidebar-primary/10 text-sidebar-primary" 
                          : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                      onClick={() => onTabChange(item.id)}
                    >
                      <Icon className={cn("shrink-0", expanded ? "h-4 w-4" : "h-[18px] w-[18px]")} />
                      {expanded && (
                        <span className="truncate font-medium">{item.label}</span>
                      )}
                      {showBadge && (
                        <span className={cn(
                          "absolute flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full",
                          expanded ? "right-2" : "-top-1 -right-1"
                        )}>
                          {messageCount > 99 ? '99+' : messageCount}
                        </span>
                      )}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-sidebar-primary" />
                      )}
                    </button>
                  );

                  if (expanded) {
                    return <div key={item.id}>{button}</div>;
                  }

                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        {button}
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={12} className="text-xs">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}));
