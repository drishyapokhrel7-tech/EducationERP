import NepaliDate from "nepali-date-converter";

/**
 * Standalone AD↔BS (Bikram Sambat) date-conversion utility. Not wired
 * into any feature yet — a shared building block for a future slice
 * (e.g. showing/entering attendance or admission dates in BS) to
 * consume, per Phase 0's own flagged-but-deferred "Nepali localization
 * depth" open item.
 *
 * A thin wrapper around `nepali-date-converter` (the most widely used
 * package in this space — ~42k downloads/month, zero runtime deps, own
 * TypeScript types) rather than a hand-rolled BS calendar: Bikram
 * Sambat month lengths vary year to year (no fixed rule the way
 * Gregorian months are), so a maintained, community-verified calendar
 * table is the correct foundation, not something worth re-deriving.
 *
 * `month` is deliberately 1–12 (Baisakh=1 … Chaitra=12) in this
 * module's own public API — the underlying library's `monthIndex` is
 * 0–11, a classic off-by-one footgun this wrapper exists partly to
 * avoid for every future caller.
 */

export interface NepaliDateParts {
  year: number;
  /** 1 = Baisakh … 12 = Chaitra. */
  month: number;
  day: number;
}

export const NEPALI_MONTH_NAMES = [
  "Baisakh",
  "Jestha",
  "Asar",
  "Shrawan",
  "Bhadra",
  "Aswin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

/** Converts a Gregorian (AD) date to its Bikram Sambat (BS) equivalent. */
export function adToBs(date: Date): NepaliDateParts {
  const bs = new NepaliDate(date).getBS();
  return { year: bs.year, month: bs.month + 1, day: bs.date };
}

/** Converts a Bikram Sambat (BS) date to its Gregorian (AD) equivalent. */
export function bsToAd(bs: NepaliDateParts): Date {
  return new NepaliDate(bs.year, bs.month - 1, bs.day).toJsDate();
}

/**
 * Formats a Gregorian date as a Nepali (BS) date string.
 * `formatString` follows the underlying library's tokens, e.g.
 * "YYYY-MM-DD" or "ddd, DD MMMM YYYY"; `language` selects Devanagari
 * ("np") or Latin ("en") script for names/digits.
 */
export function formatBs(date: Date, formatString = "YYYY-MM-DD", language: "np" | "en" = "en"): string {
  return new NepaliDate(date).format(formatString, language);
}
