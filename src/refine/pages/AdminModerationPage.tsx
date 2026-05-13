import { useEffect, useState } from "react";
import { AdminContentModeration } from "@/components/admin/AdminContentModeration";
import { AdminPageShell } from "../components/AdminPageShell";
import { supabase } from "@/integrations/supabase/client";

export default function AdminModerationPage() {
  const [k, setK] = useState({ total: 0, pub: 0, hidden: 0, flagged: 0 });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("public_videos")
        .select("is_public,status")
        .limit(2000);
      if (!alive || !data) return;
      let pub = 0, hidden = 0, flagged = 0;
      data.forEach((r: any) => {
        if (r.is_public) pub++; else hidden++;
        if (r.status === "flagged" || r.status === "reported") flagged++;
      });
      setK({ total: data.length, pub, hidden, flagged });
    };
    load();
    return () => { alive = false; };
  }, []);

  return (
    <AdminPageShell
      eyebrow="04 // CONTENT"
      code="MOD"
      title="Moderation"
      italic="Queue."
      description="Reported assets, flagged scenes, and policy violations awaiting operator judgement."
      stats={[
        { label: "Public Assets",  value: k.total.toLocaleString(),   tone: "blue",    sub: "indexed" },
        { label: "Visible",        value: k.pub.toLocaleString(),     tone: "emerald", sub: "live to public" },
        { label: "Hidden",         value: k.hidden.toLocaleString(),  tone: "neutral", sub: "removed from feed" },
        { label: "Flagged",        value: k.flagged.toLocaleString(), tone: "rose",    sub: "needs review" },
      ]}
    >
      <AdminContentModeration />
    </AdminPageShell>
  );
}
