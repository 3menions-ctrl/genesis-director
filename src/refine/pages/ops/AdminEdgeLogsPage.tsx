/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminEdgeLogsPage() {
  return (
    <AdminPageShell
      eyebrow="06 // OPS"
      code="EDG"
      title="Edge"
      italic="Function Logs."
      description="Searchable invocation trace across every Supabase Edge Function — request, latency, status, payload digest."
    >
      <AdminConsoleScaffold
        intro="Live tail of every edge function invocation — surface 5xx clusters, slow tail latencies, and runaway loops in seconds."
        status="scoped"
        signals={[
        { label: "Invocations 24h", value: "—", tone: "blue" },
        { label: "Error Rate", value: "—", tone: "rose", trend: "5xx ratio" },
        { label: "p95 Latency", value: "—", tone: "amber", trend: "ms" },
        { label: "Cold Starts", value: "—", tone: "neutral" },
        ]}
        capabilities={[
    { icon: Terminal, title: "Live Tail", description: "Streaming edge logs with regex filter and severity gate.", status: "wired" },
    { icon: Activity, title: "Latency Heatmap", description: "Per-function p50/p95/p99 surfaced over rolling windows.", status: "queued" },
    { icon: AlertOctagon, title: "Error Cluster", description: "Auto-groups 5xx responses by stack signature.", status: "queued" },
    { icon: Cpu, title: "Cold Start Tracker", description: "Distinguishes warm vs cold invocations and their cost.", status: "manual" },
    { icon: Search, title: "Trace Drilldown", description: "Click any row to expand request/response/digest.", status: "wired" },
    { icon: Download, title: "Export CSV", description: "Range-bound export for offline triage.", status: "manual" },
        ]}
      primaryCta={{ label: "Open live tail" }}
      />
    </AdminPageShell>
  );
}
