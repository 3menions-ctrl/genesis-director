/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminReferralsPage() {
  return (
    <AdminPageShell
      eyebrow="03 // MONEY"
      code="REF"
      title="Referrals"
      italic="Admin."
      description="Surface the Growth Suite referral graph with payouts, fraud flags, and lifecycle."
    >
      <AdminConsoleScaffold
        intro="Watch the viral coefficient mature — payout legitimate referrers, freeze the abusers."
        status="scoped"
        signals={[
        { label: "Referrers", value: "—", tone: "blue" },
        { label: "Conversions", value: "—", tone: "emerald" },
        { label: "Payouts Due", value: "—", tone: "amber" },
        { label: "Fraud Flags", value: "—", tone: "rose" },
        ]}
        capabilities={[
    { icon: GitBranch, title: "Referral Graph", description: "Visualize the viral tree per origin operator.", status: "queued" },
    { icon: DollarSign, title: "Payout Engine", description: "Trigger Stripe Connect payouts on conversion.", status: "manual" },
    { icon: AlertTriangle, title: "Fraud Detector", description: "Cluster sibling accounts and suspicious geo.", status: "manual" },
    { icon: BadgeCheck, title: "Tier Multipliers", description: "Boost referral rewards for top referrers.", status: "manual" },
    { icon: Mail, title: "Referrer Comms", description: "Templated milestones and payout notifications.", status: "manual" },
    { icon: History, title: "Conversion Log", description: "Per-conversion attribution with timestamps.", status: "wired" },
        ]}
      primaryCta={{ label: "Approve payouts" }}
      />
    </AdminPageShell>
  );
}
