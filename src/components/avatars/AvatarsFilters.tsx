import { memo } from 'react';
import { Search, Filter, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AVATAR_STYLES, AVATAR_GENDERS } from '@/types/avatar-templates';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AvatarsFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  genderFilter: string;
  onGenderChange: (gender: string) => void;
  styleFilter: string;
  onStyleChange: (style: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onBack: () => void;
}

export const AvatarsFilters = memo(function AvatarsFilters({
  searchQuery,
  onSearchChange,
  genderFilter,
  onGenderChange,
  styleFilter,
  onStyleChange,
  hasActiveFilters,
  onClearFilters,
  onBack,
}: AvatarsFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-6 max-w-7xl mx-auto">
      {/* Back Button - Mobile only shows icon */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="text-white/50 hover:text-white w-fit"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        <span className="hidden md:inline">Back to Create</span>
      </Button>

      {/* Filters */}
      <div className="flex items-center gap-2 md:gap-3 overflow-x-auto scrollbar-hide">
        {/* Search */}
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 w-36 md:w-48 h-9 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 text-sm"
          />
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              className={cn(
                "h-9 border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.05] shrink-0",
                hasActiveFilters && "border-violet-500/50 text-violet-400"
              )}
            >
              <Filter className="w-4 h-4 mr-1.5" />
              <span className="hidden md:inline">Filters</span>
              {hasActiveFilters && (
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-violet-500" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-64 bg-zinc-900/95 backdrop-blur-xl border-white/10 p-4 space-y-4"
            align="end"
          >
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Gender</Label>
              <Select value={genderFilter} onValueChange={onGenderChange}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-white">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10">
                  {AVATAR_GENDERS.map((g) => (
                    <SelectItem key={g.id} value={g.id} className="text-white focus:bg-white/10 focus:text-white">
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Style</Label>
              <Select value={styleFilter} onValueChange={onStyleChange}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-white">
                  <SelectValue placeholder="Style" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10">
                  {AVATAR_STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-white focus:bg-white/10 focus:text-white">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="w-full text-white/50 hover:text-white"
              >
                Clear All Filters
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});

export default AvatarsFilters;
