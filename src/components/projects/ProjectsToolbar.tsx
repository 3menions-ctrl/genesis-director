import { motion } from 'framer-motion';
import { Plus, Search, Grid3X3, LayoutList, Wand2, Video, Palette, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProjectsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onNewProject: () => void;
  onStyleTransfer?: () => void;
  onAnimateImage?: () => void;
  onAIAvatar?: () => void;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ready', label: 'Ready' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
];

const CREATION_MODES = [
  { id: 'new', label: 'New Video', icon: Plus, primary: true },
  { id: 'style', label: 'Style Transfer', icon: Palette, badge: 'NEW' },
  { id: 'animate', label: 'Animate Image', icon: Image },
  { id: 'avatar', label: 'AI Avatar', icon: Video },
];

export function ProjectsToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  statusFilter,
  onStatusFilterChange,
  onNewProject,
  onStyleTransfer,
  onAnimateImage,
  onAIAvatar,
}: ProjectsToolbarProps) {
  const handleModeClick = (modeId: string) => {
    switch (modeId) {
      case 'new':
        onNewProject();
        break;
      case 'style':
        onStyleTransfer?.();
        break;
      case 'animate':
        onAnimateImage?.();
        break;
      case 'avatar':
        onAIAvatar?.();
        break;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="relative mb-6 space-y-4"
    >
      {/* Creation modes row */}
      <div className="flex flex-wrap items-center gap-2">
        {CREATION_MODES.map((mode, index) => (
          <motion.div
            key={mode.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
          >
            <Button
              onClick={() => handleModeClick(mode.id)}
              variant={mode.primary ? 'default' : 'outline'}
              className={cn(
                "h-10 gap-2 rounded-xl transition-all duration-300",
                mode.primary 
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-semibold shadow-lg shadow-orange-500/25 border-0"
                  : "bg-white/[0.03] border-white/[0.08] text-white/80 hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white"
              )}
            >
              <mode.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{mode.label}</span>
              {mode.badge && (
                <Badge className="ml-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0">
                  {mode.badge}
                </Badge>
              )}
            </Button>
          </motion.div>
        ))}
      </div>
      
      {/* Search and filters row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search input with premium styling */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <Input
            placeholder="Search your projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-11 pl-11 pr-4 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 rounded-xl focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-6 items-center gap-1 rounded-md bg-white/5 px-2 text-[10px] font-medium text-white/30 border border-white/10">
            /
          </kbd>
        </div>
        
        {/* Status filters */}
        <div className="flex items-center gap-2">
          <Tabs value={statusFilter} onValueChange={onStatusFilterChange} className="h-11">
            <TabsList className="h-11 bg-white/[0.03] border border-white/[0.08] rounded-xl p-1">
              {STATUS_FILTERS.map((filter) => (
                <TabsTrigger
                  key={filter.value}
                  value={filter.value}
                  className={cn(
                    "h-9 px-4 rounded-lg text-xs font-medium transition-all",
                    "data-[state=inactive]:text-white/50 data-[state=inactive]:hover:text-white/70",
                    "data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500/20 data-[state=active]:to-amber-500/20",
                    "data-[state=active]:text-orange-400 data-[state=active]:border data-[state=active]:border-orange-500/30"
                  )}
                >
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          
          {/* View mode toggle */}
          <div className="flex items-center rounded-xl bg-white/[0.03] border border-white/[0.08] p-1">
            <button
              onClick={() => onViewModeChange('grid')}
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                viewMode === 'grid' 
                  ? "bg-orange-500/20 text-orange-400" 
                  : "text-white/40 hover:text-white/70"
              )}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                viewMode === 'list' 
                  ? "bg-orange-500/20 text-orange-400" 
                  : "text-white/40 hover:text-white/70"
              )}
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
