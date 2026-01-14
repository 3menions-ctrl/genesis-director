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
  { id: 'financials', label: 'Financials', icon: DollarSign, group: 'finance' },
  { id: 'costs', label: 'Cost Analysis', icon: Calculator, group: 'finance' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, group: 'production' },
  { id: 'pipeline', label: 'Pipeline', icon: Activity, group: 'production' },
  { id: 'failed', label: 'Failed Clips', icon: AlertTriangle, group: 'production' },
  { id: 'audit', label: 'Audit Log', icon: History, group: 'system' },
  { id: 'packages', label: 'Packages', icon: Coins, group: 'system' },
  { id: 'moderation', label: 'Moderation', icon: Shield, group: 'system' },
  { id: 'config', label: 'Config', icon: Settings, group: 'system' },
];

const groups = [
  { id: 'main', label: 'Main' },
  { id: 'finance', label: 'Finance' },
  { id: 'production', label: 'Production' },
  { id: 'system', label: 'System' },
];

export function AdminSidebar({ activeTab, onTabChange, messageCount = 0 }: AdminSidebarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "fixed left-0 top-16 bottom-0 z-40 flex flex-col border-r border-border/50 bg-background/95 backdrop-blur-sm transition-all duration-300",
          expanded ? "w-48" : "w-16"
        )}
      >
        {/* Toggle Button */}
        <div className="flex justify-end p-2 border-b border-border/50">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
          {groups.map((group) => {
            const groupItems = navItems.filter(item => item.group === group.id);
            return (
              <div key={group.id} className="space-y-1">
                {expanded && (
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </p>
                )}
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const showBadge = item.badge && messageCount > 0;

                  const button = (
                    <Button
                      key={item.id}
                      variant={isActive ? "secondary" : "ghost"}
                      size={expanded ? "sm" : "icon"}
                      className={cn(
                        "relative transition-all",
                        expanded ? "w-full justify-start gap-2" : "w-10 h-10",
                        isActive && "bg-primary/10 text-primary hover:bg-primary/15"
                      )}
                      onClick={() => onTabChange(item.id)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {expanded && (
                        <span className="text-sm truncate">{item.label}</span>
                      )}
                      {showBadge && (
                        <span className={cn(
                          "absolute flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-semibold bg-destructive text-destructive-foreground rounded-full",
                          expanded ? "right-2" : "-top-1 -right-1"
                        )}>
                          {messageCount > 99 ? '99+' : messageCount}
                        </span>
                      )}
                    </Button>
                  );

                  if (expanded) {
                    return button;
                  }

                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        {button}
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        <p>{item.label}</p>
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
}
