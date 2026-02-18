/**
 * Hoppy Rich Content Blocks — Premium UI Cards
 * 
 * Renders structured data from Hoppy's tool results as 
 * beautiful, page-quality cards inside the chat.
 * Each card can include a "Go to page" navigation action.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { 
  Film, Sparkles, Zap, Star, Crown, Eye, Heart, Clock, 
  User, MessageCircle, MapPin, Target, CheckCircle, Circle,
  TrendingUp, Palette, Play, ChevronRight, Settings, Send,
  Award, Flame, Trophy, Globe, CreditCard, ExternalLink,
  ArrowRight, Users, HelpCircle, Info, Clapperboard, X, Volume2, VolumeX
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface RichBlock {
  type: string;
  data: any;
}

interface RichBlocksRendererProps {
  blocks: RichBlock[];
  onNavigate?: (path: string) => void;
  onSendMessage?: (content: string) => void;
}

export function RichBlocksRenderer({ blocks, onNavigate, onSendMessage }: RichBlocksRendererProps) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-4 mt-3">
      {blocks.map((block, i) => (
        <motion.div
          key={`${block.type}-${i}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
        >
          <BlockRouter block={block} onNavigate={onNavigate} onSendMessage={onSendMessage} />
        </motion.div>
      ))}
    </div>
  );
}

function BlockRouter({ block, onNavigate, onSendMessage }: { block: RichBlock; onNavigate?: (path: string) => void; onSendMessage?: (content: string) => void }) {
  const nav = onNavigate;
  switch (block.type) {
    case "page_embed": return <PageEmbedBlock data={block.data} onNavigate={nav} />;
    case "project_list": return <ProjectListBlock data={block.data} onNavigate={nav} />;
    case "project_detail": return <ProjectDetailBlock data={block.data} onNavigate={nav} />;
    case "credits": return <CreditsBlock data={block.data} onNavigate={nav} />;
    case "avatar_list": return <AvatarListBlock data={block.data} onNavigate={nav} />;
    case "gallery": return <GalleryBlock data={block.data} onNavigate={nav} />;
    case "profile": return <ProfileBlock data={block.data} onNavigate={nav} />;
    case "gamification": return <GamificationBlock data={block.data} />;
    case "environments": return <EnvironmentsBlock data={block.data} />;
    case "production_status": return <ProductionStatusBlock data={block.data} />;
    case "cost_estimate": return <CostEstimateBlock data={block.data} />;
    case "comments": return <CommentsBlock data={block.data} />;
    case "world_chat": return <WorldChatBlock data={block.data} onNavigate={nav} />;
    case "shot_list": return <ShotListBlock data={block.data} />;
    case "onboarding": return <OnboardingBlock data={block.data} />;
    case "settings": return <SettingsBlock data={block.data} onNavigate={nav} />;
    case "multiple_choice": return <MultipleChoiceBlock data={block.data} onSendMessage={onSendMessage} />;
    case "generation_progress": return <GenerationProgressBlock data={block.data} onNavigate={nav} />;
    default: return null;
  }
}

// ═══════════════════════════════════════════════
// Shared Card Shell
// ═══════════════════════════════════════════════

function RichCard({ children, className, accent }: { children: React.ReactNode; className?: string; accent?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden",
        "bg-surface-1/50 backdrop-blur-xl",
        "shadow-[0_2px_16px_hsl(0_0%_0%/0.12)]",
        className
      )}
      style={{
        borderColor: "hsl(var(--border) / 0.1)",
        ...(accent ? { borderTopColor: accent, borderTopWidth: "2px" } : {}),
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title, badge, accentColor, navigateTo, onNavigate }: { 
  icon: any; title: string; badge?: string; accentColor?: string;
  navigateTo?: string; onNavigate?: (path: string) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "hsl(var(--border) / 0.07)" }}>
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg" style={{ background: accentColor ? `${accentColor}18` : 'hsl(var(--primary) / 0.08)' }}>
          <Icon className="h-3.5 w-3.5" style={{ color: accentColor || 'hsl(var(--primary))' }} />
        </div>
        <span className="font-display text-[13px] font-semibold text-foreground/80 tracking-tight">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground/50">
            {badge}
          </span>
        )}
        {navigateTo && onNavigate && (
          <button
            onClick={() => onNavigate(navigateTo)}
            className="flex items-center gap-1 text-[10px] font-display font-semibold px-2 py-1 rounded-lg
                       bg-primary/6 text-primary/60 hover:bg-primary/12 hover:text-primary
                       border border-primary/8 hover:border-primary/18
                       transition-all duration-150 active:scale-[0.97]"
          >
            Open <ExternalLink className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Icon resolver for page_embed
const PAGE_ICONS: Record<string, any> = {
  film: Film, sparkles: Sparkles, user: User, settings: Settings,
  zap: Zap, play: Play, globe: Globe, users: Users, info: Info,
  help: HelpCircle, send: Send, "arrow-right": ArrowRight,
};

// ═══════════════════════════════════════════════
// PAGE EMBED — Beautiful page preview card
// ═══════════════════════════════════════════════

function PageEmbedBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const Icon = PAGE_ICONS[data.icon] || ArrowRight;
  const accent = data.accent || "hsl(var(--primary))";
  
  return (
    <RichCard accent={accent}>
      <button
        onClick={() => onNavigate?.(data.path)}
        className="w-full text-left group"
      >
        <div className="p-5 flex items-center gap-4">
          {/* Icon */}
          <div 
            className="p-3.5 rounded-2xl border transition-all duration-300 group-hover:scale-105 flex-shrink-0"
            style={{ 
              background: `${accent}15`,
              borderColor: `${accent}20`,
            }}
          >
            <Icon className="h-6 w-6" style={{ color: accent }} />
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-display text-base font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
              {data.title}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed">
              {data.reason || data.description}
            </p>
          </div>
          
          {/* Arrow */}
          <div className="p-2.5 rounded-xl bg-primary/8 border border-primary/10 flex-shrink-0
                        group-hover:bg-primary group-hover:border-primary transition-all duration-200">
            <ArrowRight className="h-4 w-4 text-primary group-hover:text-primary-foreground transition-colors" />
          </div>
        </div>
        
        {/* Bottom bar */}
        <div className="px-5 pb-3 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/30 font-mono tracking-wider uppercase">
            {data.path}
          </span>
          <div className="flex-1" />
          <span className="text-[10px] text-primary/50 font-display font-medium group-hover:text-primary transition-colors">
            Click to open →
          </span>
        </div>
      </button>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// PROJECT LIST
