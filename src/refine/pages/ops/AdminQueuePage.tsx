/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminQueuePage() {
  return (
    <AdminPageShell
      eyebrow="06 // OPS"
      code="QUE"
      title="Queue"
      italic="Depth."
      description="Pending video tasks, watchdog backlog, mutex holders, and realtime channel saturation."
    >
      <AdminConsoleScaffold
        intro="The thermometer for the entire generation pipeline — depth, lag, and stuck workers exposed in one rail."
        status="scoped"
        signals={[
        { label: "Pending Tasks", value: "—", tone: "amber" },
        { label: "Mutex Held", value: "—", tone: "blue" },
        { label: "Watchdog Lag", value: "—", tone: "rose", trend: "seconds" },
        { label: "Realtime Subs", value: "—", tone: "emerald" },
        ]}
        capabilities={[
    { icon: ListOrdered, title: "Pending Tasks", description: "Queue inspector for pending_video_tasks with re-enqueue.", status: "wired" },
    { icon: Lock, title: "Mutex Registry", description: "Active 180s pipeline locks with manual release option.", status: "wired" },
    { icon: Radio, title: "Realtime Channels", description: "Connected sockets per channel with bandwidth meter.", status: "queued" },
    { icon: RefreshCw, title: "Force Re-poll", description: "Trigger watchdog re-polling for stuck Replicate IDs.", status: "wired" },
    { icon: AlertTriangle, title: "Stuck Detector", description: "Auto-flags tasks exceeding expected wallclock.", status: "queued" },
    { icon: TrendingUp, title: "Throughput Trend", description: "Tasks-per-minute over rolling windows.", status: "manual" },
        ]}
      primaryCta={{ label: "Open queue inspector" }}
      />
    </AdminPageShell>
  );
}
