/**
 * DOM-level live translator.
 *
 * Walks the document for visible text nodes, batches them through the
 * `translate-text` edge function, swaps them in place, and observes
 * mutations so dynamically-rendered content also gets translated.
 *
 * This is intentionally pragmatic: the app does not wrap every string
 * in `t()`, so we translate the rendered DOM directly. Original text
 * is preserved on each node via `data-i18n-orig` so we can re-translate
 * cleanly when the language changes.
 */
import { supabase } from "@/integrations/supabase/client";
import { LANGUAGES, isRtl, type LanguageCode } from "./languages";

const CACHE_PREFIX = "apex.i18n.dom.v1.";
const ORIG_ATTR = "data-i18n-orig";
const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "SVG", "PATH",
  "TEXTAREA", "INPUT", "CANVAS", "VIDEO", "AUDIO", "IFRAME",
]);
const SKIP_ATTR = "data-i18n-skip";

let currentLang: LanguageCode = "en";
let observer: MutationObserver | null = null;
let pendingNodes = new Set<Text>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 120;
const MAX_BATCH = 40;

const cacheKey = (lang: string, text: string) => `${CACHE_PREFIX}${lang}::${text}`;

const readCache = (lang: string, text: string): string | null => {
  try { return localStorage.getItem(cacheKey(lang, text)); } catch { return null; }
};
const writeCache = (lang: string, text: string, value: string) => {
  try { localStorage.setItem(cacheKey(lang, text), value); } catch { /* quota */ }
};

const isTranslatable = (node: Text): boolean => {
  const parent = node.parentElement;
  if (!parent) return false;
  if (SKIP_TAGS.has(parent.tagName)) return false;
  if (parent.closest(`[${SKIP_ATTR}]`)) return false;
  if (parent.isContentEditable) return false;
  const raw = node.nodeValue ?? "";
  const trimmed = raw.trim();
  if (trimmed.length < 2) return false;
  // Skip pure numbers / symbols / urls / emails
  if (/^[\d\s.,:;%$€£¥+\-*/=<>!?()[\]{}|\\'"`~^&]+$/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(trimmed)) return false;
  // Must contain at least one letter
  if (!/[A-Za-z]/.test(trimmed)) return false;
  return true;
};

const collectTextNodes = (root: Node): Text[] => {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      isTranslatable(n as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  let n: Node | null;
  while ((n = walker.nextNode())) out.push(n as Text);
  return out;
};

const applyTranslation = (node: Text, lang: LanguageCode) => {
  const el = node.parentElement;
  if (!el) return;
  // Remember original
  let orig = el.getAttribute(ORIG_ATTR);
  if (!orig) {
    orig = node.nodeValue ?? "";
    // Only store if this text node IS the entire text content of parent.
    // Otherwise we just translate per-node without storing on element.
  }
  const source = (node as any).__i18nOrig as string | undefined ?? node.nodeValue ?? "";
  if (!(node as any).__i18nOrig) (node as any).__i18nOrig = source;

  if (lang === "en") {
    if ((node as any).__i18nOrig) node.nodeValue = (node as any).__i18nOrig;
    return;
  }

  const key = (node as any).__i18nOrig as string;
  const trimmed = key.trim();
  if (!trimmed) return;
  const cached = readCache(lang, trimmed);
  if (cached) {
    // Preserve leading / trailing whitespace
    const lead = key.match(/^\s*/)?.[0] ?? "";
    const trail = key.match(/\s*$/)?.[0] ?? "";
    node.nodeValue = `${lead}${cached}${trail}`;
    return;
  }
  pendingNodes.add(node);
  scheduleFlush();
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_MS);
};

const flush = async () => {
  flushTimer = null;
  const lang = currentLang;
  if (lang === "en" || pendingNodes.size === 0) {
    pendingNodes.clear();
    return;
  }
  const langName = LANGUAGES.find((l) => l.code === lang)?.english ?? lang;

  // Group nodes by trimmed source text for de-duplication
  const groups = new Map<string, Text[]>();
  for (const node of pendingNodes) {
    const src = ((node as any).__i18nOrig as string ?? node.nodeValue ?? "").trim();
    if (!src) continue;
    if (readCache(lang, src)) {
      // Cached in the meantime — apply directly
      const orig = (node as any).__i18nOrig as string;
      const lead = orig.match(/^\s*/)?.[0] ?? "";
      const trail = orig.match(/\s*$/)?.[0] ?? "";
      node.nodeValue = `${lead}${readCache(lang, src)}${trail}`;
      continue;
    }
    const arr = groups.get(src) ?? [];
    arr.push(node);
    groups.set(src, arr);
  }
  pendingNodes.clear();

  const allTexts = Array.from(groups.keys());
  // Process in chunks of MAX_BATCH
  for (let i = 0; i < allTexts.length; i += MAX_BATCH) {
    const chunk = allTexts.slice(i, i + MAX_BATCH);
    try {
      const { data, error } = await supabase.functions.invoke("translate-text", {
        body: { texts: chunk, targetLanguage: lang, languageName: langName },
      });
      if (error) throw error;
      const translations: string[] = data?.translations ?? [];
      chunk.forEach((src, idx) => {
        const translated = translations[idx];
        if (!translated || typeof translated !== "string") return;
        writeCache(lang, src, translated);
        const targets = groups.get(src) ?? [];
        for (const node of targets) {
          if (currentLang !== lang) return; // language changed mid-flight
          const orig = (node as any).__i18nOrig as string ?? node.nodeValue ?? "";
          const lead = orig.match(/^\s*/)?.[0] ?? "";
          const trail = orig.match(/\s*$/)?.[0] ?? "";
          node.nodeValue = `${lead}${translated}${trail}`;
        }
      });
    } catch (e) {
      // Soft fail — keep original text
      // eslint-disable-next-line no-console
      console.warn("[i18n] translation batch failed", e);
    }
  }
};

const translateRoot = (root: Node) => {
  const nodes = collectTextNodes(root);
  for (const n of nodes) applyTranslation(n, currentLang);
};

const restoreAll = () => {
  // Walk every translated text node and restore original
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const orig = (n as any).__i18nOrig as string | undefined;
    if (typeof orig === "string") (n as Text).nodeValue = orig;
  }
};

const startObserver = () => {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    if (currentLang === "en") return;
    for (const m of mutations) {
      if (m.type === "characterData" && m.target.nodeType === Node.TEXT_NODE) {
        const tn = m.target as Text;
        // If we just set the value ourselves, skip
        const orig = (tn as any).__i18nOrig as string | undefined;
        if (orig && tn.nodeValue && readCache(currentLang, orig.trim()) === tn.nodeValue.trim()) continue;
        // New original text — reset memory and re-translate
        (tn as any).__i18nOrig = tn.nodeValue;
        if (isTranslatable(tn)) applyTranslation(tn, currentLang);
      } else if (m.type === "childList") {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (isTranslatable(node as Text)) applyTranslation(node as Text, currentLang);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateRoot(node);
          }
        });
      }
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  });
};

export const setDomLanguage = (lang: LanguageCode) => {
  currentLang = lang;
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  if (lang === "en") {
    restoreAll();
    return;
  }
  // Translate everything currently in the DOM
  if (document.body) translateRoot(document.body);
  startObserver();
};

export const initDomTranslator = (initialLang: LanguageCode) => {
  if (typeof window === "undefined") return;
  const start = () => setDomLanguage(initialLang);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    // Defer to next tick so React has rendered
    setTimeout(start, 0);
  }
};