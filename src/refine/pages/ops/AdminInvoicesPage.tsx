/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminInvoicesPage() {
  return (
    <AdminPageShell
      eyebrow="03 // MONEY"
      code="INV"
      title="Tax"
      italic="& Invoices."
      description="Invoice browser, VAT/MOSS report builder, and downloadable accounting exports."
    >
      <AdminConsoleScaffold
        intro="Every invoice ever issued — searchable, exportable, and ready for the auditor on day one."
        status="scoped"
        signals={[
        { label: "Invoices YTD", value: "—", tone: "blue" },
        { label: "Net Σ YTD", value: "—", tone: "emerald" },
        { label: "VAT Collected", value: "—", tone: "amber" },
        { label: "Failed Sends", value: "—", tone: "rose" },
        ]}
        capabilities={[
    { icon: FileText, title: "Invoice Search", description: "Filter by customer, country, date, line item.", status: "queued" },
    { icon: Globe, title: "VAT / MOSS", description: "EU OSS quarterly report with line-item breakdown.", status: "manual" },
    { icon: FileSpreadsheet, title: "QuickBooks Export", description: "CSV / OFX / Xero-ready exports.", status: "manual" },
    { icon: Receipt, title: "PDF Re-issue", description: "One-click resend with branded template.", status: "manual" },
    { icon: Settings2, title: "Tax Engine", description: "Rules per country, state, and product type.", status: "manual" },
    { icon: AlertCircle, title: "Anomaly Flags", description: "Detect missing tax IDs or invalid rates.", status: "manual" },
        ]}
      primaryCta={{ label: "Run quarterly OSS" }}
      />
    </AdminPageShell>
  );
}
