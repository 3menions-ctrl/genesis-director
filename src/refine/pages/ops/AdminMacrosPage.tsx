/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminMacrosPage() {
  return (
    <AdminPageShell
      eyebrow="09 // COMMS"
      code="MCR"
      title="Support"
      italic="Macros."
      description="Canned replies for the Inbox with variable interpolation and tag routing."
    >
      <AdminConsoleScaffold
        intro="Triage faster — every common response saved, searchable, and one-key away in the Inbox."
        status="scoped"
        signals={[
        { label: "Macros", value: "—", tone: "blue" },
        { label: "Used 30d", value: "—", tone: "emerald" },
        { label: "Avg Resolve", value: "—", tone: "amber" },
        { label: "Languages", value: "—", tone: "neutral" },
        ]}
        capabilities={[
    { icon: MessageSquareText, title: "Macro Library", description: "Categorized canned replies with markdown.", status: "queued" },
    { icon: Sparkles, title: "Variable Interpolation", description: "Auto-fill {name}, {tier}, {amount}.", status: "manual" },
    { icon: Tags, title: "Tag Routing", description: "Suggest macros based on inbound tag.", status: "manual" },
    { icon: Languages, title: "Multilang", description: "Per-language variants with auto-detect.", status: "manual" },
    { icon: BarChart3, title: "Usage Stats", description: "Most-used macros, satisfaction signal.", status: "manual" },
    { icon: History, title: "Change Log", description: "Every edit captured for compliance.", status: "wired" },
        ]}
      primaryCta={{ label: "New macro" }}
      />
    </AdminPageShell>
  );
}
