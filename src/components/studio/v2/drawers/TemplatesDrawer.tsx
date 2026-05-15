import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Film, Flame, LayoutTemplate, Search, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useTemplateEnvironment, type AppliedSettings } from "@/hooks/useTemplateEnvironment";
import viralHookImg from "@/assets/templates/viral-hook.jpg";
import aestheticVlogImg from "@/assets/templates/aesthetic-vlog.jpg";
import transformationImg from "@/assets/templates/transformation.jpg";
import asmrSatisfyingImg from "@/assets/templates/asmr-satisfying.jpg";
import storytimeImg from "@/assets/templates/storytime.jpg";
import documentaryImg from "@/assets/templates/documentary.jpg";
import neoNoirImg from "@/assets/templates/neo-noir.jpg";
import actionMontageImg from "@/assets/templates/action-montage.jpg";
import animeStyleImg from "@/assets/templates/anime-style.jpg";
import productRevealImg from "@/assets/templates/product-reveal.jpg";
import foodLifestyleImg from "@/assets/templates/food-lifestyle.jpg";
import techShowcaseImg from "@/assets/templates/tech-showcase.jpg";
import ugcTestimonialImg from "@/assets/templates/ugc-testimonial.jpg";
import educationalImg from "@/assets/templates/educational.jpg";
import tutorialImg from "@/assets/templates/tutorial.jpg";
import viralSocialImg from "@/assets/templates/viral-social.jpg";
import travelVlogImg from "@/assets/templates/travel-vlog.jpg";
import musicVideoImg from "@/assets/templates/music-video.jpg";
import podcastClipsImg from "@/assets/templates/podcast-clips.jpg";
import brandStoryImg from "@/assets/templates/brand-story.jpg";
import teamIntroImg from "@/assets/templates/team-intro.jpg";
import lectureRecapImg from "@/assets/templates/lecture-recap.jpg";
import microLessonImg from "@/assets/templates/micro-lesson.jpg";
import whiteboardExplainerImg from "@/assets/templates/whiteboard-explainer.jpg";
import languageDrillImg from "@/assets/templates/language-drill.jpg";
import scienceDemoImg from "@/assets/templates/science-demo.jpg";
import courseTrailerImg from "@/assets/templates/course-trailer.jpg";
import examCramImg from "@/assets/templates/exam-cram.jpg";
import postEscapeImg from "@/assets/templates/post-escape.jpg";
import scrollGrabImg from "@/assets/templates/scroll-grab.jpg";
import freezeWalkImg from "@/assets/templates/freeze-walk.jpg";
import realityRipImg from "@/assets/templates/reality-rip.jpg";
import aspectEscapeImg from "@/assets/templates/aspect-escape.jpg";

interface ProjectTemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  thumbnail_url: string | null;
  use_count: number | null;
  genre: string | null;
  mood: string | null;
  target_duration_minutes: number | null;
  clip_count: number | null;
  is_public: boolean | null;
}

export interface TemplatePick {
  id: string;
  name: string;
  logline: string;
  style: string;
  thumbnailUrl?: string;
  settings?: AppliedSettings | null;
}

interface TemplateCardItem {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail_url?: string | null;
  use_count?: number | null;
  target_duration_minutes?: number | null;
  clip_count?: number | null;
  mood?: string | null;
  genre?: string | null;
  is_breakout?: boolean;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "trending", label: "Trending" },
  { id: "cinematic", label: "Cinematic" },
  { id: "commercial", label: "Commercial" },
  { id: "educational", label: "Education" },
  { id: "entertainment", label: "Social" },
  { id: "corporate", label: "Corporate" },
];

const TEMPLATE_THUMBNAILS: Record<string, string> = {
  cinematic: documentaryImg,
  commercial: productRevealImg,
  explainer: educationalImg,
  "featured-1": productRevealImg,
  "featured-2": documentaryImg,
  "featured-3": viralSocialImg,
  "template-edu-1": educationalImg,
  "template-story-1": storytimeImg,
  "template-noir-1": neoNoirImg,
  "template-action-1": actionMontageImg,
  "template-corp-1": brandStoryImg,
  "template-travel-1": travelVlogImg,
  "template-music-1": musicVideoImg,
  "template-food-1": foodLifestyleImg,
  "template-tech-1": techShowcaseImg,
  "viral-hook": viralHookImg,
  "aesthetic-vlog": aestheticVlogImg,
  transformation: transformationImg,
  "asmr-satisfying": asmrSatisfyingImg,
  storytime: storytimeImg,
  "anime-style": animeStyleImg,
  "ugc-testimonial": ugcTestimonialImg,
  "how-to-tutorial": tutorialImg,
  "podcast-clips": podcastClipsImg,
  "team-intro": teamIntroImg,
  "post-escape": postEscapeImg,
  "scroll-grab": scrollGrabImg,
  "freeze-walk": freezeWalkImg,
  "reality-rip": realityRipImg,
  "aspect-escape": aspectEscapeImg,
  "lecture-recap": lectureRecapImg,
  "micro-lesson": microLessonImg,
  "whiteboard-explainer": whiteboardExplainerImg,
  "language-drill": languageDrillImg,
  "science-demo": scienceDemoImg,
  "course-trailer": courseTrailerImg,
  "exam-cram": examCramImg,
};

