/**
 * StylePackPicker — drop into the Studio so a Director can apply a saved
 * style pack to the current project with one click.
 *
 * Shows the caller's own packs first, then a curated public sampler.
 * Apply records a row in style_pack_applications which bumps the
 * pack's apply_count via trigger.
 */
import { useEffect, useState } from "react";
import { Sparkles, Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Pack {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  apply_count: number;
  is_public: boolean;
}

interface Props {
  projectId?: string;
  onApply?: (pack: Pack) => void;
  className?: string;
}

export function StylePackPicker({ projectId, onApply, className }: Props) {
  const { user } = useAuth();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ownQ = user
        ? supabase
            .from("style_packs")
            .select("id, owner_id, name, description, thumbnail_url, apply_count, is_public")
            .eq("owner_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [] as Pack[] });
      const publicQ = supabase
        .from("style_packs")
        .select("id, owner_id, name, description, thumbnail_url, apply_count, is_public")
        .eq("is_public", true)
        .order("apply_count", { ascending: false })
        .limit(12);
      const [own, pub] = await Promise.all([ownQ, publicQ]);
      if (cancelled) return;
      const seen = new Set<string>();
      const merged: Pack[] = [];
      for (const p of (own.data ?? []) as Pack[]) { merged.push(p); seen.add(p.id); }
      for (const p of (pub.data ?? []) as Pack[]) { if (!seen.has(p.id)) merged.push(p); }
      setPacks(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const apply = async (pack: Pack) => {
    if (!user) {
      toast.message("Sign in to apply a style pack.");
      return;
    }
    setBusy(pack.id);
    try {
      const { error } = await supabase
        .from("style_pack_applications")
        .insert({ pack_id: pack.id, user_id: user.id, project_id: projectId ?? null });
      if (error) {
        toast.error("Couldn't apply that pack. Try again.");
        return;
      }
      onApply?.(pack);
      toast.success(`Applied "${pack.name}"`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={"rounded-2xl border border-glass bg-glass p-4 " + (className ?? "")}>
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden />
          <span className="text-[10px] uppercase tracking-[0.18em] text-foreground/65">
            Style packs
          </span>
        </div>
      </header>

      {loading ? (
        <div className="text-xs text-foreground/55 py-4">Loading packs…</div>
      ) : packs.length === 0 ? (
        <div className="text-xs text-foreground/55 py-4">No packs yet. Save your first style.</div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {packs.map((pack) => (
            <li key={pack.id}>
              <div className="rounded-xl border border-glass bg-background/40 overflow-hidden flex flex-col">
                {pack.thumbnail_url ? (
                  <img src={pack.thumbnail_url} alt="" className="aspect-video object-cover" />
                ) : (
                  <div className="aspect-video bg-glass-hover" aria-hidden />
                )}
                <div className="p-2 flex-1 flex flex-col gap-1">
                  <div className="text-xs font-medium text-foreground line-clamp-1">{pack.name}</div>
                  <div className="text-[10px] text-foreground/55 flex items-center gap-1">
                    <Heart className="w-3 h-3" aria-hidden /> {pack.apply_count}
                    {pack.owner_id === user?.id && <span className="ml-1 px-1.5 rounded bg-primary/15 text-primary">Yours</span>}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy === pack.id}
                    onClick={() => void apply(pack)}
                    className="mt-1"
                  >
                    {busy === pack.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
