/** In-app banner system — CRUD on announcements with severity + audience targeting. */
import { useState } from "react";
import { Megaphone, Trash2, Power } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AnnouncementRow extends AdminRow {
  id: string;
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "critical";
  audience: string;
  cta_label: string | null;
  cta_url: string | null;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  created_at: string;
}

const SEVERITY_TONE = {
  info: "text-primary/80",
  success: "text-emerald-300",
  warning: "text-amber-300",
  critical: "text-rose-300",
} as const;

export default function AdminAnnouncementsPage() {
  const [creating, setCreating] = useState(false);
  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="ANN"
      title="Announcements"
      italic="& Banners."
      description="Schedulable in-app banners targeted by audience, severity, and time window."
    >
      <AdminConsoleV2<AnnouncementRow>
        intro="Compose, schedule, and target in-app banners by audience and severity. Note: entries are stored in the announcements table, but the live in-app banner reads a different system_config key — messages composed here are not yet surfaced in the product."
        query={{ table: "announcements", orderBy: { column: "created_at", ascending: false } }}
        searchKey="title"
        searchPlaceholder="Search announcements…"
        filters={[
          { key: "severity", label: "Severity", type: "select", options: [
            { value: "info", label: "Info" }, { value: "success", label: "Success" },
            { value: "warning", label: "Warning" }, { value: "critical", label: "Critical" }] },
          { key: "audience", label: "Audience", type: "select", options: [
            { value: "all", label: "All" }, { value: "admin", label: "Admin" },
            { value: "business", label: "Business" }, { value: "enterprise", label: "Enterprise" },
            { value: "personal", label: "Personal" }] },
        ]}
        signals={[
          { label: "Total", value: (r) => r.length, tone: "blue" },
          { label: "Active", value: (r) => r.filter((x) => (x as AnnouncementRow).active).length, tone: "emerald" },
          { label: "Scheduled", value: (r) => r.filter((x) => new Date((x as AnnouncementRow).starts_at) > new Date()).length, tone: "amber" },
          { label: "Critical", value: (r) => r.filter((x) => (x as AnnouncementRow).severity === "critical").length, tone: "rose" },
        ]}
        columns={[
          { key: "title", label: "Title", width: "240px" },
          { key: "severity", label: "Severity", width: "100px",
            render: (v) => <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${SEVERITY_TONE[v as keyof typeof SEVERITY_TONE]}`}>{String(v)}</span> },
          { key: "audience", label: "Audience", width: "110px" },
          { key: "starts_at", label: "Starts", width: "170px", hideOnMobile: true },
          { key: "ends_at", label: "Ends", width: "170px", hideOnMobile: true },
          { key: "active", label: "Status", width: "100px" },
        ]}
        actions={[
          { label: "Toggle", icon: Power, onRun: async (r) => {
            const { error } = await supabase.from("announcements").update({ active: !r.active }).eq("id", r.id);
            if (error) throw error;
          }},
          { label: "Delete", icon: Trash2, variant: "destructive", confirm: "Delete this announcement?",
            onRun: async (r) => {
              const { error } = await supabase.from("announcements").delete().eq("id", r.id);
              if (error) throw error;
            }},
        ]}
        primaryCta={{ label: "Compose banner", onClick: () => setCreating(true) }}
        emptyTitle="No announcements yet"
        emptyDescription="Compose a banner to message a slice of your user base."
      >
        {creating && <CreateAnnouncementDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); window.dispatchEvent(new Event("admin-console-refresh")); }} />}
      </AdminConsoleV2>
    </AdminPageShell>
  );
}

function CreateAnnouncementDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<"info" | "success" | "warning" | "critical">("info");
  const [audience, setAudience] = useState("all");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !body.trim()) { toast.error("Title and body required"); return; }
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) { toast.error("End must be after start"); return; }
    setBusy(true);
    // starts_at defaults to now() in the DB, so only send it when scheduled.
    const payload: Record<string, unknown> = {
      title, body, severity, audience,
      cta_label: ctaLabel || null, cta_url: ctaUrl || null,
    };
    if (startsAt) payload.starts_at = new Date(startsAt).toISOString();
    if (endsAt) payload.ends_at = new Date(endsAt).toISOString();
    const { error } = await supabase.from("announcements").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Announcement created");
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-background p-6 space-y-4">
        <div className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary/80" />
          <h2 className="font-display text-white text-lg">New announcement</h2></div>
        <FormField label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-glass text-[13px] text-white focus:outline-none focus:border-primary/40" /></FormField>
        <FormField label="Body"><textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-glass text-[13px] text-white focus:outline-none focus:border-primary/40 resize-none" /></FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Severity"><select value={severity} onChange={(e) => setSeverity(e.target.value as any)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-glass text-[13px] text-white focus:outline-none focus:border-primary/40">
            <option value="info">Info</option><option value="success">Success</option>
            <option value="warning">Warning</option><option value="critical">Critical</option>
          </select></FormField>
          <FormField label="Audience"><select value={audience} onChange={(e) => setAudience(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-glass text-[13px] text-white focus:outline-none focus:border-primary/40">
            <option value="all">All</option><option value="admin">Admin</option>
            <option value="business">Business</option><option value="enterprise">Enterprise</option>
            <option value="personal">Personal</option>
          </select></FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="CTA label"><input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Learn more"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-glass text-[13px] text-white focus:outline-none focus:border-primary/40" /></FormField>
          <FormField label="CTA URL"><input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-glass text-[13px] text-white focus:outline-none focus:border-primary/40" /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Starts (optional)"><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-glass text-[13px] text-white focus:outline-none focus:border-primary/40" /></FormField>
          <FormField label="Ends (optional)"><input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-glass text-[13px] text-white focus:outline-none focus:border-primary/40" /></FormField>
        </div>
        <p className="text-[10px] text-white/35 leading-relaxed">Leave start blank to publish immediately. A future start time marks the banner as "Scheduled". These columns are real, but the product does not surface announcements yet.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-[11px] uppercase tracking-[0.22em] text-white/45 hover:text-white px-4 py-2 rounded-lg border border-white/[0.08]">Cancel</button>
          <button onClick={submit} disabled={busy}
            className="text-[11px] uppercase tracking-[0.22em] text-white px-4 py-2 rounded-lg bg-gradient-to-b from-[#0A84FF] to-[#0A6CCC] border border-primary/50 disabled:opacity-40">
            {busy ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block"><span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/40">{label}</span>{children}</label>);
}
