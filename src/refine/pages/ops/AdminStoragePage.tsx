/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminStoragePage() {
  return (
    <AdminPageShell
      eyebrow="04 // CONTENT"
      code="STG"
      title="Asset"
      italic="Storage."
      description="Bucket browser, usage telemetry, orphan scanner, and bulk purge."
    >
      <AdminConsoleScaffold
        intro="Every byte of generated media — visible, attributable, and purgeable when it overstays."
        status="scoped"
        signals={[
        { label: "Total Storage", value: "—", tone: "blue", trend: "GB" },
        { label: "Buckets", value: "—", tone: "neutral" },
        { label: "Orphans", value: "—", tone: "rose" },
        { label: "Cost / mo", value: "—", tone: "amber" },
        ]}
        capabilities={[
    { icon: Folder, title: "Bucket Browser", description: "Drill into every Supabase storage bucket.", status: "queued" },
    { icon: Search, title: "Orphan Scanner", description: "Detect files with no DB row reference.", status: "manual" },
    { icon: Trash2, title: "Bulk Purge", description: "Delete orphans with double-confirm + audit.", status: "manual" },
    { icon: FileBarChart, title: "Per-User Usage", description: "Top consumers by tier and project.", status: "manual" },
    { icon: DollarSign, title: "Cost Estimator", description: "Monthly storage cost projection.", status: "manual" },
    { icon: Lock, title: "Policy Editor", description: "Tune RLS on each bucket with diff preview.", status: "manual" },
        ]}
      primaryCta={{ label: "Scan for orphans" }}
      />
    </AdminPageShell>
  );
}
