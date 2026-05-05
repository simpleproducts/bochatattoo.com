import en from "./dictionaries/en";
import es from "./dictionaries/es";
import type { Dictionary } from "./types";
import type { Locale } from "./config";

const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export type { Dictionary } from "./types";
export { LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, isLocale, localePath } from "./config";
export type { Locale } from "./config";
