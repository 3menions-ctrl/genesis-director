/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminChangelogPage() {
  return (
    <AdminPageShell
      eyebrow="09 // COMMS"
      code="CHG"
      title="Changelog"
      italic="Publisher."
      description="Author release notes once — push to public site, in-app modal, and email digest."
    >
      <AdminConsoleScaffold
        intro="Write the story of every release — surfaced in-product the moment a user logs in."
        status="scoped"
        signals={[
        { label: "Releases", value: "—", tone: "blue" },
        { label: "Drafts", value: "—", tone: "amber" },
        { label: "Reads 7d", value: "—", tone: "emerald" },
        { label: "Subscribers", value: "—", tone: "neutral" },
        ]}
        capabilities={[
    { icon: BookOpen, title: "Markdown Editor", description: "Rich editor with image + video embed.", status: "queued" },
    { icon: Sparkles, title: "Highlight Tag", description: "Tag entries: Feature, Fix, Performance.", status: "manual" },
    { icon: Globe, title: "Public Page", description: "Auto-publish to /changelog with RSS.", status: "manual" },
    { icon: Bell, title: "In-App Modal", description: "Show on login until dismissed.", status: "manual" },
    { icon: Mail, title: "Email Digest", description: "Weekly digest to opted-in subscribers.", status: "manual" },
    { icon: Calendar, title: "Schedule Publish", description: "Time-zone-aware publish window.", status: "manual" },
        ]}
      primaryCta={{ label: "New release" }}
      />
    </AdminPageShell>
  );
}
