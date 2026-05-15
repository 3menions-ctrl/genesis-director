import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  sample_script: string | null;
}

const QUICK_STARTS = [
  { name: "Brand Story", logline: "A 30-second cinematic reveal of your brand's origin and promise.", style: "Editorial · Warm · Documentary" },
  { name: "Product Reveal", logline: "Hero product unveiled in slow-motion with crisp details and luxury lighting.", style: "Macro · Glossy · Premium" },
  { name: "Action Montage", logline: "High-energy montage of motion, color and rhythm cut to a driving beat.", style: "Kinetic · Bold · Anamorphic" },
  { name: "Music Video", logline: "Performance-driven cuts with stylized environments matching the song's mood.", style: "Stylized · Vivid · Lyric-driven" },
  { name: "Documentary", logline: "Intimate interview moments interleaved with observational b-roll.", style: "Natural · Verité · Soft contrast" },
  { name: "Viral Hook", logline: "First 3 seconds grab attention; cinematic payoff in 15.", style: "Punchy · Bright · Vertical" },
];

interface Props { onPick: (pick: { name: string; logline: string; style: string; sampleScript?: string }) => void }

export function TemplatesDrawerContent({ onPick }: Props) {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data } = await supabase
          .from("script_templates")
          .select("id,name,description,genre,sample_script")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (!cancel && data) setRows(data as TemplateRow[]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <div className="p-7 space-y-6">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-3">Quick starts</div>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_STARTS.map(t => (
            <button key={t.name} onClick={() => onPick({ name: t.name, logline: t.logline, style: t.style })}
              className="group text-left rounded-2xl border border-white/[0.06] hover:border-[#0A84FF]/40 bg-white/[0.02] p-4 transition-all">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[#0A84FF]" />
                <span className="text-white font-medium text-sm">{t.name}</span>
              </div>
              <p className="text-[12px] text-white/50 leading-relaxed line-clamp-3">{t.logline}</p>
              <div className="text-[10px] font-mono uppercase tracking-wider text-white/30 mt-2">{t.style}</div>
            </button>
          ))}
        </div>
      </div>

      {(loading || rows.length > 0) && (
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-3">My templates</div>
          {loading ? (
            <div className="space-y-2">{Array.from({length:3}).map((_,i)=>(<div key={i} className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />))}</div>
          ) : (
            <div className="space-y-2">
              {rows.map(r => (
                <button key={r.id} onClick={() => onPick({ name: r.name, logline: r.description || "", style: r.genre || "Cinematic", sampleScript: r.sample_script || undefined })}
                  className={cn("w-full text-left rounded-xl border border-white/[0.06] hover:border-[#0A84FF]/40 bg-white/[0.02] p-4 transition-all")}>
                  <div className="flex items-center justify-between">
                    <div className="text-white text-sm font-medium">{r.name}</div>
                    {r.genre && <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">{r.genre}</span>}
                  </div>
                  {r.description && <p className="text-[12px] text-white/50 mt-1 line-clamp-2">{r.description}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}