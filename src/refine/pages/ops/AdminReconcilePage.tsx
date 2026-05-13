/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminReconcilePage() {
  return (
    <AdminPageShell
      eyebrow="03 // MONEY"
      code="REC"
      title="Stripe"
      italic="Reconciliation."
      description="Detect drift between local credit ledger and Stripe — every cent accounted."
    >
      <AdminConsoleScaffold
        intro="Run a delta against Stripe and see exactly which charges, refunds, or disputes diverge from the ledger."
        status="scoped"
        signals={[
        { label: "Drift Events", value: "—", tone: "rose" },
        { label: "Last Run", value: "—", tone: "blue" },
        { label: "Reconciled $", value: "—", tone: "emerald" },
        { label: "Variance", value: "—", tone: "amber", trend: "%" },
        ]}
        capabilities={[
    { icon: GitCompare, title: "Delta Detector", description: "Compare every charge with internal ledger row.", status: "queued" },
    { icon: Wrench, title: "Repair Console", description: "One-click fix for missing or duplicate entries.", status: "manual" },
    { icon: FileText, title: "Audit Pack", description: "Export the full reconciliation report.", status: "manual" },
    { icon: AlertCircle, title: "Dispute Tracker", description: "Surface chargebacks before they post.", status: "queued" },
    { icon: Calendar, title: "Schedule Run", description: "Cron-driven nightly reconciliation.", status: "manual" },
    { icon: BellRing, title: "Drift Alerts", description: "Email/Slack on any non-zero delta.", status: "manual" },
        ]}
      primaryCta={{ label: "Run reconcile now" }}
      />
    </AdminPageShell>
  );
}
