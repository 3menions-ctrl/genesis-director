/**
 * AdminFeatureFlagsPage — manage the runtime feature-flag table.
 * Real CRUD against public.feature_flags. Inline toggle for `enabled`.
 */
import { useState } from "react";
import { ToggleRight, Plus, Trash2 } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleV2, type AdminRow } from "../../components/AdminConsoleV2";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FlagRow extends AdminRow {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  rollout_percentage: number;
  audience: string;
  updated_at: string;
}

export default function AdminFeatureFlagsPage() {
  const [creating, setCreating] = useState(false);

  return (
    <AdminPageShell
      eyebrow="06 // GROWTH"
      code="FLG"
      title="Feature"
      italic="Flags."
      description="Runtime toggles, percentage rollouts, and per-audience gates for every shipping surface."
    >
      <AdminConsoleV2<FlagRow>
        intro="Roll a feature out a slice at a time. Flip a flag and the next request sees the new behavior."
        query={{
          table: "feature_flags",
          orderBy: { column: "updated_at", ascending: false },
        }}
        searchKey="key"
        searchPlaceholder="Search flag keys…"
        filters={[
          {
            key: "audience",
            label: "Audience",
            type: "select",
            options: [
              { value: "all", label: "All" },
              { value: "admin", label: "Admin" },
              { value: "business", label: "Business" },
              { value: "enterprise", label: "Enterprise" },
              { value: "beta", label: "Beta" },
            ],
          },
        ]}
        signals={[
          { label: "Total flags", value: (rows) => rows.length, tone: "blue" },
          {
            label: "Live",
            value: (rows) => rows.filter((r) => (r as FlagRow).enabled).length,
            tone: "emerald",
          },
          {
            label: "Partial rollout",
            value: (rows) =>
              rows.filter(
                (r) =>
                  (r as FlagRow).enabled &&
                  (r as FlagRow).rollout_percentage > 0 &&
                  (r as FlagRow).rollout_percentage < 100,
              ).length,
            tone: "amber",
          },
          {
            label: "Off",
            value: (rows) => rows.filter((r) => !(r as FlagRow).enabled).length,
            tone: "rose",
          },
        ]}
        columns={[
          { key: "key", label: "Flag", width: "220px" },
          { key: "description", label: "Description" },
          {
            key: "audience",
            label: "Audience",
            width: "120px",
            render: (v) => (
              <span className="text-[10px] uppercase tracking-[0.18em] text-primary/80 font-mono">
                {String(v)}
              </span>
            ),
          },
          {
            key: "rollout_percentage",
            label: "Rollout",
            width: "100px",
            align: "right",
            render: (v) => `${v as number}%`,
          },
          { key: "enabled", label: "Status", width: "110px" },
          { key: "updated_at", label: "Updated", width: "170px", hideOnMobile: true },
        ]}
        actions={[
          {
            label: "Toggle",
            icon: ToggleRight,
            onRun: async (row) => {
              const { error } = await supabase
                .from("feature_flags")
                .update({
                  enabled: !row.enabled,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", row.id);
              if (error) throw error;
            },
          },
          {
            label: "Delete",
            icon: Trash2,
            variant: "destructive",
            confirm: "Delete this flag? Code paths reading it will get false.",
            onRun: async (row) => {
              const { error } = await supabase
                .from("feature_flags")
                .delete()
                .eq("id", row.id);
              if (error) throw error;
            },
          },
        ]}
        primaryCta={{ label: "New flag", onClick: () => setCreating(true) }}
        emptyTitle="No feature flags yet"
        emptyDescription="Create your first flag to gate a new feature behind a switch."
      >
        {creating && (
          <CreateFlagDialog
            onClose={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              window.dispatchEvent(new Event("admin-console-refresh"));
            }}
          />
        )}
      </AdminConsoleV2>
    </AdminPageShell>
  );
}

function CreateFlagDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [rollout, setRollout] = useState(0);
  const [audience, setAudience] = useState("all");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^[a-z0-9_.-]+$/.test(key)) {
      toast.error("Use lowercase letters, digits, and . _ - only");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("feature_flags").insert({
      key,
      description: description || null,
      rollout_percentage: rollout,
      audience,
      enabled: false,
    });
    setBusy(false);
    if (error) {
      toast.error(`Could not create: ${error.message}`);
      return;
    }
    toast.success("Flag created");
    onCreated();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: "rgba(12,20,38,0.28)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{
          background: "#ffffff",
          boxShadow:
            "0 50px 120px -30px rgba(16,24,40,0.4), 0 8px 24px -12px rgba(16,24,40,0.18)",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Plus className="w-4 h-4 text-primary/80" />
          <h2 className="font-display text-[#0c1426] text-lg">
            New feature flag
          </h2>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#9aa4b8]">Key</span>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="checkout.new_flow"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-[#f6f8fc] text-[13px] text-[#0c1426] focus:outline-none focus:bg-[#f4f7ff] font-mono"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#9aa4b8]">Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enable the new checkout flow"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-[#f6f8fc] text-[13px] text-[#0c1426] focus:outline-none focus:bg-[#f4f7ff]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#9aa4b8]">Rollout %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={rollout}
                onChange={(e) => setRollout(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-[#f6f8fc] text-[13px] text-[#0c1426] focus:outline-none focus:bg-[#f4f7ff]"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#9aa4b8]">Audience</span>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-[#f6f8fc] text-[13px] text-[#0c1426] focus:outline-none focus:bg-[#f4f7ff]"
              >
                <option value="all">All</option>
                <option value="admin">Admin</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
                <option value="beta">Beta</option>
              </select>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="text-[11px] uppercase tracking-[0.22em] text-[#5d6a82] hover:text-[#0c1426] px-4 py-2 rounded-lg bg-[#f6f8fc] hover:bg-[#f4f7ff]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !key}
            className="text-[11px] uppercase tracking-[0.22em] text-white px-4 py-2 rounded-lg bg-gradient-to-b from-[#0A84FF] to-[#0A6CCC] disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create flag"}
          </button>
        </div>
      </div>
    </div>
  );
}
