// Auto-generates public/sitemap.xml from the known public route list.
// Runs before `vite dev` and `vite build` via predev/prebuild hooks.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://apex-studio.ai";
const today = new Date().toISOString().slice(0, 10);

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const entries: SitemapEntry[] = [
  { path: "/", lastmod: today, changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", lastmod: today, changefreq: "weekly", priority: "0.9" },
  { path: "/how-it-works", lastmod: today, changefreq: "monthly", priority: "0.8" },
  { path: "/auth", lastmod: today, changefreq: "monthly", priority: "0.8" },
  { path: "/blog", lastmod: today, changefreq: "weekly", priority: "0.7" },
  { path: "/enterprise/coming-soon", lastmod: today, changefreq: "monthly", priority: "0.7" },
  { path: "/mascots", lastmod: today, changefreq: "monthly", priority: "0.6" },
  { path: "/developers", lastmod: today, changefreq: "monthly", priority: "0.6" },
  { path: "/help", lastmod: today, changefreq: "monthly", priority: "0.6" },
  { path: "/contact", lastmod: today, changefreq: "monthly", priority: "0.5" },
  { path: "/press", lastmod: today, changefreq: "monthly", priority: "0.5" },
  { path: "/terms", lastmod: today, changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", lastmod: today, changefreq: "yearly", priority: "0.3" },
  { path: "/forgot-password", lastmod: today, changefreq: "yearly", priority: "0.2" },
];

function generateSitemap(items: SitemapEntry[]) {
  const urls = items.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
console.log(`sitemap.xml written (${entries.length} entries)`);