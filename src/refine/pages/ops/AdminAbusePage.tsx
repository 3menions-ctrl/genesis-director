/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminAbusePage() {
  return (
    <AdminPageShell
      eyebrow="07 // ACCESS"
      code="ABS"
      title="Abuse"
      italic="Center."
      description="IP and email blocklist, velocity rules, and rate-limit overrides per principal."
    >
      <AdminConsoleScaffold
        intro="The wall between you and the bots — rules, lists, and surgical overrides for trusted partners."
        status="scoped"
        signals={[
        { label: "Blocked IPs", value: "—", tone: "rose" },
        { label: "Blocked Emails", value: "—", tone: "rose" },
        { label: "Rules Active", value: "—", tone: "blue" },
        { label: "Overrides", value: "—", tone: "amber" },
        ]}
        capabilities={[
    { icon: Ban, title: "IP Blocklist", description: "CIDR-aware blocklist with TTL and reason notes.", status: "queued" },
    { icon: MailX, title: "Email Blocklist", description: "Domain or address-level email rejection.", status: "queued" },
    { icon: Gauge, title: "Velocity Rules", description: "Per-route rate-limit DSL with backoff curves.", status: "manual" },
    { icon: UserCheck, title: "Trusted Partner", description: "Whitelist principals from rate limits with audit.", status: "manual" },
    { icon: Activity, title: "Heatmap", description: "Geographic origin of blocked attempts.", status: "manual" },
    { icon: History, title: "Block Log", description: "Every block with the rule that triggered it.", status: "wired" },
        ]}
      primaryCta={{ label: "Add block rule" }}
      />
    </AdminPageShell>
  );
}
