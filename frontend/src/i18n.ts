import english from "./locales/en.json";

export type Language = "th" | "en";

const storageKey = "performance-workspace-language";
const dictionary: Record<string, string> = english;
const listeners = new Set<() => void>();

function initialLanguage(): Language {
  if (typeof window === "undefined") return "th";
  try {
    return window.localStorage.getItem(storageKey) === "en" ? "en" : "th";
  } catch {
    return "th";
  }
}

let language = initialLanguage();

export const getLanguage = () => language;
export const formatLocale = () => language === "en" ? "en-GB" : "th-TH-u-ca-gregory";

export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setLanguage(next: Language) {
  if (next === language) return;
  language = next;
  try { globalThis.localStorage?.setItem(storageKey, next); } catch {}
  listeners.forEach(listener => listener());
}

/** Thai is the source language. Only built-in messages have English entries. */
export function t(message: string, ...values: unknown[]): string {
  const translated = language === "en" && Object.hasOwn(dictionary, message) ? dictionary[message] : message;
  return values.length ? translated.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? "")) : translated;
}
