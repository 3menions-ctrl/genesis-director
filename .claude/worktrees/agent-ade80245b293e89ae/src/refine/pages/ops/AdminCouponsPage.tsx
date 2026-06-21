/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminCouponsPage() {
  return (
    <AdminPageShell
      eyebrow="03 // MONEY"
      code="CPN"
      title="Coupons"
      italic="& Promos."
      description="Issue, scope, and track promotional codes with redemption analytics."
    >
      <AdminConsoleScaffold
        intro="Mint single-use or evergreen codes, scope them by tier or channel, watch them convert."
        status="scoped"
        signals={[
        { label: "Active Codes", value: "—", tone: "blue" },
        { label: "Redemptions", value: "—", tone: "emerald" },
        { label: "Discount Σ", value: "—", tone: "amber" },
        { label: "Conv Rate", value: "—", tone: "neutral" },
        ]}
        capabilities={[
    { icon: Sparkles, title: "Code Generator", description: "Bulk-mint cryptographic codes with claim limits.", status: "queued" },
    { icon: Target, title: "Scope & Audience", description: "Limit by tier, region, channel, or user list.", status: "manual" },
    { icon: Calendar, title: "TTL Window", description: "Schedule activation and expiration windows.", status: "manual" },
    { icon: TrendingUp, title: "Conversion Rate", description: "Per-code redemption + downstream MRR lift.", status: "manual" },
    { icon: AlertCircle, title: "Abuse Guard", description: "Detect repeat redemption fingerprints.", status: "manual" },
    { icon: Download, title: "CSV Distribution", description: "Export ready-to-paste lists for partners.", status: "manual" },
        ]}
      primaryCta={{ label: "Mint codes" }}
      />
    </AdminPageShell>
  );
}
