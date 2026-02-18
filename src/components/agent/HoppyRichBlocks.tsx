/**
 * Hoppy Rich Content Blocks — Minimal Clean Design
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => (
        <motion.div
          key={`${block.type}-${i}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.25 }}
        >
          <BlockRouter block={block} onNavigate={onNavigate} onSendMessage={onSendMessage} />
        </motion.div>
      ))}
    </div>
  );
}

function BlockRouter({ block, onNavigate, onSendMessage }: { block: RichBlock; onNavigate?: (path: string) => void; onSendMessage?: (content: string) => void }) {
  switch (block.type) {
    case "page_embed": return <PageEmbedBlock data={block.data} onNavigate={onNavigate} />;
    case "project_list": return <ProjectListBlock data={block.data} onNavigate={onNavigate} />;
    case "project_detail": return <ProjectDetailBlock data={block.data} onNavigate={onNavigate} />;
    case "credits": return <CreditsBlock data={block.data} onNavigate={onNavigate} />;
    case "avatar_list": return <AvatarListBlock data={block.data} onNavigate={onNavigate} />;
    case "gallery": return <GalleryBlock data={block.data} onNavigate={onNavigate} />;
    case "profile": return <ProfileBlock data={block.data} onNavigate={onNavigate} />;
    case "gamification": return <GamificationBlock data={block.data} />;
    case "environments": return <EnvironmentsBlock data={block.data} />;
    case "production_status": return <ProductionStatusBlock data={block.data} />;
    case "cost_estimate": return <CostEstimateBlock data={block.data} />;
    case "comments": return <CommentsBlock data={block.data} />;
    case "world_chat": return <WorldChatBlock data={block.data} onNavigate={onNavigate} />;
    case "shot_list": return <ShotListBlock data={block.data} />;
    case "onboarding": return <OnboardingBlock data={block.data} />;
    case "settings": return <SettingsBlock data={block.data} onNavigate={onNavigate} />;
    case "multiple_choice": return <MultipleChoiceBlock data={block.data} onSendMessage={onSendMessage} />;
    default: return null;
  }
}

// ═══════════════════════════════════════════════
// Shared Shell — minimal card
// ═══════════════════════════════════════════════

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/10 bg-muted/5 overflow-hidden", className)}>
      {children}
    </div>
  );
}

function CardTitle({ icon: Icon, title, badge, navigateTo, onNavigate }: {
  icon: any; title: string; badge?: string;
  navigateTo?: string; onNavigate?: (path: string) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/8">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
        <span className="text-xs font-semibold text-foreground/70">{title}</span>
        {badge && <span className="text-[10px] text-muted-foreground/35 font-mono">{badge}</span>}
      </div>
      {navigateTo && onNavigate && (
        <button
          onClick={() => onNavigate(navigateTo)}
          className="text-[11px] text-primary/60 hover:text-primary transition-colors flex items-center gap-1"
        >
          Open <ExternalLink className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

const PAGE_ICONS: Record<string, any> = {
  film: Film, sparkles: Sparkles, user: User, settings: Settings,
  zap: Zap, play: Play, globe: Globe, users: Users, info: Info,
  help: HelpCircle, send: Send, "arrow-right": ArrowRight,
};

// ═══════════════════════════════════════════════
// PAGE EMBED
// ═══════════════════════════════════════════════

function PageEmbedBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const Icon = PAGE_ICONS[data.icon] || ArrowRight;
  return (
    <Card>
      <button
        onClick={() => onNavigate?.(data.path)}
        className="w-full text-left group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/8 transition-colors"
      >
        <div className="p-2 rounded-lg bg-primary/8 flex-shrink-0">
          <Icon className="h-4 w-4 text-primary/70" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground/85 group-hover:text-foreground transition-colors">
            {data.title}
          </p>
          {(data.reason || data.description) && (
            <p className="text-xs text-muted-foreground/50 mt-0.5 line-clamp-1">
              {data.reason || data.description}
            </p>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors flex-shrink-0" />
      </button>
    </Card>
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
      <Card>
        <CardTitle icon={Film} title="Your Projects" badge={`${data.total || projects.length}`} navigateTo={data.navigateTo} onNavigate={onNavigate} />
        <div className="divide-y divide-border/6">
          {projects.slice(0, 6).map((p: any) => {
            const hasVideo = !!(p.video_url || (p.video_clips && p.video_clips.length > 0));
            return (
              <div
                key={p.id}
                onClick={() => hasVideo ? setActiveItem(p) : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors",
                  hasVideo ? "cursor-pointer hover:bg-muted/8 group" : "cursor-default"
                )}
              >
                <div className="relative w-11 h-8 rounded-lg bg-muted/10 border border-border/8 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Film className="h-3.5 w-3.5 text-muted-foreground/20" />
                  )}
                  {hasVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-3 w-3 text-white fill-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground/80 truncate">{p.title || "Untitled"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground/35">{p.clip_count ?? 0} clips</span>
                    <StatusDot status={p.status || "draft"} />
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 flex-shrink-0" />
              </div>
            );
          })}
        </div>
        {data.navigateTo && onNavigate && projects.length > 0 && (
          <button
            onClick={() => onNavigate(data.navigateTo)}
            className="w-full px-4 py-2.5 border-t border-border/8 text-xs text-primary/60 hover:text-primary
                       hover:bg-muted/5 transition-all flex items-center justify-center gap-1.5"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </Card>
      {activeItem && <VideoPlayerModal item={activeItem} onClose={() => setActiveItem(null)} />}
    </>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-muted-foreground/30",
    generating: "bg-amber-400",
    completed: "bg-emerald-400",
    published: "bg-primary",
    failed: "bg-red-400",
  };
  const labels: Record<string, string> = {
    draft: "Draft", generating: "Generating", completed: "Complete", published: "Published", failed: "Failed",
  };
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/40">
      <span className={cn("w-1.5 h-1.5 rounded-full", colors[status] || colors.draft)} />
      {labels[status] || status}
    </span>
  );
}

// ═══════════════════════════════════════════════
// PROJECT DETAIL
// ═══════════════════════════════════════════════

function ProjectDetailBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  return (
    <Card>
      <div className="p-4 flex items-start gap-3">
        <div className="w-16 h-11 rounded-lg bg-muted/10 border border-border/8 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {data.thumbnail_url ? (
            <img src={data.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Film className="h-4 w-4 text-muted-foreground/20" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground/85 truncate">{data.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <StatusDot status={data.status || "draft"} />
            {data.clip_count !== undefined && (
              <span className="text-[10px] text-muted-foreground/35">{data.clip_count} clips</span>
            )}
          </div>
          {(data.views !== undefined || data.likes !== undefined) && (
            <div className="flex items-center gap-3 mt-2">
              {data.views !== undefined && <span className="text-[10px] text-muted-foreground/35 flex items-center gap-1"><Eye className="h-3 w-3" />{data.views}</span>}
              {data.likes !== undefined && <span className="text-[10px] text-muted-foreground/35 flex items-center gap-1"><Heart className="h-3 w-3" />{data.likes}</span>}
            </div>
          )}
        </div>
      </div>
      {data.navigateTo && onNavigate && (
        <button
          onClick={() => onNavigate(data.navigateTo)}
          className="w-full px-4 py-2.5 border-t border-border/8 text-xs text-primary/60 hover:text-primary hover:bg-muted/5 transition-all flex items-center justify-center gap-1.5"
        >
          Open Project <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════
// CREDITS
// ═══════════════════════════════════════════════

function CreditsBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const balance = data.balance ?? data.credits ?? 0;
  return (
    <Card>
      <div className="p-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-muted-foreground/40 uppercase tracking-wider mb-1">Credit Balance</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {balance.toLocaleString()}
            <span className="text-sm text-muted-foreground/40 ml-1.5 font-normal">cr</span>
          </p>
          {data.tier && (
            <span className="text-[11px] text-primary/60 flex items-center gap-1 mt-1.5">
              <Crown className="h-3 w-3" />{data.tier}
            </span>
          )}
        </div>
        {data.navigateTo && onNavigate && (
          <button
            onClick={() => onNavigate(data.navigateTo)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border/10 text-foreground/60 hover:text-foreground hover:bg-muted/10 transition-all flex items-center gap-1.5"
          >
            <Zap className="h-3 w-3" /> Buy
          </button>
        )}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════
// AVATAR LIST
// ═══════════════════════════════════════════════

function AvatarListBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const avatars = data.avatars || [];
  return (
    <Card>
      <CardTitle icon={User} title="Avatars" badge={`${avatars.length}`} navigateTo={data.navigateTo} onNavigate={onNavigate} />
      <div className="p-3 grid grid-cols-3 gap-2">
        {avatars.slice(0, 6).map((a: any) => (
          <div key={a.id || a.name} className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-muted/5 border border-border/8">
            <div className="w-10 h-10 rounded-full bg-muted/10 overflow-hidden flex items-center justify-center">
              {a.face_image_url || a.thumbnail_url ? (
                <img src={a.face_image_url || a.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-muted-foreground/20" />
              )}
            </div>
            <span className="text-[10px] font-medium text-foreground/65 text-center truncate w-full">{a.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════
// VIDEO PLAYER MODAL
// ═══════════════════════════════════════════════

function VideoPlayerModal({ item, onClose }: { item: any; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);

  const playableUrl = (() => {
    if (item.video_clips && item.video_clips.length > 0) return item.video_clips[0];
    if (item.video_url && (item.video_url.endsWith('.mp4') || item.video_url.includes('.mp4'))) return item.video_url;
    return null;
  })();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-xl mx-4 rounded-xl overflow-hidden bg-black border border-white/8 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative aspect-video bg-black">
            {playableUrl ? (
              <video ref={videoRef} src={playableUrl} autoPlay loop muted={muted} playsInline className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <Film className="h-8 w-8 text-white/15" />
                <p className="text-white/30 text-sm">No playable video</p>
              </div>
            )}
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
              <button onClick={() => setMuted(m => !m)} className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white transition-colors">
                {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              </button>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          {item.title && (
            <div className="px-4 py-2.5 border-t border-white/6">
              <p className="text-sm text-white/70 truncate">{item.title}</p>
              {item.video_clips && item.video_clips.length > 1 && (
                <p className="text-[10px] text-white/30 mt-0.5">Clip 1 of {item.video_clips.length}</p>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════
// GALLERY
// ═══════════════════════════════════════════════

function GalleryBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const items = data.items || [];
  const [activeItem, setActiveItem] = useState<any | null>(null);

  return (
    <>
      <Card>
        <CardTitle icon={Play} title="Gallery" badge={`${data.total || items.length}`} navigateTo={data.navigateTo} onNavigate={onNavigate} />
        <div className="p-3 grid grid-cols-2 gap-2">
          {items.slice(0, 4).map((v: any) => (
            <button
              key={v.id}
              onClick={() => setActiveItem(v)}
              className="group relative rounded-lg overflow-hidden bg-muted/10 border border-border/8 aspect-video text-left hover:border-border/20 transition-all"
            >
              {v.thumbnail_url ? (
                <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="h-5 w-5 text-muted-foreground/20" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-2">
                <span className="text-[10px] font-medium text-white/70 truncate">{v.title || "Untitled"}</span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Play className="h-3.5 w-3.5 text-white fill-white ml-0.5" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>
      {activeItem && <VideoPlayerModal item={activeItem} onClose={() => setActiveItem(null)} />}
    </>
  );
}

// ═══════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════

function ProfileBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  return (
    <Card>
      <div className="p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-muted/10 border border-border/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {data.avatar_url ? <img src={data.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="h-4 w-4 text-muted-foreground/20" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground/85">{data.display_name || data.username}</h3>
          <p className="text-[11px] text-muted-foreground/40">@{data.username}</p>
          <div className="flex items-center gap-3 mt-1.5">
            {data.followers_count !== undefined && <span className="text-[10px] text-muted-foreground/40"><strong className="text-foreground/60">{data.followers_count}</strong> followers</span>}
            {data.following_count !== undefined && <span className="text-[10px] text-muted-foreground/40"><strong className="text-foreground/60">{data.following_count}</strong> following</span>}
          </div>
        </div>
        {data.navigateTo && onNavigate && (
          <button onClick={() => onNavigate(data.navigateTo)} className="text-[11px] text-primary/60 hover:text-primary transition-colors flex items-center gap-1">
            View <ExternalLink className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
      {data.bio && <p className="text-xs text-muted-foreground/50 px-4 pb-3 leading-relaxed">{data.bio}</p>}
    </Card>
  );
}

// ═══════════════════════════════════════════════
// GAMIFICATION
// ═══════════════════════════════════════════════

function GamificationBlock({ data }: { data: any }) {
  const xpPercent = data.xp_to_next_level ? Math.min(100, ((data.current_xp || 0) / data.xp_to_next_level) * 100) : 0;
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground/40" />
            <span className="text-sm font-semibold text-foreground/80">Level {data.level}</span>
          </div>
          {data.streak > 0 && (
            <span className="text-xs text-orange-400 flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" />{data.streak}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground/35">
            <span>XP Progress</span>
            <span className="font-mono">{data.current_xp || 0} / {data.xp_to_next_level || "?"}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/10 overflow-hidden">
            <div className="h-full rounded-full bg-primary/70 transition-all duration-700" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/8">
          {data.total_achievements !== undefined && <div className="text-center"><p className="text-sm font-bold text-foreground/80">{data.total_achievements}</p><p className="text-[10px] text-muted-foreground/35">Achievements</p></div>}
          {data.total_xp !== undefined && <div className="text-center"><p className="text-sm font-bold text-foreground/80">{data.total_xp.toLocaleString()}</p><p className="text-[10px] text-muted-foreground/35">Total XP</p></div>}
          {data.videos_created !== undefined && <div className="text-center"><p className="text-sm font-bold text-foreground/80">{data.videos_created}</p><p className="text-[10px] text-muted-foreground/35">Videos</p></div>}
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════
// ENVIRONMENTS
// ═══════════════════════════════════════════════

function EnvironmentsBlock({ data }: { data: any }) {
  const envs = data.environments || [];
  return (
    <Card>
      <CardTitle icon={Globe} title="Environments" badge={`${envs.length}`} />
      <div className="p-3 grid grid-cols-2 gap-2">
        {envs.slice(0, 4).map((e: any) => (
          <div key={e.id || e.template_name} className="rounded-lg border border-border/8 overflow-hidden">
            {e.thumbnail_url && (
              <div className="w-full aspect-video overflow-hidden bg-muted/10">
                <img src={e.thumbnail_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-2">
              <p className="text-xs font-medium text-foreground/70 truncate">{e.template_name || e.name}</p>
              {e.atmosphere && <p className="text-[10px] text-muted-foreground/35 mt-0.5 capitalize">{e.atmosphere}</p>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════
// PRODUCTION STATUS
// ═══════════════════════════════════════════════

function ProductionStatusBlock({ data }: { data: any }) {
  return (
    <Card>
      <div className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground/70">Production Status</p>
          <StatusDot status={data.status} />
        </div>
        {data.progress !== undefined && (
          <div className="flex-1 ml-6">
            <div className="h-1.5 rounded-full bg-muted/10 overflow-hidden">
              <div className="h-full rounded-full bg-primary/70 transition-all duration-500" style={{ width: `${data.progress}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground/35 mt-1 text-right font-mono">{data.progress}%</p>
          </div>
        )}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════
// COST ESTIMATE
// ═══════════════════════════════════════════════

function CostEstimateBlock({ data }: { data: any }) {
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-3.5 w-3.5 text-amber-400/70" />
          <span className="text-xs font-semibold text-foreground/70">Cost Estimate</span>
        </div>
        <p className="text-2xl font-bold text-foreground">
          {data.total_credits}<span className="text-sm text-muted-foreground/40 ml-1.5 font-normal">credits</span>
        </p>
        {data.breakdown && Array.isArray(data.breakdown) && (
          <div className="mt-3 pt-3 border-t border-border/8 space-y-1.5">
            {data.breakdown.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground/50">{item.item || item.label}</span>
                <span className="text-foreground/70 font-mono">{item.credits || item.cost}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════

function CommentsBlock({ data }: { data: any }) {
  const comments = data.comments || [];
  return (
    <Card>
      <CardTitle icon={MessageCircle} title="Comments" badge={`${comments.length}`} />
      <div className="divide-y divide-border/6">
        {comments.slice(0, 5).map((c: any) => (
          <div key={c.id} className="px-4 py-2.5 flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-muted/10 border border-border/8 flex-shrink-0 flex items-center justify-center overflow-hidden">
              {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="h-3 w-3 text-muted-foreground/20" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-foreground/60">{c.username || "Anonymous"}</p>
              <p className="text-xs text-muted-foreground/50 mt-0.5 line-clamp-2">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════
// WORLD CHAT
// ═══════════════════════════════════════════════

function WorldChatBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const messages = data.messages || [];
  return (
    <Card>
      <CardTitle icon={Globe} title="World Chat" badge="Live" navigateTo={data.navigateTo} onNavigate={onNavigate} />
      <div className="divide-y divide-border/6 max-h-44 overflow-y-auto">
        {messages.slice(0, 8).map((m: any, i: number) => (
          <div key={m.id || i} className="px-4 py-2 flex items-start gap-2">
            <span className="text-[11px] font-medium text-primary/60 flex-shrink-0">{m.username || "User"}</span>
            <span className="text-[11px] text-muted-foreground/50">{m.content}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════
// SHOT LIST
// ═══════════════════════════════════════════════

function ShotListBlock({ data }: { data: any }) {
  const shots = data.shot_list || data.shots || [];
  return (
    <Card>
      <CardTitle icon={Target} title="Shot List" badge={`${Array.isArray(shots) ? shots.length : 0}`} />
      {Array.isArray(shots) && (
        <div className="divide-y divide-border/6">
          {shots.slice(0, 6).map((shot: any, i: number) => (
            <div key={i} className="px-4 py-2.5 flex items-start gap-2.5">
              <span className="text-[10px] font-mono text-muted-foreground/30 mt-0.5 flex-shrink-0 w-5 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground/70">{shot.description || shot.shot || shot}</p>
                {shot.camera && <p className="text-[10px] text-muted-foreground/35 mt-0.5">{shot.camera}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════

function OnboardingBlock({ data }: { data: any }) {
  const steps = Array.isArray(data.steps) ? data.steps : [];
  return (
    <Card>
      <CardTitle icon={Sparkles} title="Getting Started" />
      <div className="p-4 space-y-2.5">
        {steps.map((step: any, i: number) => (
          <div key={i} className="flex items-center gap-2.5">
            {step.completed ? (
              <CheckCircle className="h-4 w-4 text-emerald-400/70 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/25 flex-shrink-0" />
            )}
            <span className={cn("text-xs", step.completed ? "text-muted-foreground/40 line-through" : "text-foreground/70")}>
              {step.title || step.name || step}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════

function SettingsBlock({ data, onNavigate }: { data: any; onNavigate?: (path: string) => void }) {
  const settings = data.settings || data;
  const entries = Object.entries(settings).filter(([k]) => !k.startsWith("_") && k !== "id" && k !== "navigateTo");
  return (
    <Card>
      <CardTitle icon={Settings} title="Account Settings" navigateTo={data.navigateTo} onNavigate={onNavigate} />
      <div className="divide-y divide-border/6">
        {entries.slice(0, 8).map(([key, val]) => (
          <div key={key} className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground/50 capitalize">{key.replace(/_/g, " ")}</span>
            <span className="text-xs text-foreground/70 font-medium truncate max-w-[50%] text-right">
              {typeof val === "boolean" ? (val ? "On" : "Off") : String(val || "—")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════
// MULTIPLE CHOICE
// ═══════════════════════════════════════════════

const OPTION_ICONS: Record<string, any> = {
  film: Film, sparkles: Sparkles, zap: Zap, star: Star, crown: Crown,
  play: Play, globe: Globe, users: Users, settings: Settings, palette: Palette,
  target: Target, award: Award, flame: Flame, trophy: Trophy, send: Send,
  heart: Heart, eye: Eye, "credit-card": CreditCard, clapperboard: Clapperboard,
};

function MultipleChoiceBlock({ data, onSendMessage }: { data: any; onSendMessage?: (content: string) => void }) {
  const options: { id: string; label: string; description?: string; icon?: string; image_url?: string }[] = data.options || [];
  const maxSelections: number = data.max_selections || 1;
  const question: string = data.question || "Choose an option:";
  const layout: string = data.layout || "list";
  const hasImages = options.some((o) => o.image_url);
  const useGrid = layout === "grid" || hasImages;

  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const handleOptionClick = (optId: string) => {
    if (submitted) return;
    if (maxSelections === 1) {
      setSelected([optId]);
      setSubmitted(true);
      const label = options.find((o) => o.id === optId)?.label || optId;
      onSendMessage?.(label);
    } else {
      setSelected((prev) => prev.includes(optId) ? prev.filter(s => s !== optId) : prev.length >= maxSelections ? [...prev.slice(0, -1), optId] : [...prev, optId]);
    }
  };

  const handleSubmit = () => {
    if (selected.length === 0 || submitted) return;
    setSubmitted(true);
    const labels = selected.map(id => options.find(o => o.id === id)?.label).filter(Boolean);
    onSendMessage?.(labels.join(" and "));
  };

  return (
    <div className="mt-1">
      <p className="text-sm font-medium text-foreground/70 mb-2.5 px-0.5">{question}</p>

      <div className={cn(useGrid ? "grid grid-cols-2 gap-2" : "space-y-1.5")}>
        {options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const IconComp = opt.icon ? OPTION_ICONS[opt.icon] : null;

          if (useGrid) {
            return (
              <button
                key={opt.id}
                onClick={() => handleOptionClick(opt.id)}
                disabled={submitted && !isSelected}
                className={cn(
                  "relative rounded-xl overflow-hidden text-left transition-all duration-200 border",
                  submitted && isSelected ? "ring-1 ring-primary/30 border-primary/20" : submitted ? "opacity-30 cursor-not-allowed border-border/5" : isSelected ? "border-primary/20" : "border-border/8 hover:border-border/20",
                  "bg-muted/5"
                )}
              >
                {opt.image_url && (
                  <div className="relative w-full aspect-[3/4] overflow-hidden">
                    <img src={opt.image_url} alt={opt.label} className="w-full h-full object-cover object-top" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    {isSelected && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <CheckCircle className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-2.5">
                      <p className="text-sm font-semibold text-white leading-tight drop-shadow">{opt.label}</p>
                      {opt.description && <p className="text-[10px] text-white/55 mt-0.5 line-clamp-2">{opt.description}</p>}
                    </div>
                  </div>
                )}
                {!opt.image_url && (
                  <div className="p-3.5 flex flex-col gap-2 min-h-[88px]">
                    <div className="flex items-center justify-between">
                      {IconComp && <IconComp className={cn("h-4 w-4", isSelected ? "text-primary/70" : "text-muted-foreground/40")} />}
                      {isSelected && <CheckCircle className="h-4 w-4 text-primary/70" />}
                    </div>
                    <div>
                      <p className={cn("text-sm font-medium leading-tight", isSelected ? "text-foreground" : "text-foreground/65")}>{opt.label}</p>
                      {opt.description && <p className="text-[10px] text-muted-foreground/40 mt-0.5 line-clamp-2">{opt.description}</p>}
                    </div>
                  </div>
                )}
              </button>
            );
          }

          return (
            <button
              key={opt.id}
              onClick={() => handleOptionClick(opt.id)}
              disabled={submitted && !isSelected}
              className={cn(
                "w-full text-left px-3.5 py-3 rounded-xl border transition-all duration-150 flex items-center gap-3 group",
                submitted && isSelected ? "bg-primary/8 border-primary/20" : submitted ? "opacity-25 cursor-not-allowed border-border/5" : isSelected ? "bg-primary/5 border-primary/15" : "bg-muted/5 border-border/8 hover:border-border/18 hover:bg-muted/8"
              )}
            >
              {opt.image_url ? (
                <div className="h-9 w-9 rounded-lg overflow-hidden flex-shrink-0 border border-border/8">
                  <img src={opt.image_url} alt={opt.label} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ) : IconComp ? (
                <IconComp className={cn("h-4 w-4 flex-shrink-0", isSelected ? "text-primary/70" : "text-muted-foreground/35")} />
              ) : null}
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", isSelected ? "text-foreground/90" : "text-foreground/65")}>{opt.label}</p>
                {opt.description && <p className="text-[10px] text-muted-foreground/40 mt-0.5 line-clamp-1">{opt.description}</p>}
              </div>
              {isSelected ? <CheckCircle className="h-4 w-4 text-primary/60 flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 flex-shrink-0 group-hover:text-muted-foreground/40 transition-colors" />}
            </button>
          );
        })}
      </div>

      {maxSelections > 1 && !submitted && (
        <div className="mt-2.5">
          <button
            onClick={handleSubmit}
            disabled={selected.length === 0}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-medium transition-all",
              selected.length > 0 ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]" : "bg-muted/10 text-muted-foreground/30 cursor-not-allowed"
            )}
          >
            {selected.length === 0 ? "Select an option" : `Confirm${selected.length > 1 ? ` (${selected.length})` : ""}`}
          </button>
        </div>
      )}

      {submitted && (
        <div className="mt-2 flex items-center gap-1.5">
          <CheckCircle className="h-3 w-3 text-primary/50" />
          <span className="text-[10px] text-muted-foreground/40">
            {selected.length === 1 ? options.find(o => o.id === selected[0])?.label : "Submitted"}
          </span>
        </div>
      )}
    </div>
  );
}
