import { useState } from "react";
import { Music2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Tense", prompt: "Tense cinematic underscore, low strings, sub-bass pulses, 90 bpm" },
  { label: "Lush", prompt: "Lush orchestral, soaring strings, warm brass, 80 bpm" },
  { label: "Pulse", prompt: "Driving electronic pulse, arpeggiated synths, 120 bpm" },
  { label: "Hopeful", prompt: "Bright uplifting acoustic, fingerpicked guitar, 100 bpm" },
  { label: "Noir", prompt: "Smoky jazz noir, muted trumpet, brushed drums, 70 bpm" },
  { label: "Silence", prompt: "" },
];

interface Props { current?: string; onSelect: (scoreUrl: string | undefined, prompt: string) => void }

export function MusicDrawerContent({ current, onSelect }: Props) {
  const [prompt, setPrompt] = useState(current || "");
  const [busy, setBusy] = useState(false);

  const generate = async (p: string) => {
    if (!p) { onSelect(undefined, ""); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-music", { body: { prompt: p, duration: 30 } });
      if (error) throw error;
      const url = (data as any)?.audioUrl || (data as any)?.url;
      if (!url) throw new Error("No audio returned");
      onSelect(url, p);
      toast.success("Score generated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate music");
    } finally { setBusy(false); }
  };

  return (
    <div className="p-7 space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => setPrompt(p.prompt)}
            className={cn("rounded-xl border border-white/[0.06] hover:border-primary/40 bg-glass p-3 text-left transition-all")}>
            <Music2 className="w-3.5 h-3.5 text-primary mb-1" />
            <div className="text-white text-xs font-medium">{p.label}</div>
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Prompt</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
          placeholder="Describe the score…"
          className="w-full p-4 rounded-xl bg-glass border border-white/[0.06] text-white placeholder:text-white/30 focus:border-primary/50 focus:outline-none text-sm resize-none" />
        <button onClick={() => generate(prompt)} disabled={busy}
          className={cn("w-full h-11 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2 transition-all")}>
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : "Generate score"}
        </button>
      </div>
    </div>
  );
}