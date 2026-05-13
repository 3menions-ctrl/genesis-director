/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminWebhooksPage() {
  return (
    <AdminPageShell
      eyebrow="05 // SYSTEM"
      code="WHK"
      title="Webhooks"
      italic="Outbound."
      description="Registry of outbound webhooks with delivery logs, retry, and signed payloads."
    >
      <AdminConsoleScaffold
        intro="Push platform events into your customers' systems — reliably, with retry and verification."
        status="scoped"
        signals={[
        { label: "Endpoints", value: "—", tone: "blue" },
        { label: "Events 24h", value: "—", tone: "neutral" },
        { label: "Delivery %", value: "—", tone: "emerald" },
        { label: "Failed", value: "—", tone: "rose" },
        ]}
        capabilities={[
    { icon: Webhook, title: "Endpoint Registry", description: "Register URLs, choose events, set secret.", status: "queued" },
    { icon: FileSignature, title: "Signed Payloads", description: "HMAC-SHA256 signatures per delivery.", status: "manual" },
    { icon: RotateCcw, title: "Retry Engine", description: "Exponential backoff with DLQ after N tries.", status: "manual" },
    { icon: History, title: "Delivery Log", description: "Every attempt with status, latency, response.", status: "queued" },
    { icon: FlaskConical, title: "Test Send", description: "Fire any event to verify customer endpoint.", status: "manual" },
    { icon: BookOpen, title: "Event Catalog", description: "Documentation of every event payload shape.", status: "manual" },
        ]}
      primaryCta={{ label: "Add endpoint" }}
      />
    </AdminPageShell>
  );
}
