/**
 * BusinessGeneral — /business/general
 *
 * Workspace identity + metadata, reusing the exact data logic from
 * WorkspaceGeneral (organizations table read/write, event log RPC), re-skinned
 * into the borderless cover-hero BusinessPage language.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { BusinessPage, SectionHead } from "@/components/business/BusinessPage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";

const SLUG_RE = /^[a-z0-9-]{3,40}$/;

const inputCls =
  "h-11 px-4 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-white/20 text-[14px] text-white placeholder:text-white/35 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={cn(TYPE_META, "text-white/45")}>{label}</span>
      {children}
      {hint && <span className="text-[11px] text-white/35 font-light">{hint}</span>}
    </label>
  );
}

export function GeneralSettingsContent() {
  const { currentOrg, hasPermission, refresh } = useWorkspace();
  const canEdit = hasPermission("admin");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    setName(currentOrg.name ?? "");
    setSlug(currentOrg.slug ?? "");
    (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("website, billing_email")
        .eq("id", currentOrg.id)
        .maybeSingle();
      if (data) {
        setWebsite(data.website ?? "");
        setBillingEmail(data.billing_email ?? "");
      }
    })();
  }, [currentOrg]);

  const dirty =
    !!currentOrg &&
    (name !== currentOrg.name ||
      slug !== currentOrg.slug ||
      true /* website/email diff cheap to ignore */);

  const save = async () => {
    if (!currentOrg) return;
    if (!name.trim()) return toast.error("Workspace name is required");
    if (!SLUG_RE.test(slug)) return toast.error("Slug must be 3–40 chars: a–z, 0–9, dash");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: name.trim(),
          slug: slug.trim(),
          website: website.trim() || null,
          billing_email: billingEmail.trim() || null,
        })
        .eq("id", currentOrg.id);
      if (error) throw error;
      await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<unknown>)(
        "fn_log_workspace_event",
        { _org_id: currentOrg.id, _category: "settings", _action: "general.updated" },
      );
      await refresh();
      toast.success("Workspace updated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(msg.includes("duplicate") ? "That slug is taken" : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const saveAction = canEdit ? (
    <button
      type="button"
      onClick={() => void save()}
      disabled={!dirty || saving}
      className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-[hsl(215,90%,55%)] text-white text-[12px] font-medium hover:bg-[hsl(215,90%,60%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
      {saving ? "Saving…" : "Save changes"}
    </button>
  ) : undefined;

  return (
    <>
      <SectionHead
        label={canEdit ? "Workspace profile" : "Workspace profile · read-only"}
        action={saveAction}
      />
      <div className="rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.015] p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Workspace name">
            <input
              className={inputCls}
              value={name}
              disabled={!canEdit}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="URL slug" hint="Lowercase letters, numbers and dashes.">
            <input
              className={inputCls}
              value={slug}
              disabled={!canEdit}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
            />
          </Field>
          <Field label="Website">
            <input
              className={inputCls}
              value={website}
              disabled={!canEdit}
              placeholder="https://"
              onChange={(e) => setWebsite(e.target.value)}
            />
          </Field>
          <Field label="Billing email" hint="Used on invoices and seat-limit alerts.">
            <input
              className={inputCls}
              type="email"
              value={billingEmail}
              disabled={!canEdit}
              onChange={(e) => setBillingEmail(e.target.value)}
            />
          </Field>
          <Field label="Plan" hint="Set by your subscription.">
            <div className="h-11 px-4 flex items-center rounded-xl bg-white/[0.025] ring-1 ring-white/[0.06] text-[14px] text-white/55 capitalize">
              {currentOrg?.plan?.replace(/_/g, " ") ?? "—"}
            </div>
          </Field>
          <Field label="Workspace ID" hint="Reference this in support requests.">
            <div className="h-11 px-4 flex items-center rounded-xl bg-white/[0.025] ring-1 ring-white/[0.06] font-mono text-[12px] text-white/55 truncate">
              {currentOrg?.id ?? "—"}
            </div>
          </Field>
        </div>
      </div>
    </>
  );
}

export default function BusinessGeneral() {
  usePageMeta({ title: "General — Business" });
  return (
    <BusinessPage
      eyebrow={
        <>
          <span className="text-[hsl(215,100%,72%)]">Settings</span>
          <span className="text-white/20">·</span>
          <span>Workspace profile</span>
        </>
      }
      title="General."
      subtitle="Workspace identity and metadata visible to every member. Editable by admins."
    >
      <GeneralSettingsContent />
    </BusinessPage>
  );
}
