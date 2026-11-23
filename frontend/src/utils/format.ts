import { formatLocale, t } from "../i18n";
export const number = (value: number) => new Intl.NumberFormat(formatLocale(), { maximumFractionDigits: 1 }).format(value);
export const date = (value?: string) => value
  ? new Intl.DateTimeFormat(formatLocale(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z"))
  : "—";
export const showLevel = (value?: number | null) => value == null ? t("ยังประเมินไม่ได้") : `${number(value)} / 5`;
/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` is earlier. */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
