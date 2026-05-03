// Top 25 world languages supported by Apex Studio
export type LanguageCode =
  | "en" | "es" | "fr" | "de" | "pt" | "it" | "ja" | "zh" | "ar" | "hi"
  | "ru" | "ko" | "tr" | "nl" | "pl" | "sv" | "id" | "vi" | "th" | "fa"
  | "he" | "uk" | "el" | "cs" | "ro";

export interface LanguageDef {
  code: LanguageCode;
  name: string;        // Native name
  english: string;     // English name
  flag: string;        // Emoji flag
  rtl?: boolean;
}

export const LANGUAGES: LanguageDef[] = [
  { code: "en", name: "English",    english: "English",    flag: "🇬🇧" },
  { code: "es", name: "Español",    english: "Spanish",    flag: "🇪🇸" },
  { code: "fr", name: "Français",   english: "French",     flag: "🇫🇷" },
  { code: "de", name: "Deutsch",    english: "German",     flag: "🇩🇪" },
  { code: "pt", name: "Português",  english: "Portuguese", flag: "🇵🇹" },
  { code: "it", name: "Italiano",   english: "Italian",    flag: "🇮🇹" },
  { code: "ja", name: "日本語",      english: "Japanese",   flag: "🇯🇵" },
  { code: "zh", name: "中文",        english: "Chinese",    flag: "🇨🇳" },
  { code: "ar", name: "العربية",    english: "Arabic",     flag: "🇸🇦", rtl: true },
  { code: "hi", name: "हिन्दी",       english: "Hindi",      flag: "🇮🇳" },
  { code: "ru", name: "Русский",    english: "Russian",    flag: "🇷🇺" },
  { code: "ko", name: "한국어",       english: "Korean",     flag: "🇰🇷" },
  { code: "tr", name: "Türkçe",     english: "Turkish",    flag: "🇹🇷" },
  { code: "nl", name: "Nederlands", english: "Dutch",      flag: "🇳🇱" },
  { code: "pl", name: "Polski",     english: "Polish",     flag: "🇵🇱" },
  { code: "sv", name: "Svenska",    english: "Swedish",    flag: "🇸🇪" },
  { code: "id", name: "Indonesia",  english: "Indonesian", flag: "🇮🇩" },
  { code: "vi", name: "Tiếng Việt", english: "Vietnamese", flag: "🇻🇳" },
  { code: "th", name: "ไทย",         english: "Thai",       flag: "🇹🇭" },
  { code: "fa", name: "فارسی",      english: "Persian",    flag: "🇮🇷", rtl: true },
  { code: "he", name: "עברית",      english: "Hebrew",     flag: "🇮🇱", rtl: true },
  { code: "uk", name: "Українська", english: "Ukrainian",  flag: "🇺🇦" },
  { code: "el", name: "Ελληνικά",   english: "Greek",      flag: "🇬🇷" },
  { code: "cs", name: "Čeština",    english: "Czech",      flag: "🇨🇿" },
  { code: "ro", name: "Română",     english: "Romanian",   flag: "🇷🇴" },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
export const RTL_LANGS = LANGUAGES.filter((l) => l.rtl).map((l) => l.code);

export const isRtl = (code: string) => RTL_LANGS.includes(code as LanguageCode);

export const getLanguage = (code: string): LanguageDef | undefined =>
  LANGUAGES.find((l) => l.code === code);