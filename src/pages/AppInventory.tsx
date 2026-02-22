import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Film, Mic, Image, Wand2, Shield, CreditCard, Users, MessageSquare, 
  LayoutDashboard, Palette, Bot, Puzzle, Database, Server, Globe, 
  ArrowLeft, Search, ChevronDown, ChevronRight, Zap, Play, 
  Settings, Eye, Lock, Layers, Music, Type, Scissors, Upload,
  MonitorPlay, UserCircle, Star, Trophy, BarChart3, AlertTriangle,
  Workflow, RefreshCw, Trash2, CheckCircle, FileText, Clock,
  Video, Camera, Sparkles, Hash, Heart, Bell, Send
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ─── Data ────────────────────────────────────────────────────

interface InventoryItem {
  name: string;
  description: string;
  status: "active" | "beta" | "internal" | "deprecated" | "broken" | "stub";
  tags?: string[];
}

interface InventorySection {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  description: string;
  items: InventoryItem[];
}

const INVENTORY: InventorySection[] = [
  {
    id: "issues",
    title: "⚠ Non-Functional & Half-Baked",
    icon: AlertTriangle,
    color: "text-red-400",
    description: "Features that are broken, stubs, or incomplete — needs attention",
    items: [
      { name: "Video Editor Export (Multi-Clip)", description: "Export tries mp4box.js merge first, then falls back to ZIP download. Merge may fail on some codecs — ZIP fallback ensures users always get their clips.", status: "beta", tags: ["editor"] },
      { name: "Motion Transfer Mode", description: "Edge function returns 501. Removed from UI — edge function pending deletion.", status: "stub", tags: ["pipeline"] },
      { name: "generate-trailer (Edge Function)", description: "Edge function exists but is never called from any frontend component.", status: "stub", tags: ["pipeline"] },
      { name: "stylize-video (Edge Function)", description: "Edge function exists but no frontend trigger.", status: "stub", tags: ["pipeline"] },
      { name: "Press Kit Download", description: "Press page 'Download Press Kit' button has no file or handler.", status: "stub", tags: ["public page"] },
      { name: "Press Page — Media Inquiries", description: "'Media Inquiries' button has no action handler.", status: "stub", tags: ["public page"] },
      { name: "Leaderboard (Profile Page)", description: "Leaderboard button is a no-op. No dedicated leaderboard page.", status: "broken", tags: ["gamification"] },
      { name: "Color Grading (Editor)", description: "CSS filters on preview only — not baked into export.", status: "beta", tags: ["editor"] },
      { name: "Filters (Editor)", description: "Filter presets apply CSS to preview only. Not in export.", status: "beta", tags: ["editor"] },
      { name: "Crop & Rotate (Editor)", description: "CSS-only in preview. Not applied during export.", status: "beta", tags: ["editor"] },
      { name: "Text Animation (Editor)", description: "Works in preview but not burned into exported video.", status: "beta", tags: ["editor"] },
      { name: "Speed Control (Editor)", description: "Changes playback rate in preview but does not re-encode.", status: "beta", tags: ["editor"] },
      { name: "Audio Fade (Editor)", description: "Fades via Web Audio API in preview only — not in export.", status: "beta", tags: ["editor"] },
      { name: "HLS Playlist Generation", description: "Edge function exists but no frontend consumer.", status: "stub", tags: ["pipeline"] },
      { name: "Blog Page", description: "Hardcoded articles — not backed by database/CMS.", status: "beta", tags: ["public page"] },
    ],
  },
  {
    id: "pages",
    title: "Pages & Routes",
    icon: Globe,
    color: "text-blue-400",
    description: "All navigable pages in the application",
    items: [
      { name: "Landing Page (/)", description: "Homepage with immersive hero video, feature showcase, pricing, social proof, FAQ, and CTAs", status: "active", tags: ["public"] },
      { name: "Auth (/auth)", description: "Login and signup with email+password and Google OAuth", status: "active", tags: ["public"] },
      { name: "Auth Callback (/auth/callback)", description: "OAuth redirect handler for Google sign-in", status: "active", tags: ["public"] },
      { name: "Forgot Password (/forgot-password)", description: "Password reset request form", status: "active", tags: ["public"] },
      { name: "Reset Password (/reset-password)", description: "Password reset completion form", status: "active", tags: ["public"] },
      { name: "Onboarding (/onboarding)", description: "New user setup wizard after first sign-in", status: "active", tags: ["protected"] },
      { name: "Projects Dashboard (/projects)", description: "User's project dashboard with filters, categories, and thumbnails", status: "active", tags: ["protected"] },
      { name: "Creation Hub (/create)", description: "Creation mode selector — prompt input, AI script generation, mode routing", status: "active", tags: ["protected"] },
      { name: "Script Review (/script-review)", description: "Review and edit AI-generated scripts before production", status: "active", tags: ["protected"] },
      { name: "Production (/production/:projectId)", description: "Production pipeline monitor — clip progress, stitching, final video", status: "active", tags: ["protected"] },
      { name: "Video Editor (/editor)", description: "Multi-track timeline editor with 15+ tools", status: "active", tags: ["protected"] },
      { name: "Avatars (/avatars)", description: "Avatar template browser with filters, preview, and 3D viewer", status: "active", tags: ["protected"] },
      { name: "Gallery (/gallery)", description: "Public video gallery with fullscreen player and category navigation", status: "active", tags: ["public"] },
      { name: "Pricing (/pricing)", description: "Credit packages with Stripe checkout integration", status: "active", tags: ["public"] },
      { name: "Creators (/creators)", description: "Public creator directory and discovery", status: "active", tags: ["public"] },
      { name: "User Profile (/user/:userId)", description: "Public user profile with videos, stats, and social actions", status: "active", tags: ["public"] },
      { name: "Video Detail (/video/:videoId)", description: "Video playback page with comments, reactions, and sharing", status: "active", tags: ["public"] },
      { name: "Profile (/profile)", description: "Own profile — stats, achievements, gamification, daily challenges", status: "active", tags: ["protected"] },
      { name: "Settings (/settings)", description: "User settings — account, billing, notifications, security, preferences", status: "active", tags: ["protected"] },
      { name: "World Chat (/chat)", description: "Real-time world chat room with reactions and media", status: "active", tags: ["protected"] },
      { name: "Templates (/templates)", description: "Template gallery for quick creation starts", status: "active", tags: ["protected"] },
      { name: "Training Video (/training-video)", description: "Training content creation mode", status: "active", tags: ["protected"] },
      { name: "Environments (/environments)", description: "Environment/location browser for scene settings", status: "active", tags: ["protected"] },
      { name: "How It Works (/how-it-works)", description: "Platform explainer page", status: "active", tags: ["public"] },
      { name: "Help Center (/help)", description: "Help center and FAQ", status: "active", tags: ["public"] },
      { name: "Blog (/blog)", description: "Blog page", status: "active", tags: ["public"] },
      { name: "Press (/press)", description: "Press and media page", status: "active", tags: ["public"] },
      { name: "Terms (/terms)", description: "Terms of service", status: "active", tags: ["public"] },
      { name: "Privacy (/privacy)", description: "Privacy policy", status: "active", tags: ["public"] },
      { name: "Contact (/contact)", description: "Contact form", status: "active", tags: ["public"] },
      { name: "Widget Landing (/w/:slug)", description: "Embeddable widget landing pages", status: "active", tags: ["public"] },
      { name: "Widget Embed (/widget/:publicKey)", description: "Embeddable widget iframe view", status: "active", tags: ["public"] },
      { name: "Admin Panel (/admin/*)", description: "Full admin panel — users, projects, credits, pipeline, moderation, gallery, config", status: "active", tags: ["admin"] },
      { name: "404 Not Found", description: "Catch-all 404 page", status: "active", tags: ["public"] },
    ],
  },
  {
    id: "pipeline",
    title: "Video Pipeline",
    icon: Workflow,
    color: "text-purple-400",
    description: "Core video generation and production pipeline",
    items: [
      { name: "generate-script", description: "AI script generation from user prompt using OpenAI/Gemini", status: "active", tags: ["ai"] },
      { name: "generate-story", description: "Story and narrative generation", status: "active", tags: ["ai"] },
      { name: "smart-script-generator", description: "Enhanced smart script generation with advanced prompting", status: "active", tags: ["ai"] },
      { name: "script-assistant", description: "Interactive AI script editing assistant", status: "active", tags: ["ai"] },
      { name: "mode-router", description: "Routes creation request to correct generation mode", status: "active" },
      { name: "generate-video", description: "Main video clip generation via Replicate/Kling", status: "active", tags: ["ai", "replicate", "kling"] },
      { name: "generate-single-clip", description: "Single clip generation (isolated)", status: "active", tags: ["ai"] },
      { name: "generate-scene-images", description: "Scene image generation for storyboarding", status: "active", tags: ["ai", "replicate"] },
      { name: "hollywood-pipeline", description: "Full Hollywood-mode pipeline orchestration", status: "active", tags: ["ai"] },
      { name: "check-video-status", description: "Polls clip generation status from Replicate", status: "active", tags: ["replicate"] },
      { name: "check-specialized-status", description: "Checks specialized mode generation status", status: "active", tags: ["replicate"] },
      { name: "simple-stitch", description: "Stitches individual clips into final video", status: "active" },
      { name: "auto-stitch-trigger", description: "Auto-triggers stitching when all clips are ready", status: "active" },
      { name: "render-video", description: "Renders/exports final video from editor timeline", status: "active" },
      { name: "final-assembly", description: "Genesis final assembly of clips into movie", status: "active" },
      { name: "continue-production", description: "Resumes halted production pipeline", status: "active" },
      { name: "resume-pipeline", description: "Resumes pipeline from last checkpoint", status: "active" },
      { name: "retry-failed-clip", description: "Retries generation of a single failed clip", status: "active" },
      { name: "cancel-project", description: "Cancels an active production project", status: "active" },
      { name: "delete-project", description: "Permanently deletes project and associated assets", status: "active" },
      { name: "delete-clip", description: "Deletes an individual clip from a project", status: "active" },
    ],
  },
  {
    id: "pipeline-ops",
    title: "Pipeline Operations & Monitoring",
    icon: AlertTriangle,
    color: "text-yellow-400",
    description: "Health monitoring, cleanup, and auditing",
    items: [
      { name: "pipeline-watchdog", description: "Monitors pipeline health and detects stalled jobs", status: "active" },
      { name: "zombie-cleanup", description: "Cleans stuck/zombie pipeline jobs automatically", status: "active" },
      { name: "job-queue", description: "Background job queue processor", status: "active" },
      { name: "production-audit", description: "Audits production pipeline integrity", status: "active" },
      { name: "cleanup-stale-drafts", description: "Cleans abandoned draft projects", status: "active" },
    ],
  },
  {
    id: "avatars",
    title: "Avatar & Character System",
    icon: UserCircle,
    color: "text-pink-400",
    description: "Avatar generation, character management, and casting",
    items: [
      { name: "generate-avatar", description: "Generate a single avatar image", status: "active", tags: ["ai"] },
      { name: "generate-avatar-direct", description: "Direct avatar generation (bypasses queue)", status: "active", tags: ["ai"] },
      { name: "generate-avatar-image", description: "Avatar image generation variant", status: "active", tags: ["ai"] },
      { name: "generate-avatar-scene", description: "Avatar placed in scene generation", status: "active", tags: ["ai"] },
      { name: "generate-single-avatar", description: "Single avatar variant generation", status: "active", tags: ["ai"] },
      { name: "generate-avatars-batch", description: "Batch avatar generation for library", status: "active", tags: ["ai"] },
      { name: "batch-avatar-generator", description: "Batch avatar generator v2", status: "active", tags: ["ai"] },
      { name: "generate-avatar-batch", description: "Another batch generation variant", status: "active", tags: ["ai"] },
      { name: "seed-avatar-library", description: "Seeds the avatar template library with base avatars", status: "internal", tags: ["admin"] },
      { name: "seed-avatar-batch-v2", description: "Avatar batch seeder v2", status: "internal", tags: ["admin"] },
      { name: "regenerate-animated-avatars", description: "Regenerates animated avatar variants", status: "internal", tags: ["admin"] },
      { name: "regenerate-stock-avatars", description: "Regenerates stock avatar images", status: "internal", tags: ["admin"] },
      { name: "resume-avatar-pipeline", description: "Resumes interrupted avatar generation pipeline", status: "active" },
      { name: "composite-character", description: "Composites character reference images together", status: "active", tags: ["ai"] },
      { name: "generate-character-for-scene", description: "Generates character appearance for specific scene context", status: "active", tags: ["ai"] },
      { name: "scene-character-analyzer", description: "Analyzes which characters appear in each scene", status: "active", tags: ["ai"] },
    ],
  },
  {
    id: "voice-audio",
    title: "Voice & Audio",
    icon: Mic,
    color: "text-green-400",
    description: "Text-to-speech, music generation, and audio processing",
    items: [
      { name: "generate-voice", description: "Text-to-speech voice generation via ElevenLabs", status: "active", tags: ["elevenlabs"] },
      { name: "editor-tts", description: "Editor panel text-to-speech generation", status: "active", tags: ["elevenlabs"] },
      { name: "editor-transcribe", description: "Audio transcription (speech-to-text)", status: "active", tags: ["ai"] },
      { name: "editor-generate-from-audio", description: "Generate video from uploaded audio", status: "active", tags: ["ai"] },
      { name: "elevenlabs-music", description: "AI music generation via ElevenLabs", status: "active", tags: ["elevenlabs"] },
      { name: "elevenlabs-sfx", description: "Sound effects generation via ElevenLabs", status: "active", tags: ["elevenlabs"] },
      { name: "generate-music", description: "Music track generation", status: "active", tags: ["ai"] },
      { name: "regenerate-audio", description: "Regenerate project voice audio", status: "active", tags: ["elevenlabs"] },
      { name: "scene-music-analyzer", description: "Analyzes and suggests music for each scene", status: "active", tags: ["ai"] },
      { name: "sync-music-to-scenes", description: "Syncs music timing to scene cuts", status: "active" },
      { name: "fix-manifest-audio", description: "Fixes manifest audio configuration (utility)", status: "internal" },
    ],
  },
  {
    id: "image-video",
    title: "Image & Video Processing",
    icon: Image,
    color: "text-cyan-400",
    description: "Frame extraction, thumbnails, style transfer, and streaming",
    items: [
      { name: "extract-video-frame", description: "Extracts a frame from video using Replicate", status: "active", tags: ["replicate"] },
      { name: "extract-first-frame", description: "Extracts first frame of a video", status: "active", tags: ["replicate"] },
      { name: "extract-last-frame", description: "Extracts last frame of a video", status: "active", tags: ["replicate"] },
      { name: "extract-video-thumbnails", description: "Batch thumbnail extraction for multiple videos", status: "active" },
      { name: "extract-scene-identity", description: "Extracts scene identity/visual style for consistency", status: "active", tags: ["ai"] },
      { name: "analyze-reference-image", description: "Analyzes uploaded reference image for style matching", status: "active", tags: ["ai"] },
      { name: "generate-thumbnail", description: "Generates thumbnail for a project", status: "active", tags: ["ai"] },
      { name: "generate-project-thumbnail", description: "Project thumbnail generation variant", status: "active", tags: ["ai"] },
      { name: "generate-video-thumbnails", description: "Video thumbnail generation", status: "active" },
      { name: "generate-missing-thumbnails", description: "Fills in missing thumbnails for existing videos", status: "active" },
      { name: "generate-hls-playlist", description: "Generates HLS streaming playlist (.m3u8)", status: "active" },
      { name: "generate-trailer", description: "Generates project trailer", status: "active", tags: ["ai"] },
      { name: "stylize-video", description: "Applies AI style transfer to video clip", status: "active", tags: ["replicate"] },
      { name: "motion-transfer", description: "Transfers motion between video clips", status: "active", tags: ["replicate"] },
      { name: "edit-photo", description: "AI photo editing", status: "active", tags: ["ai"] },
      { name: "generate-upload-url", description: "Generates signed upload URL for storage", status: "active" },
    ],
  },
  {
    id: "validation",
    title: "Validation & Quality Assurance",
    icon: CheckCircle,
    color: "text-emerald-400",
    description: "Clip validation, quality checks, and API auditing",
    items: [
      { name: "comprehensive-clip-validator", description: "Validates clip quality, resolution, and integrity", status: "active" },
      { name: "comprehensive-validation-orchestrator", description: "Orchestrates multi-step validation pipeline", status: "active" },
      { name: "approve-clip-one", description: "Approves first clip to start the pipeline", status: "active" },
      { name: "kling-v3-audit-test", description: "Kling v3 API audit and testing", status: "internal", tags: ["admin"] },
      { name: "replicate-audit", description: "Replicate API audit and testing", status: "internal", tags: ["admin"] },
      { name: "poll-replicate-prediction", description: "Polls Replicate prediction status", status: "active", tags: ["replicate"] },
      { name: "replicate-webhook", description: "Replicate webhook handler for async results", status: "active", tags: ["replicate"] },
    ],
  },
  {
    id: "auth-billing",
    title: "Auth, Billing & User Management",
    icon: CreditCard,
    color: "text-amber-400",
    description: "Authentication, payments, gamification, and account management",
    items: [
      { name: "create-credit-checkout", description: "Creates Stripe checkout session for credit purchases", status: "active", tags: ["stripe"] },
      { name: "stripe-webhook", description: "Handles Stripe payment webhooks (checkout, subscription)", status: "active", tags: ["stripe"] },
      { name: "gamification-event", description: "Processes XP awards, achievements, and streak tracking", status: "active" },
      { name: "track-signup", description: "Tracks new user signups for analytics", status: "active" },
      { name: "update-user-email", description: "Updates user email address", status: "active" },
      { name: "delete-user-account", description: "Permanently deletes user account and all data", status: "active" },
      { name: "export-user-data", description: "GDPR-compliant data export for user", status: "active" },
      { name: "admin-delete-auth-user", description: "Admin-level user deletion", status: "active", tags: ["admin"] },
      { name: "revoke-demo-sessions", description: "Revokes demo/trial sessions", status: "internal", tags: ["admin"] },
    ],
  },
  {
    id: "agent-widget",
    title: "AI Agent & Widgets",
    icon: Bot,
    color: "text-violet-400",
    description: "AI assistant chat and embeddable widget system",
    items: [
      { name: "agent-chat", description: "AI assistant chat (Hoppy) — context-aware help and actions", status: "active", tags: ["ai"] },
      { name: "generate-widget-config", description: "AI-powered widget configuration generation", status: "active", tags: ["ai"] },
      { name: "get-widget-config", description: "Retrieves widget configuration for embedding", status: "active" },
      { name: "log-widget-event", description: "Logs widget analytics events for tracking", status: "active" },
    ],
  },
  {
    id: "shared-utils",
    title: "Shared Backend Utilities",
    icon: Layers,
    color: "text-slate-400",
    description: "Shared modules used across edge functions",
    items: [
      { name: "auth-guard.ts", description: "JWT authentication guard — validates bearer tokens, extracts user ID, checks service role", status: "active", tags: ["security"] },
      { name: "prompt-builder.ts", description: "Constructs AI prompts from scene/script data", status: "active", tags: ["ai"] },
      { name: "golden-prompt-reference-v1.ts", description: "Golden prompt style reference for consistent generation quality", status: "active", tags: ["ai"] },
      { name: "world-class-cinematography.ts", description: "Cinematography-focused prompt engineering guide", status: "active", tags: ["ai"] },
      { name: "content-safety.ts", description: "Content moderation and safety filtering", status: "active", tags: ["security"] },
      { name: "rate-limiter.ts", description: "API rate limiting logic", status: "active", tags: ["security"] },
      { name: "network-resilience.ts", description: "Retry logic, timeouts, exponential backoff", status: "active" },
      { name: "pipeline-failsafes.ts", description: "Pipeline safety checks and automatic recovery", status: "active" },
      { name: "pipeline-guard-rails.ts", description: "Pipeline constraints and limits", status: "active" },
      { name: "pipeline-notifications.ts", description: "Pipeline status notification dispatch", status: "active" },
      { name: "anchor-failsafes.ts", description: "Continuity anchor safeguards for consistency", status: "active" },
      { name: "batch-processor.ts", description: "Batch job processing utilities", status: "active" },
      { name: "generation-mutex.ts", description: "Concurrency lock for generation jobs", status: "active", tags: ["security"] },
      { name: "replicate-recovery.ts", description: "Replicate API failure recovery logic", status: "active", tags: ["replicate"] },
      { name: "video-persistence.ts", description: "Video URL storage and persistence layer", status: "active" },
      { name: "gcp-auth.ts", description: "Google Cloud Platform authentication helper", status: "active", tags: ["gcp"] },
      { name: "script-utils.ts", description: "Script parsing and manipulation utilities", status: "active" },
      { name: "avatar-screenplay-generator.ts", description: "Avatar-specific screenplay generation logic", status: "active", tags: ["ai"] },
    ],
  },
  {
    id: "editor-tools",
    title: "Video Editor Tools",
    icon: Scissors,
    color: "text-orange-400",
    description: "All tools available in the multi-track video editor",
    items: [
      { name: "Timeline Editor", description: "Multi-track timeline with drag/drop, trim, split", status: "active" },
      { name: "Preview Player", description: "Real-time video preview with gapless playback", status: "active" },
      { name: "Media Browser", description: "Browse and import media assets", status: "active" },
      { name: "Export Dialog", description: "Export settings, resolution, format, and progress", status: "active" },
      { name: "Audio Upload", description: "Upload custom audio tracks", status: "active" },
      { name: "Audio Waveform", description: "Visual audio waveform display", status: "active" },
      { name: "Audio Fade", description: "Audio fade in/out controls (preview only)", status: "beta" },
      { name: "Music Library", description: "AI music generation library (ElevenLabs)", status: "active", tags: ["ai", "elevenlabs"] },
      { name: "Captions", description: "Auto-generate captions/subtitles", status: "active", tags: ["ai"] },
      { name: "Color Grading", description: "Color correction controls (preview only)", status: "beta" },
      { name: "Crop & Rotate", description: "Crop, rotate, and flip video (preview only)", status: "beta" },
      { name: "Filters", description: "Video filter presets (preview only)", status: "beta" },
      { name: "Speed Control", description: "Playback speed adjustment (preview only)", status: "beta" },
      { name: "Templates", description: "Editor template presets", status: "active" },
      { name: "Text Animation", description: "Animated text overlays (preview only)", status: "beta" },
      { name: "Text-to-Video", description: "Generate video from text in editor", status: "active", tags: ["ai"] },
    ],
  },
  {
    id: "social",
    title: "Social Features",
    icon: Heart,
    color: "text-red-400",
    description: "Social interactions, messaging, and community",
    items: [
      { name: "Video Comments", description: "Threaded comments with replies on videos", status: "active" },
      { name: "Video Reactions", description: "Like, love, and emoji reactions on videos", status: "active" },
      { name: "Direct Messages", description: "Private messaging between users", status: "active" },
      { name: "Messages Inbox", description: "DM inbox with conversation list", status: "active" },
      { name: "World Chat", description: "Real-time public chat room with reactions and media", status: "active" },
      { name: "Follow/Unfollow", description: "Follow creators and see their content", status: "active" },
      { name: "Notifications", description: "Bell notifications for social activity", status: "active" },
      { name: "Creator Directory", description: "Browse and discover creators", status: "active" },
      { name: "Public Profiles", description: "User profiles with videos, stats, and bio", status: "active" },
      { name: "Character Lending", description: "Lend characters to other creators", status: "active" },
    ],
  },
  {
    id: "gamification",
    title: "Gamification",
    icon: Trophy,
    color: "text-yellow-300",
    description: "XP, achievements, streaks, and daily challenges",
    items: [
      { name: "XP System", description: "Earn XP for actions: video created (+25), completed (+100), character created (+50), etc.", status: "active" },
      { name: "Level Progression", description: "Level up by earning XP", status: "active" },
      { name: "Achievements", description: "Unlock achievement badges for milestones", status: "active" },
      { name: "Daily Challenges", description: "Daily tasks with XP rewards", status: "active" },
      { name: "Streaks", description: "Daily login streak tracking with bonuses", status: "active" },
      { name: "Leaderboard Stats", description: "User stats and ranking display", status: "active" },
    ],
  },
  {
    id: "admin",
    title: "Admin Panel",
    icon: Shield,
    color: "text-red-500",
    description: "Administration tools and system management",
    items: [
      { name: "Dashboard", description: "Admin overview with key metrics", status: "active", tags: ["admin"] },
      { name: "Users Management", description: "Browse, search, ban, and manage all users", status: "active", tags: ["admin"] },
      { name: "Projects Browser", description: "Browse all user projects with status filters", status: "active", tags: ["admin"] },
      { name: "Credits Management", description: "View credit transactions, manage packages", status: "active", tags: ["admin"] },
      { name: "Message Center", description: "Send messages to users", status: "active", tags: ["admin"] },
      { name: "Financials", description: "Financial overview and revenue tracking", status: "active", tags: ["admin"] },
      { name: "Cost Analysis", description: "API cost tracking per service and operation", status: "active", tags: ["admin"] },
      { name: "Pipeline Monitor", description: "Monitor all active production pipelines", status: "active", tags: ["admin"] },
      { name: "Failed Clips Queue", description: "Queue of failed clips for review and retry", status: "active", tags: ["admin"] },
      { name: "Audit Log", description: "Admin action audit trail", status: "active", tags: ["admin"] },
      { name: "Credit Packages", description: "Manage available credit packages and pricing", status: "active", tags: ["admin"] },
      { name: "Content Moderation", description: "Content review and moderation tools", status: "active", tags: ["admin"] },
      { name: "Gallery Manager", description: "Curate gallery showcase videos", status: "active", tags: ["admin"] },
      { name: "Avatar Seeder", description: "Seed and manage avatar template library", status: "active", tags: ["admin"] },
      { name: "System Config", description: "System-wide configuration settings", status: "active", tags: ["admin"] },
    ],
  },
  {
    id: "integrations",
    title: "Third-Party Integrations",
    icon: Puzzle,
    color: "text-indigo-400",
    description: "External services and APIs used by the platform",
    items: [
      { name: "Stripe", description: "Payment processing — credit purchases, checkout sessions, webhooks", status: "active", tags: ["stripe"] },
      { name: "Replicate", description: "Video generation, frame extraction, style transfer, motion transfer", status: "active", tags: ["replicate"] },
      { name: "ElevenLabs", description: "Text-to-speech voices, AI music generation, sound effects", status: "active", tags: ["elevenlabs"] },
      { name: "Kling", description: "Video generation (alternative provider to Replicate)", status: "active", tags: ["kling"] },
      { name: "Google Cloud (GCP)", description: "AI models (Gemini), authentication", status: "active", tags: ["gcp"] },
      { name: "OpenAI", description: "Script generation, AI assistant, content analysis", status: "active", tags: ["openai"] },
      { name: "Google OAuth", description: "Social sign-in via Google", status: "active" },
    ],
  },
  {
    id: "database",
    title: "Database Tables",
    icon: Database,
    color: "text-teal-400",
    description: "All database tables powering the application",
    items: [
      { name: "profiles", description: "User profiles — display name, avatar, bio, credits balance", status: "active" },
      { name: "movie_projects", description: "Video projects — script, status, pipeline state, video URLs", status: "active" },
      { name: "edit_sessions", description: "Editor sessions — timeline data, render state", status: "active" },
      { name: "gallery_showcase", description: "Curated gallery showcase videos", status: "active" },
      { name: "avatar_templates", description: "Pre-built avatar templates with voices", status: "active" },
      { name: "characters", description: "User-created characters with appearance and personality", status: "active" },
      { name: "character_voice_assignments", description: "Character-to-voice mappings per project", status: "active" },
      { name: "character_loans", description: "Character lending records between users", status: "active" },
      { name: "conversations", description: "Chat conversations (DM and group)", status: "active" },
      { name: "conversation_members", description: "Conversation membership and roles", status: "active" },
      { name: "chat_messages", description: "Chat messages with media support", status: "active" },
      { name: "chat_message_reactions", description: "Emoji reactions on chat messages", status: "active" },
      { name: "direct_messages", description: "Legacy direct messages between users", status: "active" },
      { name: "project_comments", description: "Comments on videos/projects", status: "active" },
      { name: "comment_likes", description: "Likes on comments", status: "active" },
      { name: "comment_reactions", description: "Emoji reactions on comments", status: "active" },
      { name: "credit_packages", description: "Available credit packages for purchase", status: "active" },
      { name: "credit_transactions", description: "Credit transaction history (immutable, append-only)", status: "active" },
      { name: "api_cost_logs", description: "API cost tracking per operation and service", status: "active" },
      { name: "achievements", description: "Achievement definitions with XP rewards", status: "active" },
      { name: "daily_challenges", description: "Daily challenge definitions", status: "active" },
      { name: "agent_conversations", description: "AI agent chat conversations", status: "active" },
      { name: "agent_messages", description: "AI agent chat messages with tool calls", status: "active" },
      { name: "agent_preferences", description: "User preferences for AI agent", status: "active" },
      { name: "agent_query_analytics", description: "Agent usage analytics", status: "active" },
      { name: "admin_audit_log", description: "Admin action audit trail", status: "active" },
      { name: "banned_accounts", description: "Banned user accounts", status: "active" },
      { name: "genesis_eras", description: "Historical eras in the Genesis universe", status: "active" },
      { name: "genesis_locations", description: "World locations and places", status: "active" },
      { name: "genesis_location_requests", description: "User-requested new locations", status: "active" },
      { name: "genesis_lore", description: "Lore entries (canon and community)", status: "active" },
      { name: "genesis_environment_templates", description: "Environment visual style templates", status: "active" },
      { name: "genesis_continuity_anchors", description: "Continuity anchor points for consistency", status: "active" },
      { name: "genesis_preset_characters", description: "Preset screenplay characters", status: "active" },
      { name: "genesis_character_castings", description: "Character casting submissions", status: "active" },
      { name: "genesis_character_appearances", description: "Character appearances in videos", status: "active" },
      { name: "genesis_character_interactions", description: "Character interaction records", status: "active" },
      { name: "genesis_scene_characters", description: "Characters assigned to scenes", status: "active" },
      { name: "genesis_scene_clips", description: "Scene clip submissions for review", status: "active" },
      { name: "genesis_screenplay", description: "Full screenplays for Genesis productions", status: "active" },
      { name: "genesis_final_assembly", description: "Final assembly records", status: "active" },
      { name: "genesis_videos", description: "Genesis universe video entries", status: "active" },
    ],
  },
  {
    id: "hooks",
    title: "Custom Hooks",
    icon: Zap,
    color: "text-lime-400",
    description: "All React hooks powering frontend logic",
    items: [
      { name: "useAdminAccess", description: "Checks if current user has admin role", status: "active", tags: ["security"] },
      { name: "useSecurityGuard", description: "Manages security version stamps, forces re-auth", status: "active", tags: ["security"] },
      { name: "useGatekeeperLoading", description: "Auth gatekeeper loading state management", status: "active" },
      { name: "useAvatarTemplatesQuery", description: "Fetches avatar templates with React Query caching", status: "active" },
      { name: "useAvatarVoices", description: "Fetches available avatar voices", status: "active" },
      { name: "useChunkedAvatars", description: "Paginated/chunked avatar loading for performance", status: "active" },
      { name: "useGalleryShowcase", description: "Fetches gallery showcase data", status: "active" },
      { name: "usePaginatedProjects", description: "Paginated project list with filters", status: "active" },
      { name: "useProjectThumbnails", description: "Loads project thumbnail images", status: "active" },
      { name: "usePublicProfile", description: "Fetches public user profile data", status: "active" },
      { name: "useTemplateEnvironment", description: "Fetches template environment data", status: "active" },
      { name: "useChat", description: "Chat messaging logic and state", status: "active" },
      { name: "useConversations", description: "DM conversation management", status: "active" },
      { name: "useNotifications", description: "Notification system with real-time updates", status: "active" },
      { name: "useSocial", description: "Follow/unfollow, likes, and social actions", status: "active" },
      { name: "useVideoReactions", description: "Video reaction handling", status: "active" },
      { name: "useWorldChat", description: "Real-time world chat with WebSocket", status: "active" },
      { name: "useSmartMessages", description: "Smart message formatting and rendering", status: "active" },
      { name: "useClipRecovery", description: "Failed clip recovery logic", status: "active" },
      { name: "usePredictivePipeline", description: "Pipeline progress prediction and ETA", status: "active" },
      { name: "useRetryStitch", description: "Retry video stitching operations", status: "active" },
      { name: "useZombieWatcher", description: "Detects zombie/stuck pipeline jobs", status: "active" },
      { name: "useEditorHistory", description: "Undo/redo history stack for editor", status: "active" },
      { name: "useMultiTrackAudio", description: "Multi-track audio management", status: "active" },
      { name: "useMSEPlayback", description: "MediaSource Extensions playback", status: "active" },
      { name: "useFileUpload", description: "File upload handling with progress", status: "active" },
      { name: "useCreditBilling", description: "Credit purchase flow with Stripe", status: "active", tags: ["stripe"] },
      { name: "useGamification", description: "XP, achievements, and streak tracking", status: "active" },
      { name: "useTierLimits", description: "Usage tier limit checks and enforcement", status: "active" },
      { name: "use-mobile", description: "Mobile viewport detection", status: "active" },
      { name: "use-toast", description: "Toast notification system", status: "active" },
      { name: "useImagePreloader", description: "Preloads images for smooth UX", status: "active" },
      { name: "usePageMeta", description: "Dynamic SEO meta tags per page", status: "active" },
      { name: "useScrollReveal", description: "Scroll-triggered reveal animations", status: "active" },
      { name: "useVirtualScroll", description: "Virtual scrolling for large lists", status: "active" },
      { name: "useOptimistic", description: "Optimistic UI updates", status: "active" },
      { name: "useRealAnalytics", description: "Analytics event tracking", status: "active" },
      { name: "useSelfDiagnostic", description: "Self-diagnostic health checks", status: "active" },
      { name: "useStableAsync", description: "Stable async operation wrapper (prevents race conditions)", status: "active" },
      { name: "useStablePageMount", description: "Stable page mounting guard", status: "active" },
      { name: "useAgentChat", description: "AI agent chat interaction logic", status: "active", tags: ["ai"] },
      { name: "useWidgetBehaviorEngine", description: "Widget behavior and interaction engine", status: "active" },
    ],
  },
];

