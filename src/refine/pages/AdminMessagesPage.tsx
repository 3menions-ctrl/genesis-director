import { useEffect, useState } from "react";
import { AdminMessageCenter } from "@/components/admin/AdminMessageCenter";
import { AdminPageShell } from "../components/AdminPageShell";
import { supabase } from "@/integrations/supabase/client";

export default function AdminMessagesPage() {
  const [counts, setCounts] = useState({ all: 0, neu: 0, prog: 0, res: 0 });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("support_messages").select("status");
      if (!alive || !data) return;
      const c = { all: data.length, neu: 0, prog: 0, res: 0 };
      data.forEach((r: any) => {
        if (r.status === "new") c.neu++;
        else if (r.status === "in_progress") c.prog++;
        else if (r.status === "resolved") c.res++;
      });
      setCounts(c);
    };
    load();
    const ch = supabase.channel("inbox_kpi")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  return (
    <AdminPageShell
      eyebrow="02 // PEOPLE"
      code="MSG"
      title="Inbox"
      italic="Threads."
      description="Inbound user signals — support, escalations, requests. Triage from a single channel."
      stats={[
        { label: "Total Threads",  value: counts.all.toLocaleString(),  tone: "blue",    sub: "all-time" },
        { label: "Awaiting Reply", value: counts.neu.toLocaleString(),  tone: "amber",   sub: "status: new" },
        { label: "In Progress",    value: counts.prog.toLocaleString(), tone: "neutral", sub: "active" },
        { label: "Resolved",       value: counts.res.toLocaleString(),  tone: "emerald", sub: "closed" },
      ]}
    >
      <AdminMessageCenter />
    </AdminPageShell>
  );
}
