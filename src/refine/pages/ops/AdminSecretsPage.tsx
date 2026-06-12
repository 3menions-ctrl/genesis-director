/** Secrets — read-only status of expected edge secrets. Values are never displayed. */
import { useEffect, useState } from "react";
import { KeySquare, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { AdminPageShell, AdminSurface, AdminSectionLabel } from "../../components/AdminPageShell";
import { supabase } from "@/integrations/supabase/client";

interface SecretSpec {
  key: string;
  description: string;
  category: "auth" | "ai" | "payments" | "email" | "integrations" | "monitoring";
}

const SPEC: SecretSpec[] = [
  { key: "SUPABASE_SERVICE_ROLE_KEY", description: "Server-side Supabase admin client", category: "auth" },
  { key: "REPLICATE_API_KEY", description: "Replicate API for video models", category: "ai" },
  { key: "MOTION_TRANSFER_MODEL_VERSION", description: "Override default Motion Transfer model version", category: "ai" },
  { key: "OPENAI_API_KEY", description: "Script generation, embeddings", category: "ai" },
  { key: "ELEVENLABS_API_KEY", description: "Narration & voice cloning", category: "ai" },
  { key: "STRIPE_SECRET_KEY", description: "Stripe checkout & webhook verification", category: "payments" },
  { key: "STRIPE_WEBHOOK_SECRET", description: "Signature verification for incoming webhooks", category: "payments" },
  { key: "RESEND_API_KEY", description: "Transactional email", category: "email" },
  { key: "OAUTH_STATE_SECRET", description: "HMAC for OAuth state param (gen with `openssl rand -hex 32`)", category: "integrations" },
  { key: "GOOGLE_OAUTH_CLIENT_ID", description: "Google Drive integration", category: "integrations" },
  { key: "GOOGLE_OAUTH_CLIENT_SECRET", description: "Google Drive integration", category: "integrations" },
  { key: "NOTION_OAUTH_CLIENT_ID", description: "Notion integration", category: "integrations" },
  { key: "NOTION_OAUTH_CLIENT_SECRET", description: "Notion integration", category: "integrations" },
  { key: "PUBLIC_SITE_URL", description: "Used for OAuth redirect bounces", category: "integrations" },
  { key: "SAML_PRIVATE_KEY", description: "Enterprise SSO/SAML signing", category: "auth" },
  { key: "SAML_X509_CERT", description: "Enterprise SSO/SAML certificate", category: "auth" },
];

const CATEGORY_TONE: Record<SecretSpec["category"], string> = {
  auth: "text-rose-300", ai: "text-[#6FB6FF]", payments: "text-emerald-300",
  email: "text-amber-300", integrations: "text-violet-300", monitoring: "text-white/55",
};

export default function AdminSecretsPage() {
  const [status, setStatus] = useState<Record<string, "present" | "missing" | "unknown">>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // We call a probe edge function to ask "is this secret name present?".
      // The function never returns the value — only "present" | "missing".
      // If the probe function doesn't exist yet, we mark all as "unknown".
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("check-secrets-status", {
          body: { keys: SPEC.map((s) => s.key) },
        });
        if (error || !data?.status) throw error ?? new Error("no status");
        setStatus(data.status);
      } catch {
        // Best-effort: leave as "unknown" if function not deployed.
        const next: typeof status = {};
        for (const s of SPEC) next[s.key] = "unknown";
        setStatus(next);
      }
      setLoading(false);
    })();
  }, []);

  const grouped = SPEC.reduce<Record<string, SecretSpec[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {});

  const presentCount = Object.values(status).filter((v) => v === "present").length;
  const missingCount = Object.values(status).filter((v) => v === "missing").length;

  return (
    <AdminPageShell
      eyebrow="13 // SYSTEM"
      code="SEC"
      title="Secrets"
      italic="Registry."
      description="Expected edge secrets and their presence. Values are never exposed."
      stats={[
        { label: "Expected", value: SPEC.length, tone: "blue" },
        { label: "Present", value: presentCount || "—", tone: "emerald" },
        { label: "Missing", value: missingCount || "—", tone: missingCount ? "rose" : "neutral" },
        { label: "Probe", value: loading ? "Running" : Object.keys(status).length ? "OK" : "Unavailable", tone: "amber" },
      ]}
    >
      <div className="space-y-8">
        {Object.entries(grouped).map(([category, items]) => (
          <AdminSurface key={category} className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <AdminSectionLabel
                label={category.toUpperCase()}
                meta={`${items.length} secrets`}
              />
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="px-5 py-3 text-left text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Key</th>
                  <th className="px-5 py-3 text-left text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Description</th>
                  <th className="px-5 py-3 text-left text-[10px] font-mono uppercase tracking-[0.22em] text-white/35 w-[140px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.key} className="border-b border-white/[0.03]">
                    <td className="px-5 py-3 font-mono text-[12px] text-white/85">
                      <span className={CATEGORY_TONE[s.category]}>●</span> {s.key}
                    </td>
                    <td className="px-5 py-3 text-white/55 text-[12px]">{s.description}</td>
                    <td className="px-5 py-3">
                      {loading ? (
                        <Loader2 className="w-3 h-3 animate-spin text-white/40" />
                      ) : status[s.key] === "present" ? (
                        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300">Present</span>
                      ) : status[s.key] === "missing" ? (
                        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-rose-300">Missing</span>
                      ) : (
                        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/40">Unknown</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminSurface>
        ))}

        <AdminSurface>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-300 mt-0.5" />
            <div>
              <div className="text-white/85 text-[13px] mb-2">Rotation</div>
              <p className="text-[12px] text-white/55 leading-relaxed mb-3">
                Set or rotate secrets with: <code className="font-mono text-white/85">supabase secrets set KEY=value</code>.
                Values never appear in this console — that's by design.
              </p>
              <a
                href="https://supabase.com/dashboard/project/_/settings/functions"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-[#6FB6FF] hover:text-white"
              >
                Open Supabase secrets dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </AdminSurface>
      </div>
    </AdminPageShell>
  );
}
