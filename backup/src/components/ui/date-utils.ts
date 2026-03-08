/**
 * date-utils.ts — Locale-aware date formatting, parsing, and helpers.
 * Zero dependencies — uses native Date + Intl only.
 */

// ── Locale → date part order ────────────────────────────────────────
type DateOrder = "MDY" | "DMY" | "YMD";

/** Detect whether a locale uses MDY, DMY, or YMD ordering */
export function getDateOrder(locale: string): DateOrder {
  const fmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date(2026, 0, 15)); // Jan 15 2026
  const order = parts
    .filter(p => p.type === "month" || p.type === "day" || p.type === "year")
    .map(p => p.type[0].toUpperCase()); // M, D, Y
  const key = order.join("") as DateOrder;
  if (key === "MDY" || key === "DMY" || key === "YMD") return key;
  return "MDY"; // fallback
}

/** Get the separator used by a locale (e.g. "/" or "." or "-") */
export function getDateSeparator(locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date(2026, 0, 15));
  const lit = parts.find(p => p.type === "literal");
  return lit?.value ?? "/";
}

/** Get locale placeholder (e.g. "MM/DD/YYYY" or "DD.MM.YYYY") */
export function getDatePlaceholder(locale: string): string {
  const order = getDateOrder(locale);
  const sep = getDateSeparator(locale);
  const map: Record<DateOrder, string> = {
    MDY: `MM${sep}DD${sep}YYYY`,
    DMY: `DD${sep}MM${sep}YYYY`,
    YMD: `YYYY${sep}MM${sep}DD`,
  };
  return map[order];
}

/** Get datetime placeholder */
export function getDateTimePlaceholder(locale: string): string {
  const datePart = getDatePlaceholder(locale);
  const uses12h = localeUses12Hour(locale);
  return uses12h ? `${datePart} hh:mm AM` : `${datePart} HH:mm`;
}

// ── Detect 12h vs 24h ───────────────────────────────────────────────
export function localeUses12Hour(locale: string): boolean {
  const fmt = new Intl.DateTimeFormat(locale, { hour: "numeric" });
  const parts = fmt.formatToParts(new Date(2026, 0, 1, 14, 0));
  return parts.some(p => p.type === "dayPeriod");
}

// ── Format ISO → display string ─────────────────────────────────────
export function formatDate(
  iso: string | null,
  locale: string,
  mode: "date" | "datetime" = "date"
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";

  if (mode === "date") {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  // datetime
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// ── Format time portion only ────────────────────────────────────────
export function formatTime(iso: string | null, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// ── Parse user-typed date string → ISO ──────────────────────────────
export function parseDate(input: string, locale: string): string | null {
  if (!input.trim()) return null;
  const cleaned = input.trim();

  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Split on common separators
  const parts = cleaned.split(/[\/\.\-\s]+/);
  if (parts.length < 2) return null;

  const order = getDateOrder(locale);
  let year: number, month: number, day: number;

  const nums = parts.map(p => parseInt(p, 10));
  if (nums.some(isNaN)) return null;

  if (order === "MDY") {
    month = nums[0];
    day = nums[1];
    year = nums[2] ?? new Date().getFullYear();
  } else if (order === "DMY") {
    day = nums[0];
    month = nums[1];
    year = nums[2] ?? new Date().getFullYear();
  } else {
    // YMD
    if (parts.length === 2) {
      // Ambiguous — assume month/day of current year
      month = nums[0];
      day = nums[1];
      year = new Date().getFullYear();
    } else {
      year = nums[0];
      month = nums[1];
      day = nums[2];
    }
  }

  // Expand 2-digit year
  if (year < 100) {
    year += year < 70 ? 2000 : 1900;
  }

  // Validate
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;

  return d.toISOString();
}

// ── Parse user-typed datetime → ISO ─────────────────────────────────
export function parseDateTime(input: string, locale: string): string | null {
  if (!input.trim()) return null;
  const cleaned = input.trim();

  // Try to split date and time parts
  // Look for time pattern: digits:digits optionally followed by AM/PM
  const timeMatch = cleaned.match(/(\d{1,2}:\d{2})\s*(AM|PM|am|pm)?$/);
  if (!timeMatch) {
    // No time found, parse as date only (midnight)
    return parseDate(cleaned, locale);
  }

  const dateStr = cleaned.slice(0, timeMatch.index).trim();
  const timeParts = timeMatch[1].split(":");
  let hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  const ampm = timeMatch[2]?.toUpperCase();

  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const dateIso = parseDate(dateStr, locale);
  if (!dateIso) return null;

  const d = new Date(dateIso);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

// ── Parse time string only → { hours, minutes } ────────────────────
export function parseTime(input: string): { hours: number; minutes: number } | null {
  const cleaned = input.trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();

  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

// ── Calendar helpers ────────────────────────────────────────────────

/** Get days in a month (1-indexed month) */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Get day of week for first day of month (0=Sun, 1=Mon, ...) */
export function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/** Get localized month names */
export function getMonthNames(locale: string, format: "long" | "short" = "long"): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { month: format });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2026, i, 1)));
}

