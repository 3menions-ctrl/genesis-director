/** Discount coupons — code-based promos for Stripe checkout. */
import { useState } from "react";
import { Tag, Plus, Power, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { AdminDialog, AdminField, inputClass } from "../../components/AdminFormPrimitives";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CouponRow extends AdminRow {
  id: string;
  code: string;
  description: string | null;
  percent_off: number | null;
  amount_off_cents: number | null;
  currency: string;
  duration: string;
  duration_in_months: number | null;
  max_redemptions: number | null;
  times_redeemed: number;
  expires_at: string | null;
  active: boolean;
  stripe_coupon_id: string | null;
}

export default function AdminCouponsPage() {
  const [creating, setCreating] = useState(false);
  return (
    <AdminPageShell
      eyebrow="09 // MONEY"
      code="CPN"
      title="Coupons"
      italic="& Promos."
      description="Code-based discounts mirrored to Stripe — percent or fixed amount, single-use or repeating."
    >
      <AdminConsoleV2<CouponRow>
        intro="Issue promo codes. Use them in Stripe checkout sessions and track redemption per code here."
        query={{ table: "discount_coupons", orderBy: { column: "created_at", ascending: false } }}
        searchKey="code"
        signals={[
          { label: "Active", value: (r) => r.filter((x) => (x as CouponRow).active).length, tone: "emerald" },
          { label: "Total redemptions", value: (r) => r.reduce((s, x) => s + ((x as CouponRow).times_redeemed ?? 0), 0).toLocaleString(), tone: "blue" },
          { label: "Expiring soon",
            value: (r) => r.filter((x) => {
              const c = x as CouponRow;
              if (!c.expires_at) return false;
              return new Date(c.expires_at).getTime() - Date.now() < 7 * 86400_000;
            }).length, tone: "amber" },
          { label: "% off codes", value: (r) => r.filter((x) => (x as CouponRow).percent_off != null).length, tone: "neutral" },
        ]}
        columns={[
          { key: "code", label: "Code", width: "160px",
            render: (v) => <code className="font-mono text-[12px] text-white/85 uppercase">{String(v)}</code> },
          { key: "description", label: "Description" },
          { key: "percent_off", label: "Discount", width: "120px", align: "right",
            render: (_, row) => row.percent_off != null
              ? <span className="text-emerald-300">{row.percent_off}% off</span>
              : row.amount_off_cents != null
                ? <span className="text-emerald-300">${(row.amount_off_cents / 100).toFixed(2)} off</span>
                : "—" },
          { key: "duration", label: "Duration", width: "100px" },
          { key: "times_redeemed", label: "Used", width: "80px", align: "right",
            render: (_, row) => row.max_redemptions
              ? `${row.times_redeemed} / ${row.max_redemptions}`
              : String(row.times_redeemed) },
          { key: "expires_at", label: "Expires", width: "170px", hideOnMobile: true },
          { key: "active", label: "Status", width: "100px" },
        ]}
        actions={[
          { label: "Toggle", icon: Power, onRun: async (r) => {
            const { error } = await supabase.from("discount_coupons").update({ active: !r.active }).eq("id", r.id);
            if (error) throw error;
          }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this coupon? Existing redemptions are preserved in Stripe.",
            onRun: async (r) => {
              const { error } = await supabase.from("discount_coupons").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        primaryCta={{ label: "Create coupon", onClick: () => setCreating(true) }}
        emptyTitle="No coupons yet"
        emptyDescription="Create promo codes here, then reference them in your Stripe checkout flow."
      >
        {creating && <CreateCoupon onClose={() => setCreating(false)} />}
      </AdminConsoleV2>
    </AdminPageShell>
  );
}

function CreateCoupon({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [percentOff, setPercentOff] = useState("");
  const [amountOff, setAmountOff] = useState("");
  const [duration, setDuration] = useState("once");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) { toast.error("Code required"); return; }
    if (!percentOff && !amountOff) { toast.error("Set either percent_off or amount_off"); return; }
    setBusy(true);
    const { error } = await supabase.from("discount_coupons").insert({
      code: code.toUpperCase().trim(),
      description: description || null,
      percent_off: percentOff ? Number(percentOff) : null,
      amount_off_cents: amountOff ? Math.round(Number(amountOff) * 100) : null,
      duration,
      max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
      expires_at: expiresAt || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Coupon created");
    onClose();
  };

  return (
    <AdminDialog title="New coupon" icon={Plus} onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Create">
      <AdminField label="Code"><input value={code} onChange={(e) => setCode(e.target.value)} className={`${inputClass} font-mono uppercase`} placeholder="LAUNCH50" /></AdminField>
      <AdminField label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></AdminField>
      <div className="grid grid-cols-2 gap-3">
        <AdminField label="% off"><input type="number" min={0} max={100} value={percentOff} onChange={(e) => { setPercentOff(e.target.value); if (e.target.value) setAmountOff(""); }} className={inputClass} placeholder="20" /></AdminField>
        <AdminField label="$ off"><input type="number" step="0.01" min={0} value={amountOff} onChange={(e) => { setAmountOff(e.target.value); if (e.target.value) setPercentOff(""); }} className={inputClass} placeholder="5.00" /></AdminField>
      </div>
      <AdminField label="Duration"><select value={duration} onChange={(e) => setDuration(e.target.value)} className={inputClass}>
        <option value="once">Once</option><option value="repeating">Repeating</option><option value="forever">Forever</option>
      </select></AdminField>
      <div className="grid grid-cols-2 gap-3">
        <AdminField label="Max redemptions"><input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} className={inputClass} placeholder="Unlimited" /></AdminField>
        <AdminField label="Expires at"><input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} /></AdminField>
      </div>
    </AdminDialog>
  );
}
