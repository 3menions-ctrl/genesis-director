/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminCrashForensicsPage() {
  return (
    <AdminPageShell
      eyebrow="05 // SYSTEM"
      code="CRF"
      title="Crash"
      italic="Forensics."
      description="Surface the existing crash forensics memory — detected loops, suppressed errors, safe-mode triggers."
    >
      <AdminConsoleScaffold
        intro="What the watchdog sees but the user doesn't — every suppressed error and every loop the system stopped."
        status="scoped"
        signals={[
        { label: "Suppressed 24h", value: "—", tone: "amber" },
        { label: "Reload Loops", value: "—", tone: "rose" },
        { label: "Safe Mode Trips", value: "—", tone: "blue" },
        { label: "Patterns Tracked", value: "90+", tone: "emerald" },
        ]}
        capabilities={[
    { icon: Bug, title: "Suppressed Errors", description: "Live tail of every silenced non-fatal error.", status: "queued" },
    { icon: Repeat, title: "Loop Detector", description: "Reload cycles caught before they crash the SPA.", status: "queued" },
    { icon: ShieldAlert, title: "Safe Mode Log", description: "Every fall-back to safe mode with reason.", status: "manual" },
    { icon: Filter, title: "Pattern Catalog", description: "The 90+ patterns the watchdog suppresses.", status: "manual" },
    { icon: FlaskConical, title: "Replay Bench", description: "Re-emit a suppressed error for testing.", status: "manual" },
    { icon: History, title: "Forensic Trail", description: "Hour-by-hour resilience telemetry.", status: "wired" },
        ]}
      primaryCta={{ label: "Open forensic tail" }}
      />
    </AdminPageShell>
  );
}