/** Get localized weekday names (starting from Monday) */
export function getWeekdayNames(locale: string, format: "narrow" | "short" = "narrow"): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: format });
  // Start from Monday (Jan 5 2026 is a Monday)
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2026, 0, 5 + i)));
}

/** Check if two dates are the same calendar day */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/** Check if a date is between two dates (inclusive) */
export function isInRange(date: Date, from: Date | null, to: Date | null): boolean {
  if (!from || !to) return false;
  const t = date.getTime();
  const startOfFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const endOfTo = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime();
  return t >= startOfFrom && t <= endOfTo;
}

/** Check if a date is disabled by min/max constraints */
export function isDateDisabled(date: Date, min: string | null | undefined, max: string | null | undefined): boolean {
  if (min) {
    const minD = new Date(min);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const minOnly = new Date(minD.getFullYear(), minD.getMonth(), minD.getDate());
    if (dateOnly < minOnly) return true;
  }
  if (max) {
    const maxD = new Date(max);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const maxOnly = new Date(maxD.getFullYear(), maxD.getMonth(), maxD.getDate());
    if (dateOnly > maxOnly) return true;
  }
  return false;
}

/** Build ISO string from date components (midnight UTC-like via local) */
export function toISODate(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toISOString();
}

/** Generate time options for a given step */
export function generateTimeOptions(step: number, locale: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const uses12h = localeUses12Hour(locale);
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += step) {
      const hh = h.toString().padStart(2, "0");
      const mm = m.toString().padStart(2, "0");
      const value = `${hh}:${mm}`;
      let label: string;
      if (uses12h) {
        const period = h < 12 ? "AM" : "PM";
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        label = `${h12}:${mm} ${period}`;
      } else {
        label = value;
      }
      options.push({ value, label });
    }
  }
  return options;
}

// ── Preset helpers ──────────────────────────────────────────────────
export type Preset = {
  label: string;
  from: string | null;
  to: string | null;
};

export function getDefaultPresets(t: (key: string, fallback?: string) => string): Preset[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // This week (Mon-Sun)
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() + mondayOffset);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekEnd.getDate() + 6);

  // Last 7 days
  const last7 = new Date(today);
  last7.setDate(last7.getDate() - 6);

  // This month
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Last 30 days
  const last30 = new Date(today);
  last30.setDate(last30.getDate() - 29);

  // This quarter
  const qMonth = Math.floor(today.getMonth() / 3) * 3;
  const thisQuarterStart = new Date(today.getFullYear(), qMonth, 1);
  const thisQuarterEnd = new Date(today.getFullYear(), qMonth + 3, 0);

  // Year to date
  const ytdStart = new Date(today.getFullYear(), 0, 1);

  return [
    { label: t("preset.today", "Today"), from: today.toISOString(), to: today.toISOString() },
    { label: t("preset.yesterday", "Yesterday"), from: yesterday.toISOString(), to: yesterday.toISOString() },
    { label: t("preset.thisWeek", "This Week"), from: thisWeekStart.toISOString(), to: thisWeekEnd.toISOString() },
    { label: t("preset.last7", "Last 7 Days"), from: last7.toISOString(), to: today.toISOString() },
    { label: t("preset.thisMonth", "This Month"), from: thisMonthStart.toISOString(), to: thisMonthEnd.toISOString() },
    { label: t("preset.last30", "Last 30 Days"), from: last30.toISOString(), to: today.toISOString() },
    { label: t("preset.thisQuarter", "This Quarter"), from: thisQuarterStart.toISOString(), to: thisQuarterEnd.toISOString() },
    { label: t("preset.ytd", "Year to Date"), from: ytdStart.toISOString(), to: today.toISOString() },
  ];
}