// ─── Status badge colors ─────────────────────────────────────

const statusConfig = {
  active: { label: "Active", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  beta: { label: "Beta", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  internal: { label: "Internal", className: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  deprecated: { label: "Deprecated", className: "bg-red-500/20 text-red-300 border-red-500/30" },
  broken: { label: "Broken", className: "bg-red-600/30 text-red-400 border-red-500/40" },
  stub: { label: "Stub", className: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
};

// ─── Component ───────────────────────────────────────────────

export default function AppInventory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(INVENTORY.map(s => s.id)));

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedSections(new Set(INVENTORY.map(s => s.id)));
  const collapseAll = () => setExpandedSections(new Set());

  const filtered = useMemo(() => {
    if (!search.trim()) return INVENTORY;
    const q = search.toLowerCase();
    return INVENTORY.map(section => ({
      ...section,
      items: section.items.filter(
        item =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.tags?.some(t => t.toLowerCase().includes(q))
      ),
    })).filter(section => section.items.length > 0);
  }, [search]);

  const totalItems = INVENTORY.reduce((acc, s) => acc + s.items.length, 0);
  const totalActive = INVENTORY.reduce((acc, s) => acc + s.items.filter(i => i.status === "active").length, 0);
  const totalBeta = INVENTORY.reduce((acc, s) => acc + s.items.filter(i => i.status === "beta").length, 0);
  const totalBroken = INVENTORY.reduce((acc, s) => acc + s.items.filter(i => i.status === "broken").length, 0);
  const totalStub = INVENTORY.reduce((acc, s) => acc + s.items.filter(i => i.status === "stub").length, 0);

  return (
    <div className="text-foreground">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">App Inventory</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Complete catalog of every service, feature, and component
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-xs font-medium text-red-300">{totalBroken} Broken</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-xs font-medium text-orange-300">{totalStub} Stub</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-300">{totalActive} Active</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs font-medium text-amber-300">{totalBeta} Beta</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border">
              <span className="text-xs font-medium text-muted-foreground">{totalItems} Total</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search features, functions, hooks, tables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted/50 border-border/50"
            />
          </div>
          <button
            onClick={expandAll}
            className="px-3 py-2 text-xs font-medium rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 text-xs font-medium rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No results for "{search}"</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        )}

        {filtered.map((section) => {
          const isOpen = expandedSections.has(section.id);
          const Icon = section.icon;

          return (
            <Collapsible key={section.id} open={isOpen} onOpenChange={() => toggleSection(section.id)}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center gap-3 p-4 rounded-xl bg-card/60 border border-border/40 hover:bg-card/80 hover:border-border/60 transition-all group">
                  <div className={`p-2 rounded-lg bg-muted/50 ${section.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-sm sm:text-base">{section.title}</h2>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border/50 text-muted-foreground">
                        {section.items.length}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{section.description}</p>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform" />
                  )}
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="mt-1 rounded-xl border border-border/30 bg-card/30 overflow-hidden">
                  <div className="divide-y divide-border/20">
                    {section.items.map((item, idx) => {
                      const sc = statusConfig[item.status];
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-medium text-foreground/90 truncate">
                                {item.name}
                              </span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border ${sc.className}`}>
                                {sc.label}
                              </Badge>
                              {item.tags?.map(tag => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 border-border/30 text-muted-foreground"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-xs text-muted-foreground text-center">
            Genesis Director — {INVENTORY.length} categories · {totalItems} items · Last updated Feb 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
