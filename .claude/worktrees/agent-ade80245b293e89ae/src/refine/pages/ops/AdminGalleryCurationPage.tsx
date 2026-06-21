/** Auto-generated premium admin console page — Editorial Noir. */
import { Activity, AlertCircle, AlertOctagon, AlertTriangle, Archive, BadgeCheck, Ban, BarChart3, Beaker, Bell, BellRing, BookOpen, Bug, Calendar, Clock, Copy, Cpu, Database, DollarSign, Download, Eye, EyeOff, FileArchive, FileBarChart, FileCheck, FileDown, FileLock, FileSignature, FileSpreadsheet, FileText, FileX, Filter, FlaskConical, Folder, Gauge, GitBranch, GitCommit, GitCompare, GitMerge, Globe, Heart, History, Inbox, KeyRound, KeySquare, Languages, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, LineChart, ListOrdered, Lock, LogOut, Mail, MailCheck, MailX, MapPin, Megaphone, MessageSquareText, Network, Pencil, PieChart, Power, Radio, Receipt, RefreshCw, Repeat, RotateCcw, Search, Server, Settings2, Shield, ShieldAlert, ShieldCheck, Sliders, Smartphone, Sparkles, Star, StopCircle, Tag, Tags, Target, Terminal, ToggleRight, Trash2, TrendingUp, UploadCloud, UserCheck, UserCog, UserMinus, UserPlus, Users, Webhook, Wrench } from "lucide-react";
import { AdminPageShell } from "../../components/AdminPageShell";
import { AdminConsoleScaffold } from "../../components/AdminConsoleScaffold";

export default function AdminGalleryCurationPage() {
  return (
    <AdminPageShell
      eyebrow="04 // CONTENT"
      code="GAL"
      title="Gallery"
      italic="Curation."
      description="Hand-pick the public showcase — feature, hide, hero-promote."
    >
      <AdminConsoleScaffold
        intro="Set the editorial tone of the public showcase — what the world sees first, every day."
        status="scoped"
        signals={[
        { label: "Public Reels", value: "—", tone: "blue" },
        { label: "Featured", value: "—", tone: "emerald" },
        { label: "Hero Slot", value: "—", tone: "amber" },
        { label: "Submissions", value: "—", tone: "neutral" },
        ]}
        capabilities={[
    { icon: Star, title: "Hero Slot", description: "Pin a single reel above the fold.", status: "queued" },
    { icon: Sparkles, title: "Editor Picks", description: "Feature 6-12 standout reels in the rotator.", status: "queued" },
    { icon: EyeOff, title: "Hide From Feed", description: "Soft-suppress without deleting.", status: "wired" },
    { icon: Heart, title: "Promote Trending", description: "Boost reels with strong organic signals.", status: "manual" },
    { icon: Inbox, title: "Submission Queue", description: "Operator submissions awaiting curation.", status: "manual" },
    { icon: Layers, title: "Collections", description: "Themed playlists (e.g. 'Sci-Fi', 'Brand Spots').", status: "manual" },
        ]}
      primaryCta={{ label: "Set hero" }}
      />
    </AdminPageShell>
  );
}
