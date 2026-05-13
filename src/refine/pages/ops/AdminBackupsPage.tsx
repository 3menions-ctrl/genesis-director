/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminBackupsPage() {
  return (
    <AdminPageShell
      eyebrow="06 // OPS"
      code="BKP"
      title="Backups"
      italic="& Restore."
      description="Database snapshot browser, on-demand restore, and retention policy editor."
    >
      <AdminConsoleScaffold
        intro="Zero-downtime snapshots, point-in-time recovery, and one-click restores into staging."
        status="scoped"
        signals={[
        { label: "Latest Snapshot", value: "—", tone: "emerald", trend: "auto" },
        { label: "Retention", value: "30d", tone: "blue" },
        { label: "Restore Targets", value: "2", tone: "neutral" },
        { label: "Last Verify", value: "—", tone: "amber" },
        ]}
        capabilities={[
    { icon: Database, title: "Snapshot Browser", description: "List daily + on-demand snapshots with size & WAL offset.", status: "wired" },
    { icon: Clock, title: "Point-in-Time", description: "Restore to any second within retention window.", status: "manual" },
    { icon: Beaker, title: "Staging Restore", description: "Spin up a parallel DB from any snapshot for testing.", status: "manual" },
    { icon: Shield, title: "Verify Hashes", description: "Routine SHA verification with alert on mismatch.", status: "manual" },
    { icon: FileDown, title: "Export Snapshot", description: "Download SQL dump or attach to another project.", status: "manual" },
    { icon: Settings2, title: "Retention Policy", description: "Tune daily/weekly/monthly retention windows.", status: "manual" },
        ]}
      primaryCta={{ label: "Take snapshot now" }}
      />
    </AdminPageShell>
  );
}
