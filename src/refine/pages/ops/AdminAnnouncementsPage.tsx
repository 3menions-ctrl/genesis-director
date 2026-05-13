/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminAnnouncementsPage() {
  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="ANN"
      title="Announcements"
      italic="& Banners."
      description="Schedulable in-app banners, dismissible toasts, and global maintenance mode."
    >
      <AdminConsoleScaffold
        intro="Push targeted messages right into the product surface — schedule them, target them, kill them."
        status="scoped"
        signals={[
        { label: "Active Banners", value: "—", tone: "blue" },
        { label: "Scheduled", value: "—", tone: "amber" },
        { label: "Maintenance", value: "—", tone: "rose" },
        { label: "Impressions 7d", value: "—", tone: "emerald" },
        ]}
        capabilities={[
    { icon: Megaphone, title: "Banner Composer", description: "Rich text + CTA + dismiss policy.", status: "queued" },
    { icon: Calendar, title: "Schedule Window", description: "Activate / deactivate timestamps.", status: "manual" },
    { icon: Users, title: "Target Audience", description: "Show to tier, cohort, or geographic slice.", status: "manual" },
    { icon: AlertOctagon, title: "Maintenance Mode", description: "Lock the app behind a status page.", status: "manual" },
    { icon: BarChart3, title: "Impressions", description: "Per-banner views, clicks, dismissals.", status: "manual" },
    { icon: Pencil, title: "Inline Preview", description: "See exactly how it renders before publish.", status: "manual" },
        ]}
      primaryCta={{ label: "Compose banner" }}
      />
    </AdminPageShell>
  );
}
