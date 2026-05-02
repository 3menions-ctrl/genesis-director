import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import { Loader2, Building2, Mail, User, Send } from 'lucide-react';

const schema = z.object({
  full_name: z.string().trim().min(2, 'Tell us your name').max(120),
  work_email: z.string().trim().email('Enter a valid work email').max(255),
  company_name: z.string().trim().min(2, 'Company name is required').max(160),
  company_size: z.string().trim().max(40).optional().or(z.literal('')),
  estimated_seats: z.string().trim().max(10).optional().or(z.literal('')),
  estimated_videos_per_month: z.string().trim().max(40).optional().or(z.literal('')),
  use_case: z.string().trim().max(160).optional().or(z.literal('')),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
});

const SIZE_OPTS = ['1–10', '11–50', '51–200', '201–1,000', '1,000+'];
const VOLUME_OPTS = ['< 50 / mo', '50–250 / mo', '250–1,000 / mo', '1,000–5,000 / mo', '5,000+ / mo'];

export interface ContactSalesDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tier?: 'business' | 'enterprise';
  source?: string;
}

export function ContactSalesDialog({ open, onOpenChange, tier = 'enterprise', source = 'landing' }: ContactSalesDialogProps) {
  const [form, setForm] = useState({
    full_name: '', work_email: '', company_name: '',
    company_size: '', estimated_seats: '', estimated_videos_per_month: '',
    use_case: '', message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    const r = schema.safeParse(form);
    if (!r.success) {
      const e: Record<string, string> = {};
      r.error.errors.forEach(err => { if (err.path[0]) e[err.path[0] as string] = err.message; });
      setErrors(e);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const seats = form.estimated_seats ? parseInt(form.estimated_seats, 10) : null;
      const { error } = await supabase.from('sales_inquiries').insert({
        user_id: user?.id ?? null,
        full_name: form.full_name.trim(),
        work_email: form.work_email.trim().toLowerCase(),
        company_name: form.company_name.trim(),
        company_size: form.company_size || null,
        estimated_seats: Number.isFinite(seats as number) ? seats : null,
        estimated_videos_per_month: form.estimated_videos_per_month || null,
        use_case: form.use_case || null,
        message: form.message || null,
        tier_interest: tier,
        source,
      });
      if (error) throw error;
      toast.success("Thanks! Our team will reach out within one business day.");
      onOpenChange(false);
      setForm({
        full_name: '', work_email: '', company_name: '',
        company_size: '', estimated_seats: '', estimated_videos_per_month: '',
        use_case: '', message: '',
      });
    } catch (err: any) {
      console.error('[ContactSales] submit error:', err);
      toast.error('Could not send your inquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-[hsl(220,14%,4%)] border-white/[0.07] text-white">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight">
            {tier === 'enterprise' ? 'Talk to our Enterprise team' : 'Talk to Sales'}
          </DialogTitle>
          <DialogDescription className="text-white/55">
            Tell us about your team and what you're trying to ship. We'll come back with a tailored plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/55 mb-1 flex items-center gap-1.5"><User className="w-3 h-3" /> Full name</Label>
              <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Jane Cooper" />
              {errors.full_name && <p className="text-destructive text-xs mt-1">{errors.full_name}</p>}
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/55 mb-1 flex items-center gap-1.5"><Mail className="w-3 h-3" /> Work email</Label>
              <Input type="email" value={form.work_email} onChange={e => set('work_email', e.target.value)} placeholder="jane@acme.com" />
              {errors.work_email && <p className="text-destructive text-xs mt-1">{errors.work_email}</p>}
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-white/55 mb-1 flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Company</Label>
            <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Acme, Inc." />
            {errors.company_name && <p className="text-destructive text-xs mt-1">{errors.company_name}</p>}
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-white/55 mb-1.5 block">Company size</Label>
            <div className="flex flex-wrap gap-2">
              {SIZE_OPTS.map(s => (
                <button key={s} type="button" onClick={() => set('company_size', s)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all ${form.company_size === s ? 'bg-[#0A84FF]/15 border-[#0A84FF]/50 text-white' : 'bg-white/[0.02] border-white/[0.07] text-white/60 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/55 mb-1 block">Estimated seats</Label>
              <Input type="number" min={1} value={form.estimated_seats} onChange={e => set('estimated_seats', e.target.value)} placeholder="25" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-white/55 mb-1 block">Videos / month</Label>
              <select
                value={form.estimated_videos_per_month}
                onChange={e => set('estimated_videos_per_month', e.target.value)}
                className="w-full h-10 rounded-md bg-white/[0.03] border border-white/[0.07] text-sm text-white px-3 focus:outline-none focus:border-[#0A84FF]/50"
              >
                <option value="">Select…</option>
                {VOLUME_OPTS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-white/55 mb-1 block">Primary use case</Label>
            <Input value={form.use_case} onChange={e => set('use_case', e.target.value)} placeholder="e.g. Localized paid social at scale" />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-white/55 mb-1 block">Anything else? <span className="text-white/30 normal-case">(optional)</span></Label>
            <Textarea rows={3} value={form.message} onChange={e => set('message', e.target.value)} placeholder="Brand kit, SSO, residency, target launch…" />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-[11px] text-white/30">We respond within one business day.</p>
            <Button onClick={submit} disabled={submitting} className="bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending…</> : <><Send className="w-4 h-4 mr-2" />Request a call</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ContactSalesDialog;