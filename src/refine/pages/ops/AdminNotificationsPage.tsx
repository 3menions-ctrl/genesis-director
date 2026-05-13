/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminNotificationsPage() {
  return (
    <AdminPageShell
      eyebrow="09 // COMMS"
      code="NTF"
      title="Notification"
      italic="Center."
      description="In-app + push notification composer with cohort targeting and delivery tracking."
    >
      <AdminConsoleScaffold
        intro="Reach operators inside the product — toast, modal, push, or all three — measured to the click."
        status="scoped"
        signals={[
        { label: "Sent 30d", value: "—", tone: "blue" },
        { label: "Open Rate", value: "—", tone: "emerald" },
        { label: "Click-Through", value: "—", tone: "amber" },
        { label: "Devices", value: "—", tone: "neutral" },
        ]}
        capabilities={[
    { icon: Bell, title: "Composer", description: "Title, body, deep-link CTA, image.", status: "queued" },
    { icon: Users, title: "Cohort Targeting", description: "Send to a saved cohort or ad-hoc query.", status: "manual" },
    { icon: Smartphone, title: "Channel Mix", description: "In-app, push (FCM), email — pick combos.", status: "manual" },
    { icon: Calendar, title: "Schedule", description: "Send now or schedule with timezone awareness.", status: "manual" },
    { icon: BarChart3, title: "Delivery Telemetry", description: "Sent / delivered / opened / acted.", status: "manual" },
    { icon: Beaker, title: "Variant Test", description: "A/B test copy and CTA in-flight.", status: "manual" },
        ]}
      primaryCta={{ label: "New broadcast" }}
      />
    </AdminPageShell>
  );
}
