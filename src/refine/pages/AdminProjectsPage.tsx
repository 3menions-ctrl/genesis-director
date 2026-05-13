import { useEffect, useState } from "react";
import { AdminProjectsBrowser } from "@/components/admin/AdminProjectsBrowser";
import { AdminPageShell } from "../components/AdminPageShell";
import { supabase } from "@/integrations/supabase/client";

export default function AdminProjectsPage() {
  const [k, setK] = useState({ total: 0, active: 0, completed: 0, failed: 0 });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("projects").select("status").limit(5000);
      if (!alive || !data) return;
      let active = 0, completed = 0, failed = 0;
      data.forEach((r: any) => {
        const s = (r.status || "").toLowerCase();
        if (s === "completed" || s === "done") completed++;
        else if (s === "failed" || s === "error") failed++;
        else active++;
      });
      setK({ total: data.length, active, completed, failed });
    };
    load();
    return () => { alive = false; };
  }, []);

  return (
    <AdminPageShell
      eyebrow="04 // CONTENT"
      code="PRJ"
      title="Projects"
      italic="Registry."
      description="Inspect every active render across the membrane. Filter, audit, and intervene on production assets in real time."
      stats={[
        { label: "Total Projects", value: k.total.toLocaleString(),     tone: "blue",    sub: "indexed" },
        { label: "In-Flight",      value: k.active.toLocaleString(),    tone: "amber",   sub: "rendering / queued" },
        { label: "Completed",      value: k.completed.toLocaleString(), tone: "emerald", sub: "delivered" },
        { label: "Failed",         value: k.failed.toLocaleString(),    tone: "rose",    sub: "errored" },
      ]}
    >
      <AdminProjectsBrowser />
    </AdminPageShell>
  );
}
