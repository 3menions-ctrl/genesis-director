/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminCohortsPage() {
  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="COH"
      title="Cohorts"
      italic="& Segments."
      description="Saved user segments for campaigns, exports, and experiment targeting."
    >
      <AdminConsoleScaffold
        intro="Define a cohort once, target it everywhere — emails, experiments, exports, dashboards."
        status="scoped"
        signals={[
        { label: "Saved Segments", value: "—", tone: "blue" },
        { label: "Live Members", value: "—", tone: "emerald" },
        { label: "Synced (24h)", value: "—", tone: "amber" },
        { label: "Exports", value: "—", tone: "neutral" },
        ]}
        capabilities={[
    { icon: Filter, title: "Visual Builder", description: "Drag-and-drop predicate editor.", status: "queued" },
    { icon: RefreshCw, title: "Live Sync", description: "Membership recomputed in near-realtime.", status: "manual" },
    { icon: Megaphone, title: "Use in Comms", description: "Drop a cohort into email or notification target.", status: "manual" },
    { icon: FlaskConical, title: "Use in Experiments", description: "Restrict A/B exposure to a cohort.", status: "manual" },
    { icon: Download, title: "CSV Export", description: "Stream segment members to CSV or webhook.", status: "manual" },
    { icon: History, title: "Audit Trail", description: "Who edited which segment, and when.", status: "wired" },
        ]}
      primaryCta={{ label: "New segment" }}
      />
    </AdminPageShell>
  );
}