interface Props {
  onPick: (pick: TemplatePick) => void;
}

export function TemplatesDrawerContent({ onPick }: Props) {
  const { getBuiltInTemplates, loadTemplate, isLoading: applyingTemplate } = useTemplateEnvironment();
  const [rows, setRows] = useState<ProjectTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        let request = supabase
          .from("project_templates")
          .select("id,name,description,category,thumbnail_url,use_count,genre,mood,target_duration_minutes,clip_count,is_public");

        request = authData.user
          ? request.or(`is_public.eq.true,user_id.eq.${authData.user.id}`)
          : request.eq("is_public", true);

        const { data } = await request
          .order("use_count", { ascending: false })
          .limit(80);
        if (!cancel) setRows((data as ProjectTemplateRow[]) || []);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const builtIn = (getBuiltInTemplates() as TemplateCardItem[]).map((template) => ({
    ...template,
    thumbnail_url: template.thumbnail_url || TEMPLATE_THUMBNAILS[template.id],
  }));

  const templates = useMemo<TemplateCardItem[]>(() => {
    const dbTemplates = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || "Saved production template",
      category: row.category || "cinematic",
      thumbnail_url: row.thumbnail_url,
      use_count: row.use_count,
      target_duration_minutes: row.target_duration_minutes,
      clip_count: row.clip_count,
      mood: row.mood,
      genre: row.genre,
    }));
    return [...builtIn, ...dbTemplates];
  }, [builtIn, rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates
      .filter((template) => {
        const matchesCategory = category === "all" || template.category === category || (category === "trending" && template.is_breakout);
        const matchesQuery = !q || `${template.name} ${template.description} ${template.mood || ""} ${template.genre || ""}`.toLowerCase().includes(q);
        return matchesCategory && matchesQuery;
      })
      .sort((a, b) => Number(Boolean(b.is_breakout)) - Number(Boolean(a.is_breakout)) || (b.use_count || 0) - (a.use_count || 0));
  }, [templates, category, query]);

  const handlePick = useCallback(async (template: TemplateCardItem) => {
    setActiveId(template.id);
    const settings = await loadTemplate(template.id);
    onPick({
      id: template.id,
      name: template.name,
      logline: settings?.concept || template.description,
      style: [settings?.genre || template.genre, settings?.mood || template.mood, settings?.colorGrading].filter(Boolean).join(" · ") || "Cinematic",
      thumbnailUrl: template.thumbnail_url || settings?.startImageUrl,
      settings,
    });
    setActiveId(null);
  }, [loadTemplate, onPick]);

  return (
    <div className="space-y-5 p-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the real template library…"
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/50"
          />
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 premium-scroll">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              onClick={() => setCategory(item.id)}
              className={cn("h-9 whitespace-nowrap rounded-lg px-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors", category === item.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[16/11] animate-pulse rounded-xl bg-card" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((template) => (
            <button
              key={template.id}
              onClick={() => handlePick(template)}
              disabled={applyingTemplate || activeId === template.id}
              className="group overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-accent/45 hover:bg-card/80 disabled:opacity-60"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                {template.thumbnail_url ? (
                  <img src={template.thumbnail_url} alt={template.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><LayoutTemplate className="h-9 w-9 text-muted-foreground" /></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/15 to-transparent" />
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  {template.is_breakout && <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-accent-foreground"><Flame className="h-3 w-3" /> Breakout</span>}
                  <span className="rounded-full border border-border bg-background/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-foreground backdrop-blur">{template.category}</span>
                </div>
                {activeId === template.id && <Sparkles className="absolute right-3 top-3 h-5 w-5 animate-pulse text-accent" />}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="font-display text-xl leading-tight text-foreground">{template.name}</div>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{template.description}</p>
                <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {template.clip_count && <span className="inline-flex items-center gap-1"><Film className="h-3 w-3 text-accent" /> {template.clip_count} clips</span>}
                  {template.target_duration_minutes && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3 text-accent" /> {template.target_duration_minutes}m</span>}
                  {template.use_count && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-accent" /> {(template.use_count / 1000).toFixed(1)}k</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
