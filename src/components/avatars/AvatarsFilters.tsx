import { memo, forwardRef } from 'react';
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

export const AvatarsFilters = memo(forwardRef<HTMLDivElement, AvatarsFiltersProps>(function AvatarsFilters({
  searchQuery,
  onSearchChange,
  genderFilter,
  onGenderChange,
  styleFilter,
  onStyleChange,
  hasActiveFilters,
  onClearFilters,
  onBack,
}, ref) {
  return (
    <div ref={ref} className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-6 max-w-7xl mx-auto">
      {/* Back Button - Mobile only shows icon */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="text-white/50 hover:text-white w-fit text-[10px] font-light tracking-[0.18em] uppercase rounded-full"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
        <span className="hidden md:inline">Back to Create</span>
      </Button>

      {/* Filters */}
      <div className="flex items-center gap-2 md:gap-3 overflow-x-auto scrollbar-hide">
        {/* Search */}
        <div className="relative shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" strokeWidth={1.5} />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 w-36 md:w-48 h-9 rounded-full bg-white/[0.025] border-0 text-white placeholder:text-white/30 text-xs font-light tracking-wide shadow-[inset_0_1px_0_hsla(0,0%,100%,0.04),inset_0_0_0_1px_hsla(0,0%,100%,0.05)] focus-visible:shadow-[inset_0_1px_0_hsla(215,100%,80%,0.08),inset_0_0_0_1px_hsla(215,100%,55%,0.3)]"
          />
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 px-3.5 rounded-full text-[10px] font-light tracking-[0.18em] uppercase shrink-0 transition-all duration-300",
                hasActiveFilters
                  ? "text-[hsl(215,100%,75%)]"
                  : "text-white/55 hover:text-white"
              )}
              style={{
                background: hasActiveFilters ? 'hsla(215,100%,55%,0.1)' : 'hsla(0,0%,100%,0.025)',
                boxShadow: hasActiveFilters
                  ? 'inset 0 1px 0 hsla(215,100%,80%,0.08), inset 0 0 0 1px hsla(215,100%,55%,0.28)'
                  : 'inset 0 1px 0 hsla(0,0%,100%,0.04), inset 0 0 0 1px hsla(0,0%,100%,0.05)',
              }}
            >
              <Filter className="w-3 h-3 mr-1.5" strokeWidth={1.5} />
              <span className="hidden md:inline">Filters</span>
              {hasActiveFilters && (
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(215,100%,65%)', boxShadow: '0 0 8px hsla(215,100%,55%,0.6)' }} />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-64 rounded-2xl border-0 p-4 space-y-4"
            align="end"
            style={{
              background: 'linear-gradient(180deg, hsla(220,14%,7%,0.92) 0%, hsla(220,14%,4%,0.95) 100%)',
              backdropFilter: 'blur(48px) saturate(180%)',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05), 0 24px 60px -16px hsla(0,0%,0%,0.7)',
            }}
          >
            <div className="space-y-2">
              <Label className="text-[9px] font-light tracking-[0.2em] uppercase text-white/45">Gender</Label>
              <Select value={genderFilter} onValueChange={onGenderChange}>
                <SelectTrigger className="rounded-full border-0 bg-white/[0.03] text-white text-xs font-light shadow-[inset_0_1px_0_hsla(0,0%,100%,0.04),inset_0_0_0_1px_hsla(0,0%,100%,0.05)]">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-0" style={{ background: 'hsla(220,14%,6%,0.96)', backdropFilter: 'blur(32px) saturate(180%)', boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05), 0 16px 40px -12px hsla(0,0%,0%,0.7)' }}>
                  {AVATAR_GENDERS.map((g) => (
                    <SelectItem key={g.id} value={g.id} className="text-white/85 text-xs font-light focus:bg-white/[0.06] focus:text-white rounded-lg">
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[9px] font-light tracking-[0.2em] uppercase text-white/45">Style</Label>
              <Select value={styleFilter} onValueChange={onStyleChange}>
                <SelectTrigger className="rounded-full border-0 bg-white/[0.03] text-white text-xs font-light shadow-[inset_0_1px_0_hsla(0,0%,100%,0.04),inset_0_0_0_1px_hsla(0,0%,100%,0.05)]">
                  <SelectValue placeholder="Style" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-0" style={{ background: 'hsla(220,14%,6%,0.96)', backdropFilter: 'blur(32px) saturate(180%)', boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05), 0 16px 40px -12px hsla(0,0%,0%,0.7)' }}>
                  {AVATAR_STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-white/85 text-xs font-light focus:bg-white/[0.06] focus:text-white rounded-lg">
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
                className="w-full rounded-full text-[10px] font-light tracking-[0.16em] uppercase text-white/55 hover:text-white hover:bg-white/[0.04]"
              >
                Clear All Filters
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}));

AvatarsFilters.displayName = 'AvatarsFilters';

export default AvatarsFilters;
