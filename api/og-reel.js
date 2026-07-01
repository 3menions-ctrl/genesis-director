/**
 * /api/og-reel — server-rendered Open Graph tags for shared reels (/r/:id).
 *
 * The app is a client-rendered SPA, so per-reel <meta> tags set by React never
 * reach social scrapers (iMessage, Discord, X, WhatsApp, LinkedIn, Facebook) —
 * they don't run JS, so every shared reel previewed as the generic homepage
 * card. vercel.json rewrites `/r/:id` here; this function fetches the reel's
 * title + thumbnail (anon RLS — only public/published reels resolve), injects
 * real OG/Twitter tags + VideoObject JSON-LD into the base index.html, and
 * returns it. Humans get the same HTML and the SPA boots normally on top.
 *
 * Fail-safe: any error (missing id, reel not found, Supabase/HTML fetch fails)
 * returns the unmodified base page — a shared link never breaks.
 */

const SITE = "https://smallbridges.co";
const BASE_HTML_URL = `${SITE}/index.html`;
const DEFAULT_OG_IMAGE = `${SITE}/og-image.webp`;

// Public anon credentials. The anon key is not a secret — it already ships in
// the client bundle — so a committed fallback is safe and lets this work on
// first deploy. Env vars (set for the Vercel project) win when present.
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://ywcwaumozoejierlfkgj.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sb(path) {
  if (!SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  }
}

// Resolve the reel by id. The URL id may be a movie_projects id OR a
// published_reels id (both are linked from discovery surfaces). RLS returns a
// row only when it's genuinely public, so no is_public filter is needed on the
// project query — a private id simply yields null.
async function loadReel(id) {
  let row = await sb(
    `movie_projects?id=eq.${id}&select=id,title,thumbnail_url,user_id`,
  );
  let creatorId = row?.user_id;
  let synopsis;
  if (!row) {
    const pub = await sb(
      `published_reels?id=eq.${id}&is_taken_down=eq.false&select=title,thumbnail_url,synopsis,project_id,creator_id`,
    );
    if (pub) {
      creatorId = pub.creator_id;
      synopsis = pub.synopsis;
      row = {
        title: pub.title,
        thumbnail_url: pub.thumbnail_url,
      };
      // Prefer the source project's thumbnail if the published copy lacks one.
      if (!row.thumbnail_url && pub.project_id) {
        const proj = await sb(
          `movie_projects?id=eq.${pub.project_id}&select=title,thumbnail_url`,
        );
        if (proj) {
          row.thumbnail_url = row.thumbnail_url || proj.thumbnail_url;
          row.title = row.title || proj.title;
        }
      }
    }
  }
  if (!row) return null;
  let creatorName = null;
  if (creatorId) {
    const c = await sb(
      `profiles_public?id=eq.${creatorId}&select=display_name`,
    );
    creatorName = c?.display_name ?? null;
  }
  return {
    title: row.title || "Untitled film",
    image: row.thumbnail_url || DEFAULT_OG_IMAGE,
    synopsis: synopsis || null,
    creatorName,
  };
}

// Replace an existing tag's value, or insert the tag before </head> if absent.
function upsert(html, matcher, tag) {
  return matcher.test(html)
    ? html.replace(matcher, tag)
    : html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function inject(html, meta) {
  const t = esc(meta.pageTitle);
  const d = esc(meta.description);
  const img = esc(meta.image);
  const url = esc(meta.url);

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${t}</title>`);
  html = upsert(html, /<link[^>]*rel="canonical"[^>]*>/i, `<link rel="canonical" href="${url}" />`);
  html = upsert(html, /<meta[^>]*property="og:title"[^>]*>/i, `<meta property="og:title" content="${t}">`);
  html = upsert(html, /<meta[^>]*property="og:description"[^>]*>/i, `<meta property="og:description" content="${d}">`);
  html = upsert(html, /<meta[^>]*property="og:image"[^>]*>/i, `<meta property="og:image" content="${img}">`);
  html = upsert(html, /<meta[^>]*property="og:url"[^>]*>/i, `<meta property="og:url" content="${url}">`);
  html = upsert(html, /<meta[^>]*property="og:type"[^>]*>/i, `<meta property="og:type" content="video.other">`);
  html = upsert(html, /<meta[^>]*name="description"[^>]*>/i, `<meta name="description" content="${d}">`);
  html = upsert(html, /<meta[^>]*name="twitter:card"[^>]*>/i, `<meta name="twitter:card" content="summary_large_image">`);
  html = upsert(html, /<meta[^>]*name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${t}">`);
  html = upsert(html, /<meta[^>]*name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${d}">`);
  html = upsert(html, /<meta[^>]*name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${img}">`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: meta.pageTitle,
    description: meta.description,
    thumbnailUrl: meta.image,
    contentUrl: meta.url,
    embedUrl: meta.url,
  };
  const ld = `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`;
  html = html.replace(/<\/head>/i, `  ${ld}\n</head>`);
  return html;
}

export default async function handler(req, res) {
  const id = (req.query && req.query.id) || "";
  let html = "";
  try {
    html = await (await fetch(BASE_HTML_URL)).text();
  } catch {
    // Can't get the shell — bounce to the canonical URL so the user still lands.
    res.setHeader("location", id ? `${SITE}/r/${encodeURIComponent(id)}` : SITE);
    res.status(302).end();
    return;
  }

  res.setHeader("content-type", "text/html; charset=utf-8");
  // Per-URL edge cache; scrapers and repeat visits hit cache, not Supabase.
  res.setHeader("cache-control", "public, s-maxage=300, stale-while-revalidate=86400");

  if (!id || /[^a-zA-Z0-9-]/.test(id)) {
    res.status(200).send(html);
    return;
  }

  try {
    const reel = await loadReel(id);
    if (!reel) {
      res.status(200).send(html);
      return;
    }
    const description =
      reel.synopsis ||
      (reel.creatorName
        ? `${reel.creatorName} made this with a single prompt on Small Bridges. Make your own cinematic AI video — free.`
        : "Watch a cinematic AI film made on Small Bridges. Make your own from a single prompt — free.");
    const out = inject(html, {
      pageTitle: `${reel.title} — Small Bridges`,
      description,
      image: reel.image,
      url: `${SITE}/r/${id}`,
    });
    res.status(200).send(out);
  } catch {
    res.status(200).send(html);
  }
}
