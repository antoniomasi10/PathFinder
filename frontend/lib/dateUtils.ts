/**
 * Robust deadline date parser that handles multiple international formats.
 * For ambiguous slash-separated formats (dd/mm vs mm/dd), defaults to European (dd/mm)
 * since the platform targets Italian students.
 */

/**
 * Builds a reverse-lookup map of month names → month numbers (1-12) for every
 * locale listed below, using the browser/Node Intl APIs (CLDR data).
 * Both full names ("augustus") and short names ("aug") are added for each locale.
 * Running once at module load; cost is negligible (~1 ms).
 */
function buildIntlMonthMap(): Record<string, number> {
  const locales = [
    // Western Europe
    'it', 'en', 'fr', 'de', 'es', 'pt', 'nl', 'ca', 'gl', 'eu',
    // Northern Europe
    'sv', 'da', 'no', 'nb', 'nn', 'fi', 'is',
    // Eastern Europe
    'pl', 'cs', 'sk', 'hu', 'ro', 'bg', 'hr', 'sr', 'sl', 'bs',
    'uk', 'ru', 'be', 'mk', 'sq', 'et', 'lv', 'lt',
    // Middle East / North Africa
    'ar', 'fa', 'tr', 'he',
    // Asia
    'zh', 'zh-TW', 'ja', 'ko', 'th', 'vi', 'id', 'ms',
    // Other
    'el', 'az', 'ka', 'hy', 'kk', 'uz',
  ];

  const map: Record<string, number> = {};

  // Use a fixed reference date for each month (day 1 avoids any DST edge cases)
  for (const locale of locales) {
    for (let m = 1; m <= 12; m++) {
      const date = new Date(2024, m - 1, 1);
      try {
        const full  = date.toLocaleDateString(locale, { month: 'long'  }).toLowerCase().trim();
        const short = date.toLocaleDateString(locale, { month: 'short' }).toLowerCase().trim().replace(/\.$/, '');
        // Only write if not already set (earlier locales take precedence for conflicts)
        if (full  && !map[full])  map[full]  = m;
        if (short && !map[short]) map[short] = m;
      } catch {
        // Unsupported locale — skip silently
      }
    }
  }

  return map;
}

const MONTH_MAP = buildIntlMonthMap();

function makeDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2200) return null;
  const d = new Date(year, month - 1, day);
  // Guard against JS date overflow (e.g. Feb 30 → Mar 2)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function lookupMonth(word: string): number | undefined {
  return MONTH_MAP[word.toLowerCase().trim().replace(/\.$/, '')];
}

/**
 * Parses a deadline string in any of these formats:
 * - ISO 8601:            2025-12-25  |  2025-12-25T00:00:00Z
 * - Italian/European:    25/12/2025  |  25.12.2025
 * - American:            12/25/2025  (detected when first segment > 12)
 * - Chinese numeric:     2025/12/25
 * - Textual (any lang):  "25 augusti 2025" | "25 August 2025" | "August 25, 2025"
 *                        "25 décembre 2025" | "25 sierpnia 2025" | "2025年12月25日"
 *
 * Returns null for unrecognised or invalid strings.
 */
export function parseDeadlineDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  if (!s) return null;

  // 1. ISO 8601: yyyy-mm-dd (local) or yyyy-mm-ddT... (keep as-is if has time+tz)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    // "2025-12-25" without time → parse as LOCAL midnight to avoid UTC off-by-one
    const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) return makeDate(+dateOnly[1], +dateOnly[2], +dateOnly[3]);
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // 2. CJK numeric: "2025年12月25日" (Chinese/Japanese)
  const cjkMatch = s.match(/^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日?$/u);
  if (cjkMatch) {
    return makeDate(+cjkMatch[1], +cjkMatch[2], +cjkMatch[3]);
  }

  // 3. Chinese numeric: yyyy/mm/dd
  const chineseMatch = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (chineseMatch) {
    return makeDate(+chineseMatch[1], +chineseMatch[2], +chineseMatch[3]);
  }

  // 4. Slash-separated: dd/mm/yyyy  or  mm/dd/yyyy
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [a, b, year] = [+slashMatch[1], +slashMatch[2], +slashMatch[3]];
    if (a > 12) return makeDate(year, b, a); // a is definitely the day (European)
    if (b > 12) return makeDate(year, a, b); // b is definitely the day (American)
    return makeDate(year, b, a);             // ambiguous → default European (dd/mm)
  }

  // 5. Dot-separated: dd.mm.yyyy (German / Eastern European)
  const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    return makeDate(+dotMatch[3], +dotMatch[2], +dotMatch[1]);
  }

  // 6. Dash-separated day-first: dd-mm-yyyy
  const dashEuMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashEuMatch) {
    return makeDate(+dashEuMatch[3], +dashEuMatch[2], +dashEuMatch[1]);
  }

  // 7. Textual day-first: "25 augusti 2025" | "25 December 2025"
  const textDayFirst = s.match(/^(\d{1,2})\s+([\p{L}]+)\.?\s+(\d{4})$/u);
  if (textDayFirst) {
    const month = lookupMonth(textDayFirst[2]);
    if (month) return makeDate(+textDayFirst[3], month, +textDayFirst[1]);
  }

  // 8. Textual month-year only: "augusti 2025" | "December 2025" → use day 1
  const textMonthYear = s.match(/^([\p{L}]+)\.?\s+(\d{4})$/u);
  if (textMonthYear) {
    const month = lookupMonth(textMonthYear[1]);
    if (month) return makeDate(+textMonthYear[2], month, 1);
  }

  // 9. Textual month-first: "December 25, 2025" | "Aug 25 2025"
  const textMonthFirst = s.match(/^([\p{L}]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/u);
  if (textMonthFirst) {
    const month = lookupMonth(textMonthFirst[1]);
    if (month) return makeDate(+textMonthFirst[3], month, +textMonthFirst[2]);
  }

  // 10. Partial textual with year elsewhere: "25 aug" + "2025" anywhere in string
  const textPartial = s.match(/(\d{1,2})\s+([\p{L}]+)/u);
  const yearPartial = s.match(/\b(20\d{2})\b/);  // restrict to 2000-2099 to avoid false matches
  if (textPartial && yearPartial) {
    const month = lookupMonth(textPartial[2]);
    if (month) return makeDate(+yearPartial[1], month, +textPartial[1]);
  }

  // 11. Fallback: native Date.parse (RFC 2822, HTTP dates, etc.)
  const native = new Date(s);
  return isNaN(native.getTime()) ? null : native;
}

/**
 * Converts any supported deadline string to ISO date format (yyyy-mm-dd),
 * or undefined if the string cannot be parsed.
 * Use this when storing a deadline inside a SavedOpportunity.
 */
export function toISODeadline(dateStr: string | null | undefined): string | undefined {
  const d = parseDeadlineDate(dateStr);
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
