/**
 * i18next custom backend that translates missing strings on-demand
 * via Lovable AI. Results are cached in localStorage so each unique
 * (lang, string) pair is only translated once.
 *
 * This gives "all pages translated into all languages" without the
 * need to manually extract every string in the codebase.
 */
import type { BackendModule, ReadCallback } from "i18next";
import { LANGUAGES, type LanguageCode } from "./languages";
import { supabase } from "@/integrations/supabase/client";
import { isTranslationDisabled, tripBreaker, looksLikeCreditsError } from "./circuitBreaker";

const CACHE_PREFIX = "apex.i18n.cache.v1.";
const PENDING: Map<string, Promise<string>> = new Map();
const QUEUE: Map<LanguageCode, Map<string, ((value: string) => void)[]>> = new Map();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 250;
const MAX_BATCH = 40;

const cacheKey = (lang: string, text: string) => `${CACHE_PREFIX}${lang}::${text}`;

const readCache = (lang: string, text: string): string | null => {
  try { return localStorage.getItem(cacheKey(lang, text)); } catch { return null; }
};
const writeCache = (lang: string, text: string, value: string) => {
  try { localStorage.setItem(cacheKey(lang, text), value); } catch { /* quota */ }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(flushQueue, FLUSH_MS);
};

const flushQueue = async () => {
  flushTimer = null;
  const snapshot = new Map(QUEUE);
  QUEUE.clear();

  for (const [lang, items] of snapshot) {
    const texts = Array.from(items.keys()).slice(0, MAX_BATCH);
    if (texts.length === 0) continue;
    if (isTranslationDisabled()) {
      texts.forEach((text) => {
        const resolvers = items.get(text) || [];
        resolvers.forEach((r) => r(text));
        items.delete(text);
      });
      continue;
    }

    const langName = LANGUAGES.find((l) => l.code === lang)?.english ?? lang;
    try {
      const { data, error } = await supabase.functions.invoke("translate-text", {
        body: { texts, targetLanguage: lang, languageName: langName },
      });
      if (error) throw error;
      const translations: string[] = data?.translations ?? [];
      texts.forEach((text, i) => {
        const out = translations[i] || text;
        writeCache(lang, text, out);
        const resolvers = items.get(text) || [];
        resolvers.forEach((r) => r(out));
        items.delete(text);
      });
    } catch (e) {
      if (looksLikeCreditsError(e)) tripBreaker("credits");
      // Fallback: return source text on failure (don't cache)
      texts.forEach((text) => {
        const resolvers = items.get(text) || [];
        resolvers.forEach((r) => r(text));
        items.delete(text);
      });
    }

    // Re-queue any leftovers beyond MAX_BATCH
    if (items.size > 0) {
      const existing = QUEUE.get(lang) ?? new Map();
      for (const [k, v] of items) {
        const arr = existing.get(k) ?? [];
        existing.set(k, [...arr, ...v]);
      }
      QUEUE.set(lang, existing);
      scheduleFlush();
    }
  }
};

export const translateOnDemand = (lang: LanguageCode, text: string): Promise<string> => {
  if (!text || lang === "en") return Promise.resolve(text);
  const cached = readCache(lang, text);
  if (cached) return Promise.resolve(cached);

  const key = `${lang}::${text}`;
  const inflight = PENDING.get(key);
  if (inflight) return inflight;

  const promise = new Promise<string>((resolve) => {
    const langQueue = QUEUE.get(lang) ?? new Map();
    const resolvers = langQueue.get(text) ?? [];
    resolvers.push((v) => {
      PENDING.delete(key);
      resolve(v);
    });
    langQueue.set(text, resolvers);
    QUEUE.set(lang, langQueue);
    scheduleFlush();
  });

  PENDING.set(key, promise);
  return promise;
};

/**
 * Custom i18next backend.
 * We don't load full namespace files — we use saveMissing to translate
 * keys on-demand. This module is here so i18next has a backend stub.
 */
export const aiBackend: BackendModule = {
  type: "backend",
  init: () => {},
  read: (_lng: string, _ns: string, callback: ReadCallback) => {
    // Empty resource bundle; missing keys handled by saveMissing handler
    callback(null, {});
  },
};