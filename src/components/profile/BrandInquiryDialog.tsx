/**
 * BrandInquiryDialog — structured pitch for sponsorship / collab offers.
 * Posts to `brand_inquiries`. The recipient gets a `brand_inquiry`
 * notification and the row shows up in their Inbox → Brand lane.
 */
import { useState } from "react";
import { Briefcase, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
}

export function BrandInquiryDialog({ open, onClose, recipientId, recipientName }: Props) {
  const [brandName, setBrandName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [budget, setBudget] = useState<number>(500);
  const [deliverables, setDeliverables] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!brandName.trim() || !deliverables.trim() || budget <= 0) {
      toast.error("Brand name, deliverables, and a non-zero budget are required.");
      return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in first.");
      const { error } = await supabase
        .from("brand_inquiries" as never)
        .insert({
          sender_id:    user.id,
          recipient_id: recipientId,
          brand_name:   brandName.trim(),
          contact_email: contactEmail.trim() || null,
          budget_usd:   Math.max(0, Math.round(budget)),
          deliverables: deliverables.trim(),
          deadline:     deadline || null,
          notes:        notes.trim() || null,
        } as never);
      if (error) throw error;
      toast.success(`Inquiry sent to ${recipientName}.`);
      onClose();
      setBrandName(""); setContactEmail(""); setBudget(500); setDeliverables(""); setDeadline(""); setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send inquiry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-amber-200" />Pitch {recipientName} a deal
          </DialogTitle>
          <DialogDescription>
            Structured fields so the creator can decide in 30 seconds. Lands in their Inbox → Brand lane.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-[12px] font-medium text-foreground/85 mb-1">Brand</div>
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Acme Lighting" maxLength={120} />
          </div>
          <div>
            <div className="text-[12px] font-medium text-foreground/85 mb-1">Contact email</div>
            <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="ops@acme.com" type="email" />
          </div>
          <div>
            <div className="text-[12px] font-medium text-foreground/85 mb-1">Budget (USD)</div>
            <Input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value) || 0)} />
          </div>
          <div>
            <div className="text-[12px] font-medium text-foreground/85 mb-1">Deliverables</div>
            <Textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} rows={3} placeholder="One 90-sec hero film for IG + 3 cutdowns." />
          </div>
          <div>
            <div className="text-[12px] font-medium text-foreground/85 mb-1">Deadline (optional)</div>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div>
            <div className="text-[12px] font-medium text-foreground/85 mb-1">Notes (optional)</div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Anything that helps you decide." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}><X className="h-3.5 w-3.5 mr-2" />Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-2" />}
            Send pitch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
