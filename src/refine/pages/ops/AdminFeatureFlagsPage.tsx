/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminFeatureFlagsPage() {
  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="FLG"
      title="Feature"
      italic="Flags."
      description="Runtime toggles, gradual rollout per tier or cohort, and kill switches."
    >
      <AdminConsoleScaffold
        intro="Decouple deploy from release — flip a flag in seconds, target a cohort, kill on incident."
        status="scoped"
        signals={[
        { label: "Active Flags", value: "—", tone: "blue" },
        { label: "Rollouts", value: "—", tone: "emerald" },
        { label: "Kill Switches", value: "—", tone: "rose" },
        { label: "Stale > 90d", value: "—", tone: "amber" },
        ]}
        capabilities={[
    { icon: ToggleRight, title: "Flag Registry", description: "Boolean, percentage, and JSON variant flags.", status: "queued" },
    { icon: Users, title: "Cohort Targeting", description: "Per-cohort, per-tier, or per-user overrides.", status: "manual" },
    { icon: Power, title: "Kill Switch", description: "One-click disable on incident with audit.", status: "manual" },
    { icon: History, title: "Change Log", description: "Every flag flip captured immutably.", status: "wired" },
    { icon: AlertTriangle, title: "Stale Detector", description: "Surface flags rolled to 100% awaiting cleanup.", status: "manual" },
    { icon: BookOpen, title: "SDK Reference", description: "Copy-paste snippets for client + edge usage.", status: "manual" },
        ]}
      primaryCta={{ label: "Create flag" }}
      />
    </AdminPageShell>
  );
}
