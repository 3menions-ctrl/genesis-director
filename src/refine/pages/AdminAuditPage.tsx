/**
 * Admin Audit Log Page — Shows admin action history.
 * Extracted from Admin.tsx audit tab.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Shield, RefreshCw } from "lucide-react";

interface AuditLogEntry {
  id: string; admin_id: string; action: string; target_type: string;
  target_id: string; details: Record<string, unknown>; created_at: string;
}

export default function AdminAuditPage() {
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);

  const fetchAuditLog = async () => {
    try {
      const { data, error } = await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      setAuditLog((data || []) as AuditLogEntry[]);
    } catch { toast.error("Failed to load audit log"); }
  };

  useEffect(() => { fetchAuditLog(); }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="p-5 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-white/40" /> Audit Log
          </h3>
          <p className="text-xs text-white/30 mt-1">Track all admin actions</p>
        </div>
        <div className="p-4">
          {auditLog.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <History className="w-8 h-8 mx-auto mb-3 opacity-30" /><p className="text-sm">No audit entries yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLog.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-white/10 text-white/50">{entry.action}</Badge>
                      {entry.target_type && <span className="text-xs text-white/30">on {entry.target_type}</span>}
                    </div>
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <p className="text-xs text-white/20 mt-1 font-mono truncate">{JSON.stringify(entry.details)}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-white/20 whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Button onClick={fetchAuditLog} variant="ghost" size="sm" className="text-xs text-white/30 hover:text-white/60">
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
      </Button>
    </div>
  );
}
