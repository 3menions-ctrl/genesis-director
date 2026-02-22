/**
 * Admin Users Page — User management with search, credit adjustment, role management.
 * Extracted from Admin.tsx users tab.
 */
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, Loader2, Coins, UserCog, Shield, Crown, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRecord {
  id: string;
  email: string;
  display_name: string;
  full_name: string;
  credits_balance: number;
  total_credits_purchased: number;
  total_credits_used: number;
  account_tier: string;
  created_at: string;
  project_count: number;
  roles: string[];
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [creditDialog, setCreditDialog] = useState<{
    open: boolean; user: UserRecord | null; amount: string; reason: string;
  }>({ open: false, user: null, amount: "", reason: "" });

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_users", {
        p_limit: 100, p_offset: 0, p_search: userSearch || null,
      });
      if (error) throw error;
      setUsers((data || []) as UserRecord[]);
    } catch { toast.error("Failed to load users"); }
    finally { setUsersLoading(false); }
  }, [userSearch]);

  useEffect(() => { fetchUsers(); }, []);

  const handleAdjustCredits = async () => {
    if (!creditDialog.user || !creditDialog.amount || !creditDialog.reason) {
      toast.error("Please fill in all fields"); return;
    }
    const amount = parseInt(creditDialog.amount, 10);
    if (isNaN(amount) || amount === 0) { toast.error("Enter a valid amount"); return; }
    try {
      const { error } = await supabase.rpc("admin_adjust_credits" as any, {
        p_target_user_id: creditDialog.user.id, p_amount: amount, p_reason: creditDialog.reason,
      });
      if (error) throw error;
      toast.success(`Credits ${amount >= 0 ? "added" : "deducted"} successfully`);
      setCreditDialog({ open: false, user: null, amount: "", reason: "" });
      fetchUsers();
    } catch { toast.error("Failed to adjust credits"); }
  };

  const handleToggleAdminRole = async (targetUser: UserRecord) => {
    const hasAdmin = targetUser.roles?.includes("admin");
    const action = hasAdmin ? "revoke" : "grant";
    if (targetUser.id === user?.id && action === "revoke") {
      toast.error("You cannot remove your own admin role"); return;
    }
    try {
      const { error } = await supabase.rpc("admin_manage_role", {
        p_target_user_id: targetUser.id, p_role: "admin" as any, p_action: action,
      });
      if (error) throw error;
      toast.success(`Admin role ${action === "grant" ? "granted" : "revoked"}`);
      fetchUsers();
    } catch { toast.error("Failed to manage role"); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <Input
            placeholder="Search users..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
            className="pl-9 h-9 text-sm bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20"
          />
        </div>
        <Button onClick={fetchUsers} variant="ghost" size="sm" disabled={usersLoading} className="h-9 text-white/40">
          {usersLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        </Button>
      </div>

      <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider">User</th>
                <th className="text-right py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Credits</th>
                <th className="text-center py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Projects</th>
                <th className="text-center py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Tier</th>
                <th className="text-center py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Roles</th>
                <th className="text-right py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium text-white">{u.display_name || u.full_name || "Unknown"}</p>
                    <p className="text-xs text-white/30">{u.email}</p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-mono text-sm text-white/70">{u.credits_balance?.toLocaleString()}</span>
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-white/40">{u.project_count}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="secondary" className="text-[10px] font-medium bg-white/[0.04] text-white/50 border-white/[0.06]">{u.account_tier}</Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {u.roles?.includes("admin") && (
                      <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px]">
                        <Crown className="w-2.5 h-2.5 mr-1" />Admin
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-white/30 hover:text-white/60"
                        onClick={() => setCreditDialog({ open: true, user: u, amount: "", reason: "" })} title="Adjust Credits">
                        <Coins className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant={u.roles?.includes("admin") ? "destructive" : "ghost"}
                        className="h-7 w-7 p-0" onClick={() => handleToggleAdminRole(u)}
                        title={u.roles?.includes("admin") ? "Revoke Admin" : "Grant Admin"}>
                        <UserCog className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-warning hover:text-warning hover:bg-warning/10"
                        title="Force Logout"
                        onClick={async () => {
                          if (!confirm(`Force logout ${u.display_name || u.email}?`)) return;
                          try {
                            const { error } = await supabase.rpc("admin_force_logout_user", { p_target_user_id: u.id });
                            if (error) throw error;
                            toast.success(`${u.display_name || u.email} logged out`);
                          } catch { toast.error("Failed to force logout"); }
                        }}>
                        <Shield className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && !usersLoading && (
            <div className="text-center py-16 text-white/30 text-sm">No users found</div>
          )}
        </div>
      </div>

      {/* Credit Adjustment Dialog */}
      <Dialog open={creditDialog.open} onOpenChange={(open) => !open && setCreditDialog({ open: false, user: null, amount: "", reason: "" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Adjust Credits</DialogTitle>
            <DialogDescription className="text-xs">
              {creditDialog.user?.display_name || creditDialog.user?.email} — Balance: <strong>{creditDialog.user?.credits_balance?.toLocaleString()}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="flex items-center gap-2">
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                onClick={() => setCreditDialog(prev => ({ ...prev, amount: String(Math.abs(parseInt(prev.amount) || 0) * -1) }))}>
                <Minus className="w-4 h-4" />
              </Button>
              <Input type="number" placeholder="Amount" value={creditDialog.amount}
                onChange={(e) => setCreditDialog(prev => ({ ...prev, amount: e.target.value }))} className="flex-1 h-9 text-sm" />
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                onClick={() => setCreditDialog(prev => ({ ...prev, amount: String(Math.abs(parseInt(prev.amount) || 0)) }))}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <Input placeholder="Reason for adjustment..." value={creditDialog.reason}
              onChange={(e) => setCreditDialog(prev => ({ ...prev, reason: e.target.value }))} className="h-9 text-sm" />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreditDialog({ open: false, user: null, amount: "", reason: "" })}>Cancel</Button>
            <Button size="sm" onClick={handleAdjustCredits}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
