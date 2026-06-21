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
      <div
        className="relative p-3 rounded-3xl overflow-hidden"
        style={{
          background: 'hsla(0,0%,100%,0.022)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          boxShadow: '0 16px 48px -24px rgba(0,0,0,0.6), inset 0 1px 0 hsla(0,0%,100%,0.04)',
        }}
      >
        {/* Cinematic ambient glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-[hsla(215,100%,60%,0.06)] blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-[hsla(215,100%,60%,0.04)] blur-[80px] pointer-events-none" />
        
        <div className="relative flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-white/80 transition-colors duration-300" strokeWidth={1.5} />
            <Input
              id="project-search"
              type="text"
              placeholder="Search your films..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={cn(
                "pl-11 pr-10 h-11 w-full rounded-full border-0",
                "bg-white/[0.025]",
                "text-white/90 placeholder:text-white/35 font-light tracking-[-0.005em]",
                "focus:bg-white/[0.05] focus:ring-1 focus:ring-[hsla(215,100%,60%,0.35)] focus-visible:ring-1 focus-visible:ring-[hsla(215,100%,60%,0.35)]",
                "transition-all duration-500"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/90 transition-colors duration-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {!searchQuery && (
              <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-white/40 font-mono">
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
                  className="h-11 px-4 gap-2 rounded-full border-0 bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.07] hover:scale-[1.02] transition-all duration-400 font-light tracking-[-0.005em]"
                >
                  {sortOrder === 'desc' ? <SortDesc className="w-4 h-4" strokeWidth={1.5} /> : <SortAsc className="w-4 h-4" strokeWidth={1.5} />}
                  <span className="hidden sm:inline">{getSortLabel()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-2xl border-0 shadow-2xl"
                style={{
                  background: 'hsla(220,14%,4%,0.85)',
                  backdropFilter: 'blur(48px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(48px) saturate(180%)',
                  boxShadow: '0 24px 64px -16px rgba(0,0,0,0.8), inset 0 1px 0 hsla(0,0%,100%,0.05)',
                }}
              >
                <DropdownMenuLabel className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-light px-3 py-2">Sort By</DropdownMenuLabel>
                <DropdownMenuItem 
                  onClick={() => onSortByChange('updated')}
                  className={cn("gap-2 rounded-xl mx-1 font-light text-white/80 focus:bg-white/[0.06] focus:text-white", sortBy === 'updated' && "bg-white/[0.06]")}
                >
                  {sortBy === 'updated' && <Check className="w-4 h-4 text-[hsl(215,100%,70%)]" strokeWidth={1.5} />}
                  <span className={sortBy !== 'updated' ? 'ml-6' : ''}>Last Updated</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onSortByChange('created')}
                  className={cn("gap-2 rounded-xl mx-1 font-light text-white/80 focus:bg-white/[0.06] focus:text-white", sortBy === 'created' && "bg-white/[0.06]")}
                >
                  {sortBy === 'created' && <Check className="w-4 h-4 text-[hsl(215,100%,70%)]" strokeWidth={1.5} />}
                  <span className={sortBy !== 'created' ? 'ml-6' : ''}>Date Created</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onSortByChange('name')}
                  className={cn("gap-2 rounded-xl mx-1 font-light text-white/80 focus:bg-white/[0.06] focus:text-white", sortBy === 'name' && "bg-white/[0.06]")}
                >
                  {sortBy === 'name' && <Check className="w-4 h-4 text-[hsl(215,100%,70%)]" strokeWidth={1.5} />}
                  <span className={sortBy !== 'name' ? 'ml-6' : ''}>Name</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.06]" />
                <DropdownMenuItem 
                  onClick={() => onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="gap-2 rounded-xl mx-1 font-light text-white/80 focus:bg-white/[0.06] focus:text-white"
                >
                  {sortOrder === 'desc' ? <SortDesc className="w-4 h-4" strokeWidth={1.5} /> : <SortAsc className="w-4 h-4" strokeWidth={1.5} />}
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
                    "h-11 px-4 gap-2 rounded-full border-0 bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.07] hover:scale-[1.02] transition-all duration-400 font-light tracking-[-0.005em]",
                    statusFilter !== 'all' && "text-[hsl(215,100%,75%)] bg-[hsla(215,100%,60%,0.08)]"
                  )}
                >
                  <Activity className="w-4 h-4" strokeWidth={1.5} />
                  <span className="hidden sm:inline">{getStatusLabel()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-2xl border-0 shadow-2xl"
                style={{
                  background: 'hsla(220,14%,4%,0.85)',
                  backdropFilter: 'blur(48px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(48px) saturate(180%)',
                  boxShadow: '0 24px 64px -16px rgba(0,0,0,0.8), inset 0 1px 0 hsla(0,0%,100%,0.05)',
                }}
              >
                <DropdownMenuLabel className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-light px-3 py-2">Filter by Status</DropdownMenuLabel>
                <DropdownMenuCheckboxItem 
                  checked={statusFilter === 'all'}
                  onCheckedChange={() => onStatusFilterChange('all')}
                  className="rounded-xl mx-1 font-light text-white/80 focus:bg-white/[0.06] focus:text-white"
                >
                  All Projects
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  checked={statusFilter === 'completed'}
                  onCheckedChange={() => onStatusFilterChange('completed')}
                  className="rounded-xl mx-1 font-light text-white/80 focus:bg-white/[0.06] focus:text-white"
                >
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    Completed
                  </span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  checked={statusFilter === 'processing'}
                  onCheckedChange={() => onStatusFilterChange('processing')}
                  className="rounded-xl mx-1 font-light text-white/80 focus:bg-white/[0.06] focus:text-white"
                >
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[hsl(215,100%,65%)] shadow-[0_0_8px_hsla(215,100%,60%,0.6)]" />
                    Processing
                  </span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  checked={statusFilter === 'failed'}
                  onCheckedChange={() => onStatusFilterChange('failed')}
                  className="rounded-xl mx-1 font-light text-white/80 focus:bg-white/[0.06] focus:text-white"
                >
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    Failed
                  </span>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Toggle */}
            <div className="flex items-center rounded-full bg-white/[0.03] p-1">
              <button
                onClick={() => onViewModeChange('grid')}
                className={cn(
                  "p-2 rounded-full transition-all duration-400",
                  viewMode === 'grid' 
                    ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_hsla(0,0%,100%,0.05)]"
                    : "text-white/40 hover:text-white/80"
                )}
              >
                <Grid3X3 className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={cn(
                  "p-2 rounded-full transition-all duration-400",
                  viewMode === 'list' 
                    ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_hsla(0,0%,100%,0.05)]"
                    : "text-white/40 hover:text-white/80"
                )}
              >
                <LayoutList className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Keyboard hints toggle */}
            {onToggleKeyboardHints && (
              <button
                onClick={onToggleKeyboardHints}
                className={cn(
                  "hidden lg:flex h-11 px-3 items-center gap-2 rounded-full transition-all duration-400",
                  "bg-white/[0.03]",
                  "text-white/40 hover:text-white/90 hover:bg-white/[0.07]",
                  showKeyboardHints && "text-[hsl(215,100%,75%)] bg-[hsla(215,100%,60%,0.08)]"
                )}
              >
                <Command className="w-4 h-4" strokeWidth={1.5} />
                <span className="text-xs font-light">?</span>
              </button>
            )}
          </div>
        </div>

        {/* Keyboard hints panel */}
        {showKeyboardHints && (
          <div className="mt-4 pt-4 animate-fade-in" style={{ borderTop: '1px solid hsla(0,0%,100%,0.04)' }}>
            <div className="flex flex-wrap gap-4 text-xs text-white/40 font-light">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded-md bg-white/[0.04] font-mono">/</kbd>
                <span>Search</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded-md bg-white/[0.04] font-mono">⌘N</kbd>
                <span>New Project</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded-md bg-white/[0.04] font-mono">G</kbd>
                <span>Grid View</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded-md bg-white/[0.04] font-mono">L</kbd>
                <span>List View</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded-md bg-white/[0.04] font-mono">?</kbd>
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
