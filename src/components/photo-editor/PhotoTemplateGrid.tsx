import { useState, useEffect } from 'react';
import { Loader2, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  is_premium: boolean;
  credits_cost: number;
}

interface PhotoTemplateGridProps {
  onSelectTemplate: (templateId: string) => void;
  isProcessing: boolean;
}

export function PhotoTemplateGrid({ onSelectTemplate, isProcessing }: PhotoTemplateGridProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('photo_edit_templates')
        .select('id, name, description, category, icon, is_premium, credits_cost')
        .eq('is_active', true)
        .order('sort_order');
      
      setTemplates(data || []);
      setLoading(false);
    };
    fetchTemplates();
  }, []);

  const categories = ['all', ...new Set(templates.map(t => t.category))];
  const filtered = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <h3 className="text-sm font-medium text-white/60">Edit Templates</h3>
      
      {/* Category filter - scrollable on mobile */}
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize whitespace-nowrap flex-shrink-0",
              selectedCategory === cat
                ? "bg-cyan-500/20 text-cyan-300"
                : "text-white/30 hover:text-white/50 hover:bg-white/[0.03]"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template cards - grid on mobile, list on desktop */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-1 gap-2">
        {filtered.map(template => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template.id)}
            disabled={isProcessing}
            className={cn(
              "w-full text-left p-2.5 sm:p-3 rounded-xl border transition-all group",
              "bg-white/[0.02] border-white/[0.06] hover:border-cyan-500/30 hover:bg-cyan-500/[0.03] active:scale-[0.98]",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex items-start gap-2.5 sm:gap-3">
              <span className="text-lg sm:text-xl">{template.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <p className="text-xs sm:text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                    {template.name}
                  </p>
                  {template.is_premium ? (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      <Crown className="w-2.5 h-2.5" />
                      {template.credits_cost}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      Free
                    </span>
                  )}
                </div>
                <p className="text-[10px] sm:text-xs text-white/30 mt-0.5 line-clamp-1 sm:line-clamp-2">
                  {template.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
