/**
 * SchedulePremiereDialog — creator-facing UI for scheduling a premiere.
 *
 * Drop in next to the Publish button on Production / Theater. Lets the
 * creator pick a date/time and an optional title + intro_text. Submits
 * via the schedule_premiere RPC pushed by 20260611230000_premieres.sql,
 * which fans out notifications to all followers.
 *
 * Open by setting `open` from parent state.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reelId: string;
  onScheduled?: (premiereId: string, startsAt: string) => void;
}

function defaultStartLocal(): string {
  // Default to "1 hour from now" rounded to the next 5 minutes, in the
  // browser's local timezone, formatted for <input type="datetime-local">.
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SchedulePremiereDialog({ open, onOpenChange, reelId, onScheduled }: Props) {
  const [startsAt, setStartsAt] = useState<string>(defaultStartLocal());
  const [title, setTitle] = useState<string>("");
  const [intro, setIntro] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const localDate = new Date(startsAt);
    if (Number.isNaN(localDate.getTime())) {
      toast.error("That date doesn't look right");
      return;
    }
    if (localDate.getTime() < Date.now()) {
      toast.error("Pick a time in the future");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("schedule_premiere", {
        p_reel_id: reelId,
        p_starts_at: localDate.toISOString(),
        p_duration_seconds: 60,
        p_title: title.trim() || null,
        p_intro_text: intro.trim() || null,
      });
      if (error) {
        const msg = error.message?.includes("not_owner")
          ? "Only the reel's creator can schedule a premiere."
          : error.message?.includes("starts_at_in_past")
          ? "Pick a time in the future."
          : "Couldn't schedule the premiere. Try again.";
        toast.error(msg);
        return;
      }
      const premiereId = data as unknown as string;
      toast.success("Premiere scheduled — your followers were just notified.");
      onScheduled?.(premiereId, localDate.toISOString());
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" aria-hidden />
            Schedule a premiere
          </DialogTitle>
          <DialogDescription>
            Pick a showtime — your followers get a heads-up, and at the moment
            you choose, the reel goes live with a countdown, live viewer
            count, and live reactions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="premiere-starts-at" className="text-xs uppercase tracking-[0.16em] text-foreground/60">
              Showtime (your local time)
            </Label>
            <Input
              id="premiere-starts-at"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
              min={defaultStartLocal()}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="premiere-title" className="text-xs uppercase tracking-[0.16em] text-foreground/60">
              Title <span className="text-foreground/40 normal-case">(optional)</span>
            </Label>
            <Input
              id="premiere-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Neon Rooftop — Premiere"
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="premiere-intro" className="text-xs uppercase tracking-[0.16em] text-foreground/60">
              Director's note <span className="text-foreground/40 normal-case">(optional)</span>
            </Label>
            <textarea
              id="premiere-intro"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Set the scene before the curtain rises…"
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-base sm:text-sm font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10 focus-visible:border-foreground/30"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="min-w-[140px]">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Schedule premiere"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
