/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminSubscriptionsPage() {
  return (
    <AdminPageShell
      eyebrow="03 // MONEY"
      code="SUB"
      title="Subscriptions"
      italic="& MRR."
      description="Recurring plan inventory, MRR cohorts, churn surface, and dunning queue."
    >
      <AdminConsoleScaffold
        intro="Track every recurring contract — predict churn, recover failed payments, model MRR by cohort."
        status="scoped"
        signals={[
        { label: "Active Subs", value: "—", tone: "blue" },
        { label: "MRR", value: "—", tone: "emerald", trend: "USD" },
        { label: "Churn 30d", value: "—", tone: "rose" },
        { label: "Dunning", value: "—", tone: "amber", trend: "needs retry" },
        ]}
        capabilities={[
    { icon: Repeat, title: "Plan Inventory", description: "Every Stripe price/product mirrored locally.", status: "queued" },
    { icon: TrendingUp, title: "MRR Cohorts", description: "Monthly cohort retention with expansion split.", status: "queued" },
    { icon: AlertTriangle, title: "Churn Predictor", description: "Surface accounts at high cancellation risk.", status: "manual" },
    { icon: RotateCcw, title: "Dunning Queue", description: "Failed payments with retry schedule + emails.", status: "manual" },
    { icon: UserMinus, title: "Cancel Flow", description: "Pause / cancel / refund with single audit entry.", status: "manual" },
    { icon: FileText, title: "Invoice Browser", description: "Per-customer invoice history with PDF.", status: "queued" },
        ]}
      primaryCta={{ label: "Open MRR dashboard" }}
      />
    </AdminPageShell>
  );
}
