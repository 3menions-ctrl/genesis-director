/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminGdprPage() {
  return (
    <AdminPageShell
      eyebrow="07 // ACCESS"
      code="GDP"
      title="GDPR"
      italic="Console."
      description="Per-user data export, right-to-erasure, and processor inventory with audit trail."
    >
      <AdminConsoleScaffold
        intro="Honour DSAR requests in minutes, not weeks — every export is signed and every erasure is verifiable."
        status="scoped"
        signals={[
        { label: "Open DSARs", value: "—", tone: "amber" },
        { label: "Avg Turnaround", value: "—", tone: "blue", trend: "hours" },
        { label: "Erasures (30d)", value: "—", tone: "rose" },
        { label: "Processors", value: "—", tone: "neutral" },
        ]}
        capabilities={[
    { icon: FileArchive, title: "Data Export", description: "Single-click bundle of all PII for any user.", status: "queued" },
    { icon: Trash2, title: "Right to Erasure", description: "Cascading hard-delete with anonymized financial trail.", status: "wired" },
    { icon: FileSignature, title: "Signed Receipts", description: "Every action returns a tamper-proof PDF.", status: "manual" },
    { icon: Network, title: "Processor Map", description: "Inventory of every downstream subprocessor.", status: "manual" },
    { icon: Clock, title: "SLA Timer", description: "Countdown to statutory response deadline.", status: "manual" },
    { icon: History, title: "Request Log", description: "Full history of every DSAR with status.", status: "wired" },
        ]}
      primaryCta={{ label: "New DSAR request" }}
      />
    </AdminPageShell>
  );
}
