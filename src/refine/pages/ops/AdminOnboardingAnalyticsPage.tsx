/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminOnboardingAnalyticsPage() {
  return (
    <AdminPageShell
      eyebrow="08 // GROWTH"
      code="OBA"
      title="Onboarding"
      italic="Funnel."
      description="Step-by-step conversion across the mandatory 3-step onboarding flow."
    >
      <AdminConsoleScaffold
        intro="Pinpoint the exact step where signups vanish — and run experiments to plug the leak."
        status="scoped"
        signals={[
        { label: "Signups 7d", value: "—", tone: "blue" },
        { label: "Step 1 → 2", value: "—", tone: "emerald", trend: "%" },
        { label: "Step 2 → 3", value: "—", tone: "amber", trend: "%" },
        { label: "Completed", value: "—", tone: "neutral", trend: "%" },
        ]}
        capabilities={[
    { icon: GitBranch, title: "Funnel Visualization", description: "Sankey of step-by-step drop-off.", status: "queued" },
    { icon: Clock, title: "Time on Step", description: "Median time spent per step with outliers.", status: "manual" },
    { icon: AlertTriangle, title: "Drop Detector", description: "Auto-flag steps with sudden drop spikes.", status: "manual" },
    { icon: FlaskConical, title: "Variant Comparison", description: "Compare A/B variants side-by-side.", status: "manual" },
    { icon: Filter, title: "Cohort Slicer", description: "Filter funnel by source, geo, device.", status: "manual" },
    { icon: Megaphone, title: "Win-back Trigger", description: "Email users who stalled on step 2 / 3.", status: "manual" },
        ]}
      primaryCta={{ label: "Open funnel" }}
      />
    </AdminPageShell>
  );
}
