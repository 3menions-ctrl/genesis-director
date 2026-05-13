/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminRefundsPage() {
  return (
    <AdminPageShell
      eyebrow="03 // MONEY"
      code="REF"
      title="Refunds"
      italic="Workflow."
      description="Inbound refund requests with one-click Stripe refund + atomic credit reversal."
    >
      <AdminConsoleScaffold
        intro="Triage every refund request, reverse the Stripe charge, and unwind credits — all with full audit."
        status="scoped"
        signals={[
        { label: "Pending", value: "—", tone: "amber" },
        { label: "Refunded 30d", value: "—", tone: "rose" },
        { label: "Total $ 30d", value: "—", tone: "blue" },
        { label: "Avg SLA", value: "—", tone: "emerald", trend: "hours" },
        ]}
        capabilities={[
    { icon: Inbox, title: "Request Queue", description: "Inbound refund requests with severity tagging.", status: "queued" },
    { icon: RotateCcw, title: "One-Click Stripe", description: "Atomic Stripe refund + credit reversal RPC.", status: "wired" },
    { icon: FileSignature, title: "Reason Codes", description: "Standardized refund reason taxonomy.", status: "manual" },
    { icon: AlertTriangle, title: "Fraud Flags", description: "Auto-flag suspicious refund velocity.", status: "manual" },
    { icon: MailCheck, title: "Customer Email", description: "Templated refund confirmation + receipt.", status: "manual" },
    { icon: DollarSign, title: "Partial Refunds", description: "Pro-rata refund with credit recompute.", status: "manual" },
        ]}
      primaryCta={{ label: "Process refund" }}
      />
    </AdminPageShell>
  );
}
