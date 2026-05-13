/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminExperimentsPage() {
  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="AB"
      title="A/B"
      italic="Experiments."
      description="Variant manager with assignment, exposure logging, and statistical significance."
    >
      <AdminConsoleScaffold
        intro="Ship fast, learn faster — every experiment auto-stops at significance and reports lift."
        status="scoped"
        signals={[
        { label: "Running", value: "—", tone: "blue" },
        { label: "Subjects", value: "—", tone: "neutral" },
        { label: "Wins (30d)", value: "—", tone: "emerald" },
        { label: "Avg Power", value: "—", tone: "amber", trend: "%" },
        ]}
        capabilities={[
    { icon: FlaskConical, title: "Variant Builder", description: "JSON variant schema with safe defaults.", status: "queued" },
    { icon: Users, title: "Audience Targeting", description: "Cohort + tier + geo eligibility rules.", status: "manual" },
    { icon: BarChart3, title: "Significance Engine", description: "Bayesian or frequentist analysis.", status: "manual" },
    { icon: StopCircle, title: "Auto-Stop Guard", description: "Halt on harm or once significance reached.", status: "manual" },
    { icon: GitMerge, title: "Promote Winner", description: "Roll the winning variant to 100% with audit.", status: "manual" },
    { icon: History, title: "Experiment Archive", description: "Every past test with results retained.", status: "wired" },
        ]}
      primaryCta={{ label: "New experiment" }}
      />
    </AdminPageShell>
  );
}
