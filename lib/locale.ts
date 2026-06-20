export const SUPPORTED_LOCALES = ["ro", "en", "tr"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string | undefined): value is AppLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

const TMDB_LANG_MAP: Record<AppLocale, string> = {
  ro: "ro-RO",
  en: "en-US",
  tr: "tr-TR",
};

export function toTmdbLang(locale: string): string {
  return TMDB_LANG_MAP[isSupportedLocale(locale) ? locale : "ro"];
}
