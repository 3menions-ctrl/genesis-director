import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface EnvRow { id: string; template_name: string; thumbnail_url: string | null; atmosphere: string | null }
interface Props { selectedId?: string; onSelect: (env: EnvRow) => void }

export function EnvironmentsDrawerContent({ selectedId, onSelect }: Props) {
  const [rows, setRows] = useState<EnvRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("genesis_environment_templates")
        .select("id,template_name,thumbnail_url,atmosphere")
        .order("template_name");
      if (!cancel && data) setRows(data as EnvRow[]);
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <div className="p-7">
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({length:6}).map((_,i)=>(<div key={i} className="aspect-video rounded-xl bg-white/[0.04] animate-pulse" />))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-white/40 text-sm">No environments yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {rows.map(env => (
            <button key={env.id} onClick={() => onSelect(env)}
              className={cn("group relative aspect-video rounded-xl overflow-hidden border-2 transition-all",
                selectedId === env.id ? "border-[#0A84FF] shadow-[0_0_24px_rgba(10,132,255,0.4)]" : "border-white/[0.06] hover:border-white/20")}>
              {env.thumbnail_url ? (
                <img src={env.thumbnail_url} alt={env.template_name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-white/[0.02]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <div className="absolute bottom-2 left-3 right-3 text-left">
                <div className="text-white text-sm font-medium truncate">{env.template_name}</div>
                {env.atmosphere && <div className="text-[10px] font-mono uppercase tracking-wider text-white/50 truncate">{env.atmosphere}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}