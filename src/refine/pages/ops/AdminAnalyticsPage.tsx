/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminAnalyticsPage() {
  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="ANL"
      title="Analytics"
      italic="Deep-Dive."
      description="DAU/WAU/MAU, retention cohorts, conversion funnels, and signup→render time-to-value."
    >
      <AdminConsoleScaffold
        intro="The full product analytics surface — every cohort, every funnel, every retention curve."
        status="scoped"
        signals={[
        { label: "DAU", value: "—", tone: "blue" },
        { label: "WAU", value: "—", tone: "emerald" },
        { label: "MAU", value: "—", tone: "amber" },
        { label: "TTV (median)", value: "—", tone: "neutral", trend: "min" },
        ]}
        capabilities={[
    { icon: Activity, title: "Active Users", description: "DAU/WAU/MAU with stickiness ratio.", status: "queued" },
    { icon: LineChart, title: "Retention Curve", description: "N-day cohort retention with breakouts.", status: "queued" },
    { icon: GitBranch, title: "Funnels", description: "Multi-step funnels with drop-off heatmap.", status: "manual" },
    { icon: Clock, title: "Time-to-Value", description: "Signup → first completed render distribution.", status: "manual" },
    { icon: PieChart, title: "Tier Mix", description: "Personal vs Business vs Enterprise revenue split.", status: "manual" },
    { icon: Download, title: "Report Builder", description: "Save and schedule custom reports.", status: "manual" },
        ]}
      primaryCta={{ label: "Build report" }}
      />
    </AdminPageShell>
  );
}
