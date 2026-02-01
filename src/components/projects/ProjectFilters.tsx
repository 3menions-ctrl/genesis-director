/**
 * ProjectFilters Component
 * 
 * Search, sort, filter, and view mode controls for the Projects page.
 * Extracted from Projects.tsx for maintainability.
 */

import { memo, forwardRef } from 'react';
import { 
  Search, SortAsc, SortDesc, Grid3X3, LayoutList, 
  Command, X, Activity, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ============= TYPES =============

export type SortByOption = 'updated' | 'created' | 'name';
export type SortOrderOption = 'asc' | 'desc';
export type StatusFilterOption = 'all' | 'completed' | 'processing' | 'failed';
export type ViewModeOption = 'grid' | 'list';

export interface ProjectFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: SortByOption;
  onSortByChange: (value: SortByOption) => void;
  sortOrder: SortOrderOption;
  onSortOrderChange: (value: SortOrderOption) => void;
  statusFilter: StatusFilterOption;
  onStatusFilterChange: (value: StatusFilterOption) => void;
  viewMode: ViewModeOption;
  onViewModeChange: (value: ViewModeOption) => void;
  showKeyboardHints?: boolean;
  onToggleKeyboardHints?: () => void;
}

// ============= COMPONENT =============

export const ProjectFilters = memo(forwardRef<HTMLDivElement, ProjectFiltersProps>(function ProjectFilters({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  showKeyboardHints = false,
  onToggleKeyboardHints,
}, ref) {
  
  const getSortLabel = () => {
    switch (sortBy) {
      case 'updated': return 'Last Updated';
      case 'created': return 'Date Created';
      case 'name': return 'Name';
      default: return 'Sort';
    }
  };

  const getStatusLabel = () => {
    switch (statusFilter) {
      case 'all': return 'All Projects';
      case 'completed': return 'Completed';
      case 'processing': return 'Processing';
      case 'failed': return 'Failed';
      default: return 'Filter';
    }
  };

  return (
    <div ref={ref} className="mb-6">
      <div className="relative p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-2xl overflow-hidden">
        {/* Subtle glow in corner */}
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />
        
        <div className="relative flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white/70 transition-colors" />
            <Input
              id="project-search"
              type="text"
              placeholder="Search your films..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(
                "pl-11 pr-10 h-11 w-full rounded-xl",
                "bg-white/[0.03] border-white/[0.08]",
                "text-white placeholder:text-zinc-500",
                "focus:border-orange-500/30 focus:bg-white/[0.05] focus:ring-1 focus:ring-orange-500/20",
                "transition-all duration-300"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {!searchQuery && (
              <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] text-zinc-500 font-mono">
                /
              </kbd>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-11 px-4 gap-2 rounded-xl bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.06] hover:border-orange-500/30"
                >
                  {sortOrder === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                  <span className="hidden sm:inline">{getSortLabel()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl bg-zinc-900 border-zinc-700 shadow-2xl backdrop-blur-2xl">
                <DropdownMenuLabel className="text-zinc-500 text-xs uppercase tracking-wider px-3 py-2">Sort By</DropdownMenuLabel>
                <DropdownMenuItem 
                  onClick={() => onSortByChange('updated')}
                  className={cn("gap-2 rounded-lg mx-1", sortBy === 'updated' && "bg-white/10")}
                >
                  {sortBy === 'updated' && <Check className="w-4 h-4 text-orange-400" />}
                  <span className={sortBy !== 'updated' ? 'ml-6' : ''}>Last Updated</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onSortByChange('created')}
                  className={cn("gap-2 rounded-lg mx-1", sortBy === 'created' && "bg-white/10")}
                >
                  {sortBy === 'created' && <Check className="w-4 h-4 text-orange-400" />}
                  <span className={sortBy !== 'created' ? 'ml-6' : ''}>Date Created</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onSortByChange('name')}
                  className={cn("gap-2 rounded-lg mx-1", sortBy === 'name' && "bg-white/10")}
                >
                  {sortBy === 'name' && <Check className="w-4 h-4 text-orange-400" />}
                  <span className={sortBy !== 'name' ? 'ml-6' : ''}>Name</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-700" />
                <DropdownMenuItem 
                  onClick={() => onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="gap-2 rounded-lg mx-1"
                >
                  {sortOrder === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                  {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={cn(
                    "h-11 px-4 gap-2 rounded-xl bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.06] hover:border-orange-500/30",
                    statusFilter !== 'all' && "border-orange-500/30 text-orange-400"
                  )}
                >
                  <Activity className="w-4 h-4" />
                  <span className="hidden sm:inline">{getStatusLabel()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl bg-zinc-900 border-zinc-700 shadow-2xl backdrop-blur-2xl">
                <DropdownMenuLabel className="text-zinc-500 text-xs uppercase tracking-wider px-3 py-2">Filter by Status</DropdownMenuLabel>
                <DropdownMenuCheckboxItem 
                  checked={statusFilter === 'all'}
                  onCheckedChange={() => onStatusFilterChange('all')}
                  className="rounded-lg mx-1"
                >
                  All Projects
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  checked={statusFilter === 'completed'}
                  onCheckedChange={() => onStatusFilterChange('completed')}
                  className="rounded-lg mx-1"
                >
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    Completed
                  </span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  checked={statusFilter === 'processing'}
                  onCheckedChange={() => onStatusFilterChange('processing')}
                  className="rounded-lg mx-1"
                >
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    Processing
                  </span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  checked={statusFilter === 'failed'}
                  onCheckedChange={() => onStatusFilterChange('failed')}
                  className="rounded-lg mx-1"
                >
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    Failed
                  </span>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Toggle */}
            <div className="flex items-center rounded-xl bg-white/[0.03] border border-white/[0.08] p-1">
              <button
                onClick={() => onViewModeChange('grid')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'grid' 
                    ? "bg-white/10 text-white" 
                    : "text-zinc-500 hover:text-white"
                )}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'list' 
                    ? "bg-white/10 text-white" 
                    : "text-zinc-500 hover:text-white"
                )}
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>

            {/* Keyboard hints toggle */}
            {onToggleKeyboardHints && (
              <button
                onClick={onToggleKeyboardHints}
                className={cn(
                  "hidden lg:flex h-11 px-3 items-center gap-2 rounded-xl transition-all",
                  "bg-white/[0.03] border border-white/[0.08]",
                  "text-zinc-500 hover:text-white hover:border-orange-500/30",
                  showKeyboardHints && "border-orange-500/30 text-orange-400"
                )}
              >
                <Command className="w-4 h-4" />
                <span className="text-xs">?</span>
              </button>
            )}
          </div>
        </div>

        {/* Keyboard hints panel */}
        {showKeyboardHints && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] animate-fade-in">
            <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded bg-white/[0.06] border border-white/[0.08] font-mono">/</kbd>
                <span>Search</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded bg-white/[0.06] border border-white/[0.08] font-mono">⌘N</kbd>
                <span>New Project</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded bg-white/[0.06] border border-white/[0.08] font-mono">G</kbd>
                <span>Grid View</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded bg-white/[0.06] border border-white/[0.08] font-mono">L</kbd>
                <span>List View</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded bg-white/[0.06] border border-white/[0.08] font-mono">?</kbd>
                <span>Toggle Hints</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}));

ProjectFilters.displayName = 'ProjectFilters';

export default ProjectFilters;
