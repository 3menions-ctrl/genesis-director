/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminRolesPage() {
  return (
    <AdminPageShell
      eyebrow="07 // ACCESS"
      code="RLS"
      title="Roles"
      italic="& Permissions."
      description="Granular RBAC editor — define roles, scope permissions, attach to operators."
    >
      <AdminConsoleScaffold
        intro="Replace the binary admin flag with composable roles and per-resource grants."
        status="scoped"
        signals={[
        { label: "Roles", value: "—", tone: "blue" },
        { label: "Permissions", value: "—", tone: "neutral" },
        { label: "Assignments", value: "—", tone: "emerald" },
        { label: "Scoped Keys", value: "—", tone: "amber" },
        ]}
        capabilities={[
    { icon: KeySquare, title: "Role Builder", description: "Compose roles from atomic permission grants.", status: "queued" },
    { icon: UserCog, title: "Assignment Matrix", description: "User × role grid with bulk apply / revoke.", status: "queued" },
    { icon: FileLock, title: "Resource Scopes", description: "Limit grants by table, function, or tenant.", status: "manual" },
    { icon: History, title: "Grant History", description: "Audit trail of every role assignment change.", status: "wired" },
    { icon: AlertTriangle, title: "Privilege Drift", description: "Detect operators with unused or excess grants.", status: "manual" },
    { icon: Copy, title: "Role Templates", description: "Pre-built roles: Support, Finance, Engineering.", status: "manual" },
        ]}
      primaryCta={{ label: "Create role" }}
      />
    </AdminPageShell>
  );
}
