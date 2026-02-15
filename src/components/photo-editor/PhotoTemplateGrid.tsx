import { useState, useEffect } from 'react';
import { Loader2, Crown, Sparkles } from 'lucide-react';
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
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-white/60">Edit Templates</h3>
      
      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize",
              selectedCategory === cat
                ? "bg-cyan-500/20 text-cyan-300"
                : "text-white/30 hover:text-white/50 hover:bg-white/[0.03]"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template cards */}
      <div className="space-y-2">
        {filtered.map(template => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template.id)}
            disabled={isProcessing}
            className={cn(
              "w-full text-left p-3 rounded-xl border transition-all group",
              "bg-white/[0.02] border-white/[0.06] hover:border-cyan-500/30 hover:bg-cyan-500/[0.03]",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{template.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                    {template.name}
                  </p>
                  {template.is_premium && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      <Crown className="w-2.5 h-2.5" />
                      {template.credits_cost}
                    </span>
                  )}
                  {!template.is_premium && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      Free
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/30 mt-0.5 line-clamp-2">
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
