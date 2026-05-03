import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { aiBackend, translateOnDemand } from "./aiBackend";
import { LANGUAGE_CODES, isRtl, type LanguageCode } from "./languages";

const STORAGE_KEY = "apex.lang";

i18n
  .use(aiBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: LANGUAGE_CODES,
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: STORAGE_KEY,
    },
    saveMissing: true,
    parseMissingKeyHandler: (key) => key, // show source text immediately
    missingKeyHandler: (lngs, _ns, key) => {
      const lng = (Array.isArray(lngs) ? lngs[0] : lngs) as LanguageCode;
      if (!lng || lng === "en" || !key) return;
      // Trigger background translate; once cached, next render picks it up.
      translateOnDemand(lng, key).then((translated) => {
        if (translated && translated !== key) {
          i18n.addResource(lng, "common", key, translated);
          // Force re-render of consumers
          i18n.emit("languageChanged", lng);
        }
      });
    },
    react: { useSuspense: false },
  });

// Apply <html lang> + dir on language change
const applyHtmlAttrs = (lng: string) => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng;
  document.documentElement.dir = isRtl(lng) ? "rtl" : "ltr";
};
applyHtmlAttrs(i18n.language || "en");
i18n.on("languageChanged", applyHtmlAttrs);

export default i18n;
export { LANGUAGE_CODES, isRtl };