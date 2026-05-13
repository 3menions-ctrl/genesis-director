/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminContentSafetyPage() {
  return (
    <AdminPageShell
      eyebrow="04 // CONTENT"
      code="SAF"
      title="Content"
      italic="Safety."
      description="Tune the multi-layer NSFW phrase blocker, severity gates, and allow-list."
    >
      <AdminConsoleScaffold
        intro="Calibrate the moderation engine — every tweak diffed and reversible."
        status="scoped"
        signals={[
        { label: "Block List", value: "—", tone: "rose" },
        { label: "Allow List", value: "—", tone: "emerald" },
        { label: "Tier Levels", value: "3", tone: "blue" },
        { label: "Hits 24h", value: "—", tone: "amber" },
        ]}
        capabilities={[
    { icon: FileX, title: "Phrase Block List", description: "Add / remove blocked phrases with severity.", status: "queued" },
    { icon: FileCheck, title: "Allow List", description: "Whitelist phrases that look risky but aren't.", status: "manual" },
    { icon: Sliders, title: "Severity Gates", description: "Tune the threshold per surface (Create, Edit).", status: "manual" },
    { icon: BarChart3, title: "Hit Telemetry", description: "How often each rule fires + drift over time.", status: "manual" },
    { icon: FlaskConical, title: "Test Bench", description: "Paste a script, see what would trigger.", status: "manual" },
    { icon: History, title: "Change Log", description: "Every safety rule mutation captured.", status: "wired" },
        ]}
      primaryCta={{ label: "Add rule" }}
      />
    </AdminPageShell>
  );
}
