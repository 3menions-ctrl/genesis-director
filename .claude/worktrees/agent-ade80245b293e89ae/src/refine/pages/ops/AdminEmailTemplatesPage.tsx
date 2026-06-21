/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminEmailTemplatesPage() {
  return (
    <AdminPageShell
      eyebrow="09 // COMMS"
      code="TPL"
      title="Email"
      italic="Template Editor."
      description="WYSIWYG editor for transactional and auth email templates with live preview."
    >
      <AdminConsoleScaffold
        intro="Author every system email visually — preview against real users, push to production with audit."
        status="scoped"
        signals={[
        { label: "Templates", value: "—", tone: "blue" },
        { label: "Drafts", value: "—", tone: "amber" },
        { label: "Sent 24h", value: "—", tone: "emerald" },
        { label: "Open Rate", value: "—", tone: "neutral" },
        ]}
        capabilities={[
    { icon: Mail, title: "Template Library", description: "Auth, transactional, and lifecycle templates.", status: "queued" },
    { icon: Pencil, title: "WYSIWYG Editor", description: "Block-based editor with brand tokens.", status: "queued" },
    { icon: Eye, title: "Live Preview", description: "Render with real user variables.", status: "manual" },
    { icon: FlaskConical, title: "Send Test", description: "Fire to your own inbox with one click.", status: "manual" },
    { icon: BarChart3, title: "Per-Template Metrics", description: "Open / click / bounce rates per template.", status: "manual" },
    { icon: History, title: "Version History", description: "Roll back to any prior template version.", status: "manual" },
        ]}
      primaryCta={{ label: "New template" }}
      />
    </AdminPageShell>
  );
}
