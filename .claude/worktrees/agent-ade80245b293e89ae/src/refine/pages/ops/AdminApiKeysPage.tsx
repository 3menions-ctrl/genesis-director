/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminApiKeysPage() {
  return (
    <AdminPageShell
      eyebrow="05 // SYSTEM"
      code="API"
      title="API"
      italic="Keys."
      description="Issue, scope, and rotate service API keys with per-key audit trail."
    >
      <AdminConsoleScaffold
        intro="Every service-to-service token in one vault — scoped, revocable, rotated on schedule."
        status="scoped"
        signals={[
        { label: "Active Keys", value: "—", tone: "blue" },
        { label: "Rotated 30d", value: "—", tone: "emerald" },
        { label: "Stale > 90d", value: "—", tone: "amber" },
        { label: "Revoked", value: "—", tone: "rose" },
        ]}
        capabilities={[
    { icon: KeyRound, title: "Key Issuance", description: "Mint scoped keys with TTL and label.", status: "queued" },
    { icon: Shield, title: "Scope Editor", description: "Limit by route, RPC, or resource pattern.", status: "manual" },
    { icon: RefreshCw, title: "Rotation Schedule", description: "Auto-rotate every N days with overlap window.", status: "manual" },
    { icon: AlertTriangle, title: "Usage Anomaly", description: "Flag spikes or unusual ASN origin.", status: "manual" },
    { icon: Trash2, title: "Instant Revoke", description: "Hard kill in <1s with audit entry.", status: "wired" },
    { icon: History, title: "Audit Log", description: "Every issue / revoke / rotate captured.", status: "wired" },
        ]}
      primaryCta={{ label: "Issue key" }}
      />
    </AdminPageShell>
  );
}