// ═══════════════════════════════════════════════

function ProjectListBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const projects = data.projects || [];
  const [activeItem, setActiveItem] = useState<any | null>(null);

  return (
    <>
    <RichCard accent="hsl(24, 95%, 53%)">
      <CardHeader icon={Film} title="Your Projects" badge={`${data.total || projects.length}`} accentColor="hsl(24, 95%, 53%)" navigateTo={data.navigateTo} onNavigate={onNavigate} />
      <div className="divide-y divide-border/6">
        {projects.slice(0, 6).map((p: any) => {
          const hasVideo = !!(p.video_url || (p.video_clips && p.video_clips.length > 0));
          return (
            <div
              key={p.id}
              onClick={() => hasVideo ? setActiveItem(p) : undefined}
              className={cn(
                "px-5 py-3.5 flex items-center gap-4 transition-colors",
                hasVideo ? "cursor-pointer hover:bg-surface-2/50 group" : "cursor-default hover:bg-surface-2/30"
              )}
            >
              {/* Thumbnail */}
              <div className="relative w-14 h-10 rounded-lg bg-surface-2/80 border border-border/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Film className="h-4 w-4 text-muted-foreground/30" />
                )}
                {hasVideo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="h-3.5 w-3.5 text-white fill-white" />
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.title || "Untitled"}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-muted-foreground/50">{p.clip_count ?? 0} clips</span>
                  <StatusPill status={p.status || "draft"} />
                </div>
              </div>
              {hasVideo
                ? <Play className="h-3.5 w-3.5 text-primary/40 flex-shrink-0 group-hover:text-primary transition-colors" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground/20 flex-shrink-0" />
              }
            </div>
          );
        })}
      </div>
      {/* Footer with navigation */}
      {data.navigateTo && onNavigate && projects.length > 0 && (
        <button
          onClick={() => onNavigate(data.navigateTo)}
          className="w-full px-5 py-3 border-t border-border/8 flex items-center justify-center gap-2
                     text-xs font-display font-semibold text-primary/70 hover:text-primary hover:bg-primary/5 transition-all"
        >
          View All Projects <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </RichCard>

      {activeItem && <VideoPlayerModal item={activeItem} onClose={() => setActiveItem(null)} />}
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    draft: { color: "hsl(var(--muted-foreground))", label: "Draft" },
    generating: { color: "hsl(38, 92%, 50%)", label: "Generating" },
    completed: { color: "hsl(145, 55%, 45%)", label: "Complete" },
    published: { color: "hsl(var(--primary))", label: "Published" },
    failed: { color: "hsl(0, 70%, 55%)", label: "Failed" },
  };
  const s = map[status] || map.draft;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

// ═══════════════════════════════════════════════
// PROJECT DETAIL
// ═══════════════════════════════════════════════

function ProjectDetailBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  return (
    <RichCard accent="hsl(24, 95%, 53%)">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-20 h-14 rounded-xl bg-surface-2/80 border border-border/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {data.thumbnail_url ? (
              <img src={data.thumbnail_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Film className="h-5 w-5 text-muted-foreground/30" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-bold text-foreground tracking-tight truncate">{data.title}</h3>
            <div className="flex items-center gap-3 mt-1.5">
              <StatusPill status={data.status || "draft"} />
              {data.clip_count !== undefined && (
                <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                  <Film className="h-3 w-3" /> {data.clip_count} clips
                </span>
              )}
            </div>
            {data.description && (
              <p className="text-xs text-muted-foreground/60 mt-2 line-clamp-2 leading-relaxed">{data.description}</p>
            )}
          </div>
        </div>
        {/* Stats row */}
        {(data.views !== undefined || data.likes !== undefined) && (
          <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border/8">
            {data.views !== undefined && (
              <span className="text-xs text-muted-foreground/50 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> {data.views}
              </span>
            )}
            {data.likes !== undefined && (
              <span className="text-xs text-muted-foreground/50 flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5" /> {data.likes}
              </span>
            )}
          </div>
        )}
      </div>
      {data.navigateTo && onNavigate && (
        <button
          onClick={() => onNavigate(data.navigateTo)}
          className="w-full px-5 py-3 border-t border-border/8 flex items-center justify-center gap-2
                     text-xs font-display font-semibold text-primary/70 hover:text-primary hover:bg-primary/5 transition-all"
        >
          Open Project <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// CREDITS
// ═══════════════════════════════════════════════

function CreditsBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const balance = data.balance ?? data.credits ?? 0;
  return (
    <RichCard accent="hsl(38, 92%, 50%)">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/15">
              <Zap className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/40 font-display font-medium">Credit Balance</p>
              <p className="text-2xl font-display font-bold text-foreground tracking-tight mt-0.5">
                {balance.toLocaleString()}
                <span className="text-sm text-muted-foreground/40 ml-1.5 font-normal">credits</span>
              </p>
            </div>
          </div>
          {data.navigateTo && onNavigate && (
            <button
              onClick={() => onNavigate(data.navigateTo)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-display font-semibold
                         bg-amber-500/10 text-amber-400 border border-amber-500/15
                         hover:bg-amber-500/20 transition-all"
            >
              <Zap className="h-3 w-3" /> Buy More
            </button>
          )}
        </div>
        {(data.tier || data.total_spent !== undefined) && (
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/8">
            {data.tier && (
              <span className="text-xs text-primary/70 flex items-center gap-1.5 font-medium">
                <Crown className="h-3.5 w-3.5" /> {data.tier}
              </span>
            )}
            {data.total_spent !== undefined && (
              <span className="text-xs text-muted-foreground/50">
                {data.total_spent} spent all-time
              </span>
            )}
          </div>
        )}
      </div>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// AVATAR LIST
// ═══════════════════════════════════════════════

function AvatarListBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const avatars = data.avatars || [];
  return (
    <RichCard accent="hsl(38, 92%, 50%)">
      <CardHeader icon={User} title="Avatars" badge={`${avatars.length}`} accentColor="hsl(38, 92%, 50%)" navigateTo={data.navigateTo} onNavigate={onNavigate} />
      <div className="p-4 grid grid-cols-3 gap-3">
        {avatars.slice(0, 6).map((a: any) => (
          <div key={a.id || a.name} className="group flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-2/30 border border-border/8 hover:border-primary/20 transition-all cursor-default">
            <div className="w-12 h-12 rounded-full bg-surface-2/60 border border-border/10 overflow-hidden">
              {a.face_image_url || a.thumbnail_url ? (
                <img src={a.face_image_url || a.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground/25" />
                </div>
              )}
            </div>
            <span className="text-[11px] font-medium text-foreground/80 text-center truncate w-full">{a.name}</span>
            {a.gender && <span className="text-[9px] text-muted-foreground/40 capitalize">{a.gender}</span>}
          </div>
        ))}
      </div>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// GALLERY
// ═══════════════════════════════════════════════

function VideoPlayerModal({ item, onClose }: { item: any; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);

  // Prefer direct MP4 clips over HLS manifest JSON
  const playableUrl = (() => {
    if (item.video_clips && item.video_clips.length > 0) {
      return item.video_clips[0];
    }
    // Only use video_url if it's an MP4, not a JSON manifest
    if (item.video_url && (item.video_url.endsWith('.mp4') || item.video_url.includes('.mp4'))) {
      return item.video_url;
    }
    return null;
  })();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Video */}
          <div className="relative aspect-video bg-black">
            {playableUrl ? (
              <video
                ref={videoRef}
                src={playableUrl}
                autoPlay
                loop
                muted={muted}
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <Film className="h-10 w-10 text-white/20" />
                <p className="text-white/40 text-sm">No playable video available</p>
              </div>
            )}

            {/* Controls overlay */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <button
                onClick={() => setMuted(m => !m)}
                className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Title */}
          {item.title && (
            <div className="px-4 py-3 border-t border-white/8">
              <p className="text-sm font-medium text-white/80 truncate">{item.title}</p>
              {item.video_clips && item.video_clips.length > 1 && (
                <p className="text-[11px] text-white/40 mt-0.5">Showing clip 1 of {item.video_clips.length}</p>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function GalleryBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const items = data.items || [];
  const [activeItem, setActiveItem] = useState<any | null>(null);

  return (
    <>
      <RichCard accent="hsl(270, 60%, 60%)">
        <CardHeader icon={Play} title="Gallery" badge={`${data.total || items.length}`} accentColor="hsl(270, 60%, 60%)" navigateTo={data.navigateTo} onNavigate={onNavigate} />
        <div className="p-4 grid grid-cols-2 gap-3">
          {items.slice(0, 4).map((v: any) => (
            <button
              key={v.id}
              onClick={() => setActiveItem(v)}
              className="group relative rounded-xl overflow-hidden bg-surface-2/50 border border-border/8 aspect-video text-left hover:border-primary/30 transition-all"
            >
              {v.thumbnail_url ? (
                <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="h-6 w-6 text-muted-foreground/20" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-2.5">
                <span className="text-[11px] font-medium text-white/80 truncate">{v.title || "Untitled"}</span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center
                                group-hover:bg-white/25 group-hover:scale-110 transition-all duration-200">
                  <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </RichCard>

      {activeItem && <VideoPlayerModal item={activeItem} onClose={() => setActiveItem(null)} />}
    </>
  );
}

// ═══════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════

function ProfileBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  return (
    <RichCard accent="hsl(145, 55%, 45%)">
      <div className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-surface-2/80 border-2 border-primary/20 overflow-hidden flex items-center justify-center">
            {data.avatar_url ? (
              <img src={data.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="h-6 w-6 text-muted-foreground/30" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold text-foreground">{data.display_name || data.username}</h3>
            <p className="text-xs text-muted-foreground/50">@{data.username}</p>
          </div>
          {data.navigateTo && onNavigate && (
            <button
              onClick={() => onNavigate(data.navigateTo)}
              className="flex items-center gap-1 text-[10px] font-display font-semibold px-2.5 py-1.5 rounded-full
                         bg-primary/8 text-primary/70 hover:bg-primary/15 hover:text-primary
                         border border-primary/10 transition-all"
            >
              View <ExternalLink className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
        {data.bio && (
          <p className="text-xs text-muted-foreground/60 mt-3 leading-relaxed">{data.bio}</p>
        )}
        <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border/8">
          {data.followers_count !== undefined && (
            <span className="text-xs text-muted-foreground/50">
              <strong className="text-foreground/80">{data.followers_count}</strong> followers
            </span>
          )}
          {data.following_count !== undefined && (
            <span className="text-xs text-muted-foreground/50">
              <strong className="text-foreground/80">{data.following_count}</strong> following
            </span>
          )}
          {data.total_projects !== undefined && (
            <span className="text-xs text-muted-foreground/50">
              <strong className="text-foreground/80">{data.total_projects}</strong> projects
            </span>
          )}
        </div>
      </div>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// GAMIFICATION
// ═══════════════════════════════════════════════

function GamificationBlock({ data }: { data: any }) {
  const xpPercent = data.xp_to_next_level ? Math.min(100, ((data.current_xp || 0) / data.xp_to_next_level) * 100) : 0;
  return (
    <RichCard accent="hsl(280, 70%, 55%)">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/15">
              <Trophy className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/40 font-display font-medium">Level</p>
              <p className="text-xl font-display font-bold text-foreground">{data.level}</p>
            </div>
          </div>
          {data.streak !== undefined && data.streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/15">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-xs font-bold text-orange-400">{data.streak}</span>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/40 font-medium">XP Progress</span>
            <span className="text-[10px] text-muted-foreground/40 font-mono">
              {data.current_xp || 0} / {data.xp_to_next_level || "?"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-2/80 overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border/8">
          {data.total_achievements !== undefined && (
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{data.total_achievements}</p>
              <p className="text-[10px] text-muted-foreground/40">Achievements</p>
            </div>
          )}
          {data.total_xp !== undefined && (
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{data.total_xp.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground/40">Total XP</p>
            </div>
          )}
          {data.videos_created !== undefined && (
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{data.videos_created}</p>
              <p className="text-[10px] text-muted-foreground/40">Videos</p>
            </div>
          )}
        </div>
      </div>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// ENVIRONMENTS
// ═══════════════════════════════════════════════

function EnvironmentsBlock({ data }: { data: any }) {
  const envs = data.environments || [];
  return (
    <RichCard accent="hsl(195, 100%, 50%)">
      <CardHeader icon={Globe} title="Environments" badge={`${envs.length}`} accentColor="hsl(195, 100%, 50%)" />
      <div className="p-4 grid grid-cols-2 gap-3">
        {envs.slice(0, 4).map((e: any) => (
          <div key={e.id || e.template_name} className="rounded-xl bg-surface-2/30 border border-border/8 p-3 hover:border-cyan-500/20 transition-all">
            {e.thumbnail_url && (
              <div className="w-full aspect-[16/9] rounded-lg overflow-hidden mb-2 bg-surface-2/50">
                <img src={e.thumbnail_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <p className="text-xs font-medium text-foreground/80 truncate">{e.template_name || e.name}</p>
            {e.atmosphere && <p className="text-[10px] text-muted-foreground/40 mt-0.5 capitalize">{e.atmosphere}</p>}
          </div>
        ))}
      </div>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// GENERATION PROGRESS — Live polling card
// ═══════════════════════════════════════════════

type ClipStatus = "pending" | "generating" | "completed" | "failed";

interface ClipState {
  shot_index: number;
  status: ClipStatus;
  video_url?: string | null;
}

function GenerationProgressBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const projectId: string = data.project_id;
  const title: string = data.title || "Video";
  const totalClips: number = data.total_clips || data.clip_count || 3;

  const [clips, setClips] = useState<ClipState[]>([]);
  const [projectStatus, setProjectStatus] = useState<string>("generating");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    const { data: proj } = await supabase
      .from("movie_projects")
      .select("status, video_url")
      .eq("id", projectId)
      .single();

    const { data: vc } = await supabase
      .from("video_clips")
      .select("shot_index, status, video_url")
      .eq("project_id", projectId)
      .order("shot_index");

    if (vc) setClips(vc as ClipState[]);
    if (proj) setProjectStatus(proj.status);

    // Stop polling when done
    if (proj && (proj.status === "completed" || proj.status === "failed")) {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [projectId]);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [poll]);

  const completed = clips.filter(c => c.status === "completed").length;
  const failed = clips.filter(c => c.status === "failed").length;
  const generating = clips.filter(c => c.status === "generating").length;
  const progress = totalClips > 0 ? Math.round((completed / totalClips) * 100) : 0;
  const isDone = projectStatus === "completed";
  const isFailed = projectStatus === "failed" && !generating && completed === 0;

  const accentColor = isDone
    ? "hsl(145, 55%, 45%)"
    : isFailed
    ? "hsl(0, 70%, 55%)"
    : "hsl(195, 100%, 50%)";

  // Build pill slots — use actual clips or placeholders
  const slots: Array<{ index: number; status: ClipStatus }> = Array.from({ length: totalClips }, (_, i) => {
    const found = clips.find(c => c.shot_index === i);
    return { index: i, status: found?.status ?? "pending" };
  });

  return (
    <RichCard accent={accentColor}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "hsl(var(--border) / 0.07)" }}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${accentColor}18` }}>
            <Clapperboard className="h-3.5 w-3.5" style={{ color: accentColor }} />
          </div>
          <span className="font-display text-[13px] font-semibold text-foreground/80 tracking-tight truncate max-w-[160px]">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isDone && !isFailed && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Live
            </span>
          )}
          {onNavigate && (
            <button
              onClick={() => onNavigate(`/production/${projectId}`)}
              className="flex items-center gap-1 text-[10px] font-display font-semibold px-2 py-1 rounded-lg
                         bg-primary/6 text-primary/60 hover:bg-primary/12 hover:text-primary
                         border border-primary/8 hover:border-primary/18
                         transition-all duration-150 active:scale-[0.97]"
            >
              Open <ExternalLink className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground/50 font-display">
            {isDone
              ? `✓ All ${totalClips} clips ready`
              : isFailed
              ? `Generation failed`
              : generating > 0
              ? `Clip ${completed + 1} of ${totalClips} generating…`
              : `${completed} of ${totalClips} clips done`}
          </span>
          <span className="text-[11px] font-mono font-medium" style={{ color: accentColor }}>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-surface-2/80">
          <motion.div
            className="h-full rounded-full"
            style={{ background: accentColor }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Clip grid */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex flex-wrap gap-2">
          {slots.map(({ index, status }) => {
            const isGen = status === "generating";
            const isDoneClip = status === "completed";
            const isFail = status === "failed";
            const clipColor = isDoneClip
              ? "hsl(145, 55%, 45%)"
              : isFail
              ? "hsl(0, 70%, 55%)"
              : isGen
              ? "hsl(195, 100%, 50%)"
              : "hsl(var(--muted-foreground))";

            return (
              <div key={index} className="relative flex flex-col items-center gap-1">
                <div
                  className="w-9 h-9 rounded-lg border flex items-center justify-center transition-all duration-300"
                  style={{
                    borderColor: `${clipColor}40`,
                    background: isDoneClip
                      ? `${clipColor}15`
                      : isGen
                      ? `${clipColor}10`
                      : "hsl(var(--surface-2) / 0.4)",
                  }}
                >
                  {isDoneClip && <CheckCircle className="h-4 w-4" style={{ color: clipColor }} />}
                  {isFail && <X className="h-4 w-4" style={{ color: clipColor }} />}
                  {isGen && (
                    <motion.div
                      className="w-4 h-4 rounded-full border-2"
                      style={{ borderColor: `${clipColor}30`, borderTopColor: clipColor }}
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                    />
                  )}
                  {status === "pending" && (
                    <span className="text-[11px] font-mono text-muted-foreground/30">{index + 1}</span>
                  )}
                </div>
                <span className="text-[9px] font-mono text-muted-foreground/30">C{index + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Failed clip warning */}
      {failed > 0 && (
        <div className="px-4 pb-3">
          <p className="text-[11px] text-red-400/70">
            {failed} clip{failed > 1 ? "s" : ""} failed — credits auto-refunded.
          </p>
        </div>
      )}
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// PRODUCTION STATUS
// ═══════════════════════════════════════════════

function ProductionStatusBlock({ data }: { data: any }) {
  const statusColor = data.status === "completed" ? "hsl(145, 55%, 45%)" : data.status === "failed" ? "hsl(0, 70%, 55%)" : "hsl(195, 100%, 50%)";
  return (
    <RichCard accent={statusColor}>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl" style={{ background: `${statusColor}20` }}>
            <Target className="h-4 w-4" style={{ color: statusColor }} />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-foreground">Production Status</p>
            <StatusPill status={data.status} />
          </div>
        </div>
        {data.progress !== undefined && (
          <div className="mt-3">
            <div className="h-2 rounded-full bg-surface-2/80 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${data.progress}%`, background: statusColor }} />
            </div>
            <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-right font-mono">{data.progress}%</p>
          </div>
        )}
      </div>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// COST ESTIMATE
// ═══════════════════════════════════════════════

function CostEstimateBlock({ data }: { data: any }) {
  return (
    <RichCard accent="hsl(38, 92%, 50%)">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/15">
            <CreditCard className="h-4 w-4 text-amber-400" />
          </div>
          <p className="font-display text-sm font-semibold text-foreground">Cost Estimate</p>
        </div>
        <div className="text-center py-3">
          <p className="text-3xl font-display font-bold text-foreground">
            {data.total_credits}
            <span className="text-sm text-muted-foreground/40 ml-1.5 font-normal">credits</span>
          </p>
        </div>
        {data.breakdown && Array.isArray(data.breakdown) && (
          <div className="mt-3 pt-3 border-t border-border/8 space-y-2">
            {data.breakdown.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground/60">{item.item || item.label}</span>
                <span className="text-foreground/80 font-mono">{item.credits || item.cost}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════

function CommentsBlock({ data }: { data: any }) {
  const comments = data.comments || [];
  return (
    <RichCard accent="hsl(var(--primary))">
      <CardHeader icon={MessageCircle} title="Comments" badge={`${comments.length}`} />
      <div className="divide-y divide-border/6 max-h-64 overflow-y-auto">
        {comments.slice(0, 5).map((c: any) => (
          <div key={c.id} className="px-5 py-3 flex gap-3">
            <div className="w-7 h-7 rounded-full bg-surface-2/80 border border-border/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
              {c.avatar_url ? (
                <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="h-3 w-3 text-muted-foreground/25" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-foreground/70">{c.username || "Anonymous"}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-2">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// WORLD CHAT
// ═══════════════════════════════════════════════

function WorldChatBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const messages = data.messages || [];
  return (
    <RichCard accent="hsl(195, 100%, 50%)">
      <CardHeader icon={Globe} title="World Chat" badge="Live" accentColor="hsl(195, 100%, 50%)" navigateTo={data.navigateTo} onNavigate={onNavigate} />
      <div className="divide-y divide-border/4 max-h-48 overflow-y-auto">
        {messages.slice(0, 8).map((m: any, i: number) => (
          <div key={m.id || i} className="px-5 py-2 flex items-start gap-2.5">
            <span className="text-[11px] font-medium text-primary/60 flex-shrink-0">{m.username || "User"}</span>
            <span className="text-[11px] text-muted-foreground/60">{m.content}</span>
          </div>
        ))}
      </div>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// SHOT LIST
// ═══════════════════════════════════════════════

function ShotListBlock({ data }: { data: any }) {
  const shots = data.shot_list || data.shots || [];
  return (
    <RichCard accent="hsl(195, 100%, 50%)">
      <CardHeader icon={Target} title="Shot List" badge={`${Array.isArray(shots) ? shots.length : 0} shots`} accentColor="hsl(195, 100%, 50%)" />
      {Array.isArray(shots) && (
        <div className="divide-y divide-border/6">
          {shots.slice(0, 6).map((shot: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-start gap-3">
              <span className="text-[10px] font-mono text-primary/40 bg-primary/5 px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground/80">{shot.description || shot.shot || shot}</p>
                {shot.camera && <p className="text-[10px] text-cyan-400/50 mt-0.5">📷 {shot.camera}</p>}
                {shot.duration && <p className="text-[10px] text-muted-foreground/40 mt-0.5">{shot.duration}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════

function OnboardingBlock({ data }: { data: any }) {
  const steps = Array.isArray(data.steps) ? data.steps : [];
  return (
    <RichCard accent="hsl(var(--primary))">
      <CardHeader icon={Sparkles} title="Getting Started" />
      <div className="p-5 space-y-3">
        {steps.map((step: any, i: number) => (
          <div key={i} className="flex items-center gap-3">
            {step.completed ? (
              <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
            )}
            <span className={cn(
              "text-xs",
              step.completed ? "text-muted-foreground/50 line-through" : "text-foreground/80"
            )}>
              {step.title || step.name || step}
            </span>
          </div>
        ))}
      </div>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════

function SettingsBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const settings = data.settings || data;
  const entries = Object.entries(settings).filter(([k]) => !k.startsWith("_") && k !== "id" && k !== "navigateTo");
  return (
    <RichCard accent="hsl(var(--muted-foreground))">
      <CardHeader icon={Settings} title="Account Settings" navigateTo={data.navigateTo} onNavigate={onNavigate} />
      <div className="divide-y divide-border/6">
        {entries.slice(0, 8).map(([key, val]) => (
          <div key={key} className="px-5 py-2.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground/60 capitalize">{key.replace(/_/g, " ")}</span>
            <span className="text-xs text-foreground/80 font-medium truncate max-w-[50%] text-right">
              {typeof val === "boolean" ? (val ? "✓ On" : "✗ Off") : String(val || "—")}
            </span>
          </div>
        ))}
      </div>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// MULTIPLE CHOICE — Interactive selection cards
// ═══════════════════════════════════════════════



function MultipleChoiceBlock({ data, onSendMessage }: { data: any; onSendMessage?: (content: string) => void }) {
  const options: { id: string; label: string; description?: string; icon?: string; image_url?: string }[] = data.options || [];
  const maxSelections: number = data.max_selections || 1;
  const question: string = data.question || "Choose an option:";
  const choiceId: string = data.id || "choice";
  const layout: string = data.layout || "list";
  const hasImages = options.some((o) => o.image_url);
  const useGrid = layout === "grid" || hasImages;

  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const toggleOption = (optId: string) => {
    if (submitted) return;
    setSelected((prev) => {
      if (prev.includes(optId)) return prev.filter((s) => s !== optId);
      if (prev.length >= maxSelections) {
        return maxSelections === 1 ? [optId] : [...prev.slice(0, -1), optId];
      }
      return [...prev, optId];
    });
  };

  const handleSubmit = () => {
    if (selected.length === 0 || submitted) return;
    setSubmitted(true);
    const selectedLabels = selected
      .map((id) => options.find((o) => o.id === id)?.label)
      .filter(Boolean);
    const response = selectedLabels.length === 1
      ? selectedLabels[0]!
      : selectedLabels.join(" and ");
    onSendMessage?.(response);
  };

  // Auto-submit on single-select click for snappier UX
  const handleOptionClick = (optId: string) => {
    if (submitted) return;
    if (maxSelections === 1) {
      setSelected([optId]);
      setSubmitted(true);
      const label = options.find((o) => o.id === optId)?.label || optId;
      onSendMessage?.(label);
    } else {
      toggleOption(optId);
    }
  };

  const OPTION_ICONS: Record<string, any> = {
    film: Film, sparkles: Sparkles, zap: Zap, star: Star, crown: Crown,
    play: Play, globe: Globe, users: Users, settings: Settings, palette: Palette,
    target: Target, award: Award, flame: Flame, trophy: Trophy, send: Send,
    heart: Heart, eye: Eye, "credit-card": CreditCard, clapperboard: Clapperboard,
  };

  return (
    <div className="mt-3 mb-1">
      {/* Question header */}
      <div className="flex items-center gap-2.5 mb-3 px-1">
        <span className="font-display text-sm font-semibold text-foreground/80 tracking-tight">{question}</span>
      </div>
      {maxSelections > 1 && (
        <p className="text-[10px] text-muted-foreground/40 mb-2.5 px-1">
          Select up to {maxSelections}
        </p>
      )}

      {/* Options — Grid layout for visual cards, List for text-only */}
      <div className={cn(
        useGrid ? "grid grid-cols-2 gap-2" : "space-y-1.5"
      )}>
        {options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const IconComp = opt.icon ? OPTION_ICONS[opt.icon] : null;

          if (useGrid) {
            // ── Grid Card: Visual-first with optional image ──
            return (
              <button
                key={opt.id}
                onClick={() => handleOptionClick(opt.id)}
                disabled={submitted && !isSelected}
                className={cn(
                  "relative rounded-2xl overflow-hidden text-left transition-all duration-300 group",
                  "border backdrop-blur-sm",
                  submitted && isSelected
                    ? "ring-2 ring-primary/40 border-primary/30 shadow-[0_0_24px_hsl(var(--primary)/0.15)]"
                    : submitted
                    ? "opacity-30 cursor-not-allowed border-border/5"
                    : isSelected
                    ? "border-primary/30 shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
                    : "border-border/10 hover:border-primary/20 hover:shadow-[0_0_16px_hsl(var(--primary)/0.06)]"
                )}
                style={{
                  background: isSelected 
                    ? "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.03))"
                    : "hsl(var(--surface-1) / 0.4)",
                }}
              >
                {/* Image area */}
                {opt.image_url && (
                  <div className="relative w-full aspect-[3/4] overflow-hidden">
                    <img 
                      src={opt.image_url} 
                      alt={opt.label}
                      className={cn(
                        "w-full h-full object-cover object-top transition-transform duration-500",
                        !submitted && "group-hover:scale-105"
                      )}
                      loading="lazy"
                    />
                    {/* Gradient overlay for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    {/* Selection check overlay */}
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                        <CheckCircle className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}

                    {/* Label on image */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-sm font-display font-semibold text-white leading-tight drop-shadow-lg">
                        {opt.label}
                      </p>
                      {opt.description && (
                        <p className="text-[10px] text-white/60 mt-0.5 leading-relaxed line-clamp-2">
                          {opt.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* No image: icon + text grid card */}
                {!opt.image_url && (
                  <div className="p-4 flex flex-col gap-2 min-h-[100px]">
                    <div className="flex items-center justify-between">
                      {IconComp && (
                        <div className={cn(
                          "p-2 rounded-xl transition-colors",
                          isSelected ? "bg-primary/15" : "bg-surface-2/60 group-hover:bg-primary/8"
                        )}>
                          <IconComp className={cn("h-4.5 w-4.5", isSelected ? "text-primary" : "text-muted-foreground/50 group-hover:text-primary/60")} />
                        </div>
                      )}
                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className={cn(
                        "text-sm font-display font-semibold transition-colors leading-tight",
                        isSelected ? "text-foreground" : "text-foreground/75 group-hover:text-foreground"
                      )}>
                        {opt.label}
                      </p>
                      {opt.description && (
                        <p className="text-[10px] text-muted-foreground/45 mt-1 leading-relaxed line-clamp-2">
                          {opt.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          }

          // ── List layout: Horizontal card ──
          return (
            <button
              key={opt.id}
              onClick={() => handleOptionClick(opt.id)}
              disabled={submitted && !isSelected}
              className={cn(
                "w-full text-left px-4 py-3.5 rounded-2xl border transition-all duration-200",
                "flex items-center gap-3.5 group",
                submitted && isSelected
                  ? "bg-primary/10 border-primary/25 ring-1 ring-primary/15"
                  : submitted
                  ? "opacity-25 cursor-not-allowed border-border/5"
                  : isSelected
                  ? "bg-primary/8 border-primary/20 shadow-[0_0_16px_hsl(var(--primary)/0.06)]"
                  : "bg-surface-2/20 border-border/8 hover:border-primary/15 hover:bg-surface-2/40"
              )}
            >
              {/* Icon or image */}
              {opt.image_url ? (
                <div className="h-11 w-11 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-border/10">
                  <img src={opt.image_url} alt={opt.label} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ) : IconComp ? (
                <div className={cn(
                  "p-2 rounded-xl flex-shrink-0 transition-colors",
                  isSelected ? "bg-primary/12" : "bg-surface-2/50 group-hover:bg-primary/8"
                )}>
                  <IconComp className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground/50 group-hover:text-primary/60")} />
                </div>
              ) : null}

              {/* Label & description */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium transition-colors",
                  isSelected ? "text-foreground" : "text-foreground/75 group-hover:text-foreground"
                )}>
                  {opt.label}
                </p>
                {opt.description && (
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5 leading-relaxed line-clamp-1">
                    {opt.description}
                  </p>
                )}
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-3 w-3 text-primary-foreground" />
                </div>
              )}

              {!isSelected && !submitted && (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 transition-colors flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Multi-select submit button */}
      {maxSelections > 1 && !submitted && (
        <div className="mt-3 px-1">
          <button
            onClick={handleSubmit}
            disabled={selected.length === 0}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-display font-semibold transition-all duration-200",
              selected.length > 0
                ? "bg-primary text-primary-foreground shadow-[0_4px_16px_hsl(var(--primary)/0.25)] hover:shadow-[0_8px_24px_hsl(var(--primary)/0.3)] active:scale-[0.98]"
                : "bg-muted/30 text-muted-foreground/30 cursor-not-allowed"
            )}
          >
            {selected.length === 0
              ? "Select an option"
              : `Confirm${selected.length > 1 ? ` (${selected.length})` : ""}`}
          </button>
        </div>
      )}

      {/* Submitted state */}
      {submitted && (
        <div className="mt-2 px-1 flex items-center gap-1.5">
          <CheckCircle className="h-3 w-3 text-primary/50" />
          <span className="text-[10px] text-primary/50 font-display font-medium">
            {selected.length === 1 ? options.find(o => o.id === selected[0])?.label : "Choices submitted"}
          </span>
        </div>
      )}
    </div>
  );
}
