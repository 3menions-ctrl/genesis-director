/**
 * Admin Users Page — User management with search, credit adjustment, role management.
 * Extracted from Admin.tsx users tab.
 */
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmAsync } from "@/components/ui/global-confirm";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, Loader2, Coins, UserCog, Shield, Crown, Plus, Minus, ArrowRight, UserMinus, UserCheck, BarChart3 } from "lucide-react";
import { UserAnalyticsSheet } from "../components/UserAnalyticsSheet";
import { Link } from "react-router-dom";
import { AdminPageShell, AdminEmptyState } from "../components/AdminPageShell";
import { FloatSection, FloatTable, StatusPill, DeckButton } from "@/admin/ui/primitives";
import { Users as UsersIcon } from "lucide-react";
import { BulkActionBar, BulkActionButton } from "../components/BulkActionBar";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [analyticsUser, setAnalyticsUser] = useState<{ id: string; label: string } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkGrantOpen, setBulkGrantOpen] = useState(false);
  const [bulkGrantAmount, setBulkGrantAmount] = useState("");
  const [bulkGrantReason, setBulkGrantReason] = useState("");

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

  const totalCredits = users.reduce((s, u) => s + (u.credits_balance || 0), 0);
  const adminCount = users.filter(u => u.roles?.includes("admin")).length;
  // Paid tiers are everything above 'free' (account_tier ∈ free|pro|growth|agency|enterprise).
  // The old check compared tier to "personal" — an account_TYPE value no tier ever holds — so it
  // counted every user as Pro.
  const proCount = users.filter(u => (u.account_tier || "free").toLowerCase() !== "free").length;

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === users.length) return new Set();
      return new Set(users.map((u) => u.id));
    });
  };
  const clearSelection = () => setSelected(new Set());

  const runBulkGrant = async () => {
    const amt = parseInt(bulkGrantAmount, 10);
    if (!amt || amt <= 0) { toast.error("Enter a positive amount"); return; }
    if (!bulkGrantReason.trim()) { toast.error("Reason required"); return; }
    setBulkBusy(true);
    try {
      const { data, error } = await supabase.rpc("admin_bulk_grant_credits" as never, {
        p_user_ids: Array.from(selected),
        p_amount: amt,
        p_reason: bulkGrantReason.trim(),
      } as never);
      if (error) throw error;
      const out = data as unknown as { count?: number };
      toast.success(`Granted ${amt} credits to ${out?.count ?? selected.size} users`);
      setBulkGrantOpen(false);
      setBulkGrantAmount(""); setBulkGrantReason("");
      clearSelection();
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk grant failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkSuspend = async () => {
    if (!(await confirmAsync({
      title: `Suspend ${selected.size} user(s)?`,
      description: "Admins and your own account are skipped automatically.",
      confirmLabel: "Suspend",
      destructive: true,
    }))) return;
    setBulkBusy(true);
    try {
      const { data, error } = await supabase.rpc("admin_bulk_suspend" as never, {
        p_user_ids: Array.from(selected),
        p_reason: "Bulk suspend via admin console",
      } as never);
      if (error) throw error;
      const out = data as unknown as { count?: number };
      toast.success(`${out?.count ?? selected.size} user(s) suspended`);
      clearSelection();
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk suspend failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkRestore = async () => {
    setBulkBusy(true);
    try {
      const { data, error } = await supabase.rpc("admin_bulk_restore" as never, {
        p_user_ids: Array.from(selected),
      } as never);
      if (error) throw error;
      const out = data as unknown as { count?: number };
      toast.success(`${out?.count ?? selected.size} user(s) restored`);
      clearSelection();
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk restore failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const exportSelectedCsv = () => {
    const rows = users.filter((u) => selected.has(u.id));
    const header = ["id", "email", "display_name", "credits_balance", "account_tier", "roles"].join(",");
    const lines = rows.map((u) => [
      u.id, u.email, u.display_name, u.credits_balance, u.account_tier,
      (u.roles ?? []).join("|"),
    ].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} user(s)`);
  };

  return (
    <AdminPageShell
      eyebrow="02 // PEOPLE"
      code="IDN"
      title="Identity"
      italic="Roster."
      description="Every authenticated principal across the platform — credits, tier, roles, and project footprint."
      actions={
        <DeckButton onClick={fetchUsers} disabled={usersLoading}>
          {usersLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          Search
        </DeckButton>
      }
      stats={[
        { label: "Operators", value: users.length.toLocaleString(), tone: "blue", sub: "indexed" },
        { label: "Credits Held", value: totalCredits.toLocaleString(), tone: "neutral", sub: "balance Σ" },
        { label: "Pro Tier", value: proCount.toLocaleString(), tone: "emerald", sub: "non-personal" },
        { label: "Admins", value: adminCount.toLocaleString(), tone: "amber", sub: "elevated" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
              className="pl-9 h-9 text-sm bg-glass border-white/[0.06] text-white placeholder:text-white/20"
            />
          </div>
        </div>

        <FloatSection title="Roster" meta={`${users.length} indexed`}>
          {users.length === 0 && !usersLoading ? (
            <AdminEmptyState
              code="IDN"
              icon={UsersIcon}
              title="No principals match this query"
              hint="Adjust your search term or clear it to surface every authenticated operator across the membrane."
            />
          ) : (
            <div className="overflow-x-auto">
              <FloatTable
                columns={[
                  {
                    key: "select",
                    className: "w-10",
                    label: (
                      <input
                        type="checkbox"
                        checked={users.length > 0 && selected.size === users.length}
                        onChange={toggleAll}
                        aria-label="Select all users"
                        className="w-3.5 h-3.5 rounded border border-white/20 bg-transparent accent-[#0A84FF] cursor-pointer"
                      />
                    ),
                  },
                  { key: "user", label: "User" },
                  { key: "credits", label: "Credits", align: "right" },
                  { key: "projects", label: "Projects", align: "right" },
                  { key: "tier", label: "Tier" },
                  { key: "roles", label: "Roles" },
                  { key: "actions", label: "Actions", align: "right" },
                ]}
                rows={users.map((u) => ({
                  _key: u.id,
                  select: (
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggleOne(u.id)}
                      aria-label={`Select ${u.email}`}
                      className="w-3.5 h-3.5 rounded border border-white/20 bg-transparent accent-[#0A84FF] cursor-pointer"
                    />
                  ),
                  user: (
                    <div>
                      <p className="text-sm font-medium text-white">{u.display_name || u.full_name || "Unknown"}</p>
                      <p className="text-xs text-white/30">{u.email}</p>
                    </div>
                  ),
                  credits: <span className="font-mono text-sm text-white/70">{u.credits_balance?.toLocaleString()}</span>,
                  projects: <span className="text-sm text-white/40">{u.project_count}</span>,
                  tier: <StatusPill>{u.account_tier}</StatusPill>,
                  roles: u.roles?.includes("admin") ? (
                    <StatusPill tone="accent"><Crown className="w-2.5 h-2.5" />Admin</StatusPill>
                  ) : null,
                  actions: (
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
                          if (!(await confirmAsync({
                            title: `Force logout ${u.display_name || u.email}?`,
                            confirmLabel: "Force Logout",
                            destructive: true,
                          }))) return;
                          try {
                            const { error } = await supabase.functions.invoke('admin-force-logout', {
                              body: { scope: 'user', target_user_id: u.id },
                            });
                            if (error) throw error;
                            toast.success(`${u.display_name || u.email} logged out`);
                          } catch { toast.error("Failed to force logout"); }
                        }}>
                        <Shield className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-white/30 hover:text-white/60" title="User analytics"
                        onClick={() => setAnalyticsUser({ id: u.id, label: u.display_name || u.email })}>
                        <BarChart3 className="w-3.5 h-3.5" />
                      </Button>
                      {/* Manage — opens the full user detail page where suspend / delete /
                          force-verify / impersonation-link live with full guards. */}
                      <Link
                        to={`/admin/users/${u.id}`}
                        title="Manage user"
                        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[hsl(214_90%_62%)] hover:bg-[hsl(214_90%_62%/0.16)] transition-colors"
                      >
                        Manage <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ),
                }))}
              />
            </div>
          )}
        </FloatSection>

        {/* Bulk action bar — only when rows selected */}
        <BulkActionBar
          count={selected.size}
          itemNoun="user"
          onClear={clearSelection}
        >
          <BulkActionButton
            icon={Coins}
            label="Grant credits"
            tone="blue"
            onClick={() => setBulkGrantOpen(true)}
            disabled={bulkBusy}
          />
          <BulkActionButton
            icon={UserMinus}
            label="Suspend"
            tone="rose"
            onClick={runBulkSuspend}
            disabled={bulkBusy}
          />
          <BulkActionButton
            icon={UserCheck}
            label="Restore"
            onClick={runBulkRestore}
            disabled={bulkBusy}
          />
          <BulkActionButton
            icon={Plus}
            label="Export CSV"
            onClick={exportSelectedCsv}
            disabled={bulkBusy}
          />
        </BulkActionBar>

        {/* Bulk grant dialog */}
        <Dialog open={bulkGrantOpen} onOpenChange={setBulkGrantOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Bulk grant credits</DialogTitle>
              <DialogDescription className="text-xs">
                Granting to <strong>{selected.size}</strong> selected user{selected.size === 1 ? "" : "s"}. Cap is 10,000 per grant.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <Input
                type="number"
                placeholder="Amount per user"
                value={bulkGrantAmount}
                onChange={(e) => setBulkGrantAmount(e.target.value)}
                className="h-9 text-sm"
              />
              <Input
                placeholder="Reason (audited)"
                value={bulkGrantReason}
                onChange={(e) => setBulkGrantReason(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setBulkGrantOpen(false)} disabled={bulkBusy}>Cancel</Button>
              <Button size="sm" onClick={runBulkGrant} disabled={bulkBusy}>
                {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Grant"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
      <UserAnalyticsSheet userId={analyticsUser?.id ?? null} label={analyticsUser?.label} open={!!analyticsUser} onClose={() => setAnalyticsUser(null)} />
    </AdminPageShell>
  );
}
