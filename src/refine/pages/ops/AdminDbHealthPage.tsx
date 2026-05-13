/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminDbHealthPage() {
  return (
    <AdminPageShell
      eyebrow="05 // SYSTEM"
      code="DB"
      title="Database"
      italic="Health."
      description="Slow query log, RLS coverage report, migration history, and dead tuple monitor."
    >
      <AdminConsoleScaffold
        intro="The vital-signs panel for the database — slow queries, missing RLS, bloated tables, all in one rail."
        status="scoped"
        signals={[
        { label: "Connections", value: "—", tone: "blue" },
        { label: "Slow Queries", value: "—", tone: "amber" },
        { label: "RLS Coverage", value: "—", tone: "emerald", trend: "%" },
        { label: "Dead Tuples", value: "—", tone: "rose" },
        ]}
        capabilities={[
    { icon: Database, title: "Slow Query Log", description: "Top-N queries by p99 latency.", status: "queued" },
    { icon: ShieldCheck, title: "RLS Coverage", description: "Tables missing or with permissive policies.", status: "manual" },
    { icon: GitCommit, title: "Migration History", description: "Every migration with rollback preview.", status: "manual" },
    { icon: Trash2, title: "Dead Tuple Monitor", description: "Tables overdue for VACUUM with bloat ratio.", status: "manual" },
    { icon: Activity, title: "Connection Pool", description: "Live connection map with idle timeouts.", status: "manual" },
    { icon: FlaskConical, title: "EXPLAIN Helper", description: "Paste a query, see the plan and indexes.", status: "manual" },
        ]}
      primaryCta={{ label: "Run health scan" }}
      />
    </AdminPageShell>
  );
}
