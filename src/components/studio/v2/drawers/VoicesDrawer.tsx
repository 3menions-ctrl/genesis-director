import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Play, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRow { voice_id: string; voice_name: string | null; voice_provider: string; sample_audio_url: string | null; name: string }
interface Props { selectedId?: string; onSelect: (voiceId: string, voiceName: string) => void }

export function VoicesDrawerContent({ selectedId, onSelect }: Props) {
  const [voices, setVoices] = useState<VoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("avatar_templates")
        .select("voice_id,voice_name,voice_provider,sample_audio_url,name")
        .eq("is_active", true)
        .not("voice_id", "is", null)
        .order("name");
      if (cancel) return;
      const map = new Map<string, VoiceRow>();
      (data as VoiceRow[] | null)?.forEach(v => { if (v.voice_id && !map.has(v.voice_id)) map.set(v.voice_id, v); });
      setVoices(Array.from(map.values()));
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  const play = (url?: string, id?: string) => {
    if (!url || !id) return;
    const a = new Audio(url);
    setPlaying(id);
    a.onended = () => setPlaying(null);
    a.play().catch(() => setPlaying(null));
  };

  if (loading) return <div className="p-7 space-y-2">{Array.from({length:6}).map((_,i)=>(<div key={i} className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />))}</div>;

  return (
    <div className="p-7 space-y-2">
      {voices.map(v => (
        <div key={v.voice_id}
          className={cn("rounded-xl border p-4 flex items-center gap-3 transition-all",
            selectedId === v.voice_id ? "border-[#0A84FF] bg-[#0A84FF]/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/20")}>
          <button onClick={() => play(v.sample_audio_url || undefined, v.voice_id)}
            className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-[#0A84FF]/20 flex items-center justify-center text-white/70">
            <Play className={cn("w-4 h-4", playing === v.voice_id && "animate-pulse text-[#0A84FF]")} />
          </button>
          <button onClick={() => onSelect(v.voice_id, v.voice_name || v.name || v.voice_id)} className="flex-1 text-left">
            <div className="text-white text-sm font-medium">{v.voice_name || v.name || v.voice_id}</div>
            <div className="text-[11px] text-white/40 font-mono uppercase tracking-wider">{v.voice_provider || "elevenlabs"}</div>
          </button>
          {selectedId === v.voice_id && <Check className="w-4 h-4 text-[#0A84FF]" />}
        </div>
      ))}
    </div>
  );
}