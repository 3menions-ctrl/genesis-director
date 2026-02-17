/**
 * Hoppy Rich Content Blocks — Premium UI Cards
 * 
 * Renders structured data from Hoppy's tool results as 
 * beautiful, page-quality cards inside the chat.
 */

import { motion } from "framer-motion";
import { 
  Film, Sparkles, Zap, Star, Crown, Eye, Heart, Clock, 
  User, MessageCircle, MapPin, Target, CheckCircle, Circle,
  TrendingUp, Palette, Play, ChevronRight, Settings, Send,
  Award, Flame, Trophy, Globe, CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface RichBlock {
  type: string;
  data: any;
}

interface RichBlocksRendererProps {
  blocks: RichBlock[];
}

export function RichBlocksRenderer({ blocks }: RichBlocksRendererProps) {
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
          <BlockRouter block={block} />
        </motion.div>
      ))}
    </div>
  );
}

function BlockRouter({ block }: { block: RichBlock }) {
  switch (block.type) {
    case "project_list": return <ProjectListBlock data={block.data} />;
    case "project_detail": return <ProjectDetailBlock data={block.data} />;
    case "credits": return <CreditsBlock data={block.data} />;
    case "avatar_list": return <AvatarListBlock data={block.data} />;
    case "gallery": return <GalleryBlock data={block.data} />;
    case "profile": return <ProfileBlock data={block.data} />;
    case "gamification": return <GamificationBlock data={block.data} />;
    case "environments": return <EnvironmentsBlock data={block.data} />;
    case "production_status": return <ProductionStatusBlock data={block.data} />;
    case "cost_estimate": return <CostEstimateBlock data={block.data} />;
    case "comments": return <CommentsBlock data={block.data} />;
    case "world_chat": return <WorldChatBlock data={block.data} />;
    case "shot_list": return <ShotListBlock data={block.data} />;
    case "onboarding": return <OnboardingBlock data={block.data} />;
    case "settings": return <SettingsBlock data={block.data} />;
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
        "rounded-2xl border border-border/15 overflow-hidden",
        "bg-surface-1/60 backdrop-blur-xl",
        "shadow-[0_4px_24px_hsl(0_0%_0%/0.15)]",
        className
      )}
      style={accent ? { borderTopColor: accent, borderTopWidth: 2 } : undefined}
    >
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title, badge, accentColor }: { icon: any; title: string; badge?: string; accentColor?: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/8">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg" style={{ background: accentColor ? `${accentColor}20` : 'hsl(var(--primary) / 0.1)' }}>
          <Icon className="h-4 w-4" style={{ color: accentColor || 'hsl(var(--primary))' }} />
        </div>
        <span className="font-display text-sm font-semibold text-foreground tracking-tight">{title}</span>
      </div>
      {badge && (
        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary/70">
          {badge}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// PROJECT LIST
// ═══════════════════════════════════════════════

function ProjectListBlock({ data }: { data: any }) {
  const projects = data.projects || [];
  return (
    <RichCard accent="hsl(24, 95%, 53%)">
      <CardHeader icon={Film} title="Your Projects" badge={`${data.total || projects.length}`} accentColor="hsl(24, 95%, 53%)" />
      <div className="divide-y divide-border/6">
        {projects.slice(0, 6).map((p: any) => (
          <div key={p.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-surface-2/40 transition-colors">
            {/* Thumbnail */}
            <div className="w-14 h-10 rounded-lg bg-surface-2/80 border border-border/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {p.thumbnail_url ? (
                <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Film className="h-4 w-4 text-muted-foreground/30" />
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
            <ChevronRight className="h-4 w-4 text-muted-foreground/20 flex-shrink-0" />
          </div>
        ))}
      </div>
    </RichCard>
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

function ProjectDetailBlock({ data }: { data: any }) {
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
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// CREDITS
// ═══════════════════════════════════════════════

function CreditsBlock({ data }: { data: any }) {
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
        </div>
        {/* Tier + usage */}
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

function AvatarListBlock({ data }: { data: any }) {
  const avatars = data.avatars || [];
  return (
    <RichCard accent="hsl(38, 92%, 50%)">
      <CardHeader icon={User} title="Avatars" badge={`${avatars.length}`} accentColor="hsl(38, 92%, 50%)" />
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

function GalleryBlock({ data }: { data: any }) {
  const items = data.items || [];
  return (
    <RichCard accent="hsl(270, 60%, 60%)">
      <CardHeader icon={Play} title="Gallery" badge={`${data.total || items.length}`} accentColor="hsl(270, 60%, 60%)" />
      <div className="p-4 grid grid-cols-2 gap-3">
        {items.slice(0, 4).map((v: any) => (
          <div key={v.id} className="group relative rounded-xl overflow-hidden bg-surface-2/50 border border-border/8 aspect-video">
            {v.thumbnail_url ? (
              <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Play className="h-6 w-6 text-muted-foreground/20" />
              </div>
            )}
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
              <span className="text-[11px] font-medium text-white truncate">{v.title || "Untitled"}</span>
            </div>
            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Play className="h-3.5 w-3.5 text-white fill-white" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </RichCard>
  );
}

// ═══════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════

function ProfileBlock({ data }: { data: any }) {
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
        {/* XP Bar */}
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
        {/* Stats row */}
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

function WorldChatBlock({ data }: { data: any }) {
  const messages = data.messages || [];
  return (
    <RichCard accent="hsl(195, 100%, 50%)">
      <CardHeader icon={Globe} title="World Chat" badge="Live" accentColor="hsl(195, 100%, 50%)" />
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

function SettingsBlock({ data }: { data: any }) {
  const settings = data.settings || data;
  const entries = Object.entries(settings).filter(([k]) => !k.startsWith("_") && k !== "id");
  return (
    <RichCard accent="hsl(var(--muted-foreground))">
      <CardHeader icon={Settings} title="Account Settings" />
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
