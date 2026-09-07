/**
 * Booking time maths — `Intl` plus epoch-millisecond arithmetic, nothing else.
 *
 * THE RULE: never `new Date("2026-09-12T18:00")`. A date-time string with no
 * zone is parsed in the RUNTIME's zone — UTC on Vercel, the viewer's zone in
 * the browser — so the same booking form would mint two different instants
 * depending on where the code happened to run. Wall clock → instant goes
 * through `toUtcIso()`, which resolves the target zone's offset by formatting
 * a guess back with `Intl` and diffing. The only strings handed to
 * `Date.parse()` in here are stored UTC ISO values, or ones this module built
 * itself with an explicit `Z`; those parse identically on every runtime.
 * Nothing ever parses a locale-formatted string back into a Date.
 *
 * No `server-only`: this is imported by client components (LocalTime, the
 * admin calendar) as well as by routes and emails.
 *
 * The `Intl` locale mapping is fixed — es → es-AR, en → en-GB, both 24-hour.
 * A booking is read off this clock and then travelled to, so the 24-hour form
 * is the one that cannot be misread by an hour in either language; am/pm would
 * only ever be a second way of writing the same instant.
 *
 * Every formatter here takes its zone as an ARGUMENT. There is no single studio
 * clock to default to: Bocha tattoos in Buenos Aires but also guest-spots in
 * Europe and the USA, so a Berlin session is 14:00 Berlin read from anywhere.
 * `STUDIO_TIME_ZONE` survives as two narrower things — the zone the site falls
 * back to before a browser has told us where the reader is, and the zone
 * `recordTimeZone()` resolves a pre-timezone booking to.
 */

/** Where the studio is. NOT "the zone everything renders in" — see the header. */
export const STUDIO_TIME_ZONE =
  process.env.NEXT_PUBLIC_STUDIO_TIMEZONE || "America/Argentina/Buenos_Aires";

const INTL_LOCALE: Record<"es" | "en", string> = { es: "es-AR", en: "en-GB" };

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Local duplicate of bookings-types' MONTH_RE: this module stays dependency-free. */
const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

/** The one sanctioned `Date.parse` — the input is always a UTC ISO string. */
function msOf(utcIso: string): number {
  const ms = Date.parse(utcIso);
  if (!Number.isFinite(ms)) throw new RangeError(`Invalid UTC ISO value: ${utcIso}`);
  return ms;
}

/* ────────────────────────── zone primitives ────────────────────────── */

type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
};

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Fixed at en-US so the numeric parts are always latin digits — this formatter
 * is machinery, never display.
 */
function partsFormatter(tz: string): Intl.DateTimeFormat {
  const hit = partsFormatters.get(tz);
  if (hit) return hit;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  partsFormatters.set(tz, fmt);
  return fmt;
}

/** The wall-clock fields an observer in `tz` reads off at instant `ms`. */
function zonedParts(ms: number, tz: string): ZonedParts {
  const out: ZonedParts = { year: 0, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
  for (const part of partsFormatter(tz).formatToParts(new Date(ms))) {
    const value = Number(part.value);
    switch (part.type) {
      case "year":
        out.year = value;
        break;
      case "month":
        out.month = value;
        break;
      case "day":
        out.day = value;
        break;
      case "hour":
        // `hour12: false` is the h24 cycle on several runtimes, which renders
        // midnight as "24" of the SAME day. Fold it back to 0.
        out.hour = value % 24;
        break;
      case "minute":
        out.minute = value;
        break;
      case "second":
        out.second = value;
        break;
    }
  }
  return out;
}

/** Offset of `tz` at instant `ms`, in ms east of UTC. DST-correct by construction. */
function tzOffsetMs(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // zonedParts has no millisecond field, so compare against whole seconds.
  return asIfUtc - Math.floor(ms / 1000) * 1000;
}

/* ────────────────────────── zone selection ────────────────────────── */

/**
 * Studio zone until the component has mounted, the viewer's own zone after.
 * SSR and the first client render MUST agree, so `mounted` gates the swap
 * instead of reading `Intl` directly during render.
 */
export function resolveTimeZone(mounted: boolean): string {
  if (!mounted) return STUDIO_TIME_ZONE;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || STUDIO_TIME_ZONE;
  } catch {
    return STUDIO_TIME_ZONE;
  }
}

/**
 * The zone a stored booking is rendered in — the ONE place the record's
 * optional `timeZone` is resolved.
 *
 * It is optional on the record only because production is full of bookings
 * written before the field existed, and this is where that stops mattering:
 * every read path goes through here — the admin wire shape, the client view and
 * the four emails — so no component, formatter or template downstream ever
 * holds an absent zone. Deliberately one function and not an `?? STUDIO_TIME_ZONE`
 * repeated at each of those sites, because three copies of a fallback is how one
 * of them ends up missing and one surface starts rendering a Berlin session on
 * Buenos Aires hours.
 *
 * Structurally typed rather than taking a `BookingRecord`: this module is
 * imported by client components and stays free of the domain types.
 */
export function recordTimeZone(record: { timeZone?: string }): string {
  return record.timeZone ?? STUDIO_TIME_ZONE;
}

/* ────────────────────────── month / day keys ────────────────────────── */

function parseMonthKey(monthKey: string): { year: number; month: number } {
  const m = MONTH_KEY_RE.exec(monthKey);
  if (!m) throw new RangeError(`Invalid month key: ${monthKey}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

/** "YYYY-MM" of the instant as seen in `tz`. */
export function monthKeyOf(utcIso: string, tz: string): string {
  const p = zonedParts(msOf(utcIso), tz);
  return `${pad4(p.year)}-${pad2(p.month)}`;
}

/** Previous, current, next — the three months the calendar keeps loaded. */
export function monthsAround(monthKey: string): [string, string, string] {
  return [shiftMonth(monthKey, -1), shiftMonth(monthKey, 0), shiftMonth(monthKey, 1)];
}

export function shiftMonth(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const index = year * 12 + (month - 1) + Math.trunc(delta);
  return `${pad4(Math.floor(index / 12))}-${pad2((index % 12) + 1)}`;
}

/** "YYYY-MM-DD" of the instant as seen in `tz`. */
export function dayKeyOf(utcIso: string, tz: string): string {
  const p = zonedParts(msOf(utcIso), tz);
  return `${pad4(p.year)}-${pad2(p.month)}-${pad2(p.day)}`;
}

/**
 * 42 cells, Monday-first (Argentina), including the leading and trailing days
 * of the adjacent months. Walked in UTC, where a day is always exactly 24 h —
 * these are calendar labels, not instants, so no zone is involved.
 */
export function monthGridDayKeys(monthKey: string): string[] {
  const { year, month } = parseMonthKey(monthKey);
  const firstMs = Date.UTC(year, month - 1, 1);
  const lead = (new Date(firstMs).getUTCDay() + 6) % 7; // Sunday 0 → 6
  const startMs = firstMs - lead * DAY_MS;
  const keys: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startMs + i * DAY_MS);
    keys.push(
      `${pad4(d.getUTCFullYear())}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
    );
  }
  return keys;
}

/* ────────────────────────── display ────────────────────────── */

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Format a date, capitalising the names the way this UI wants to read them.
 *
 * Spanish lowercases weekdays and months; Intl is right to return "lunes 12 de
 * octubre de 2026". But these strings are headings, chips and day rows rather
 * than prose in a sentence, and a lowercase heading reads as a typo.
 *
 * So the rule is narrower than "capitalise everything":
 *   - a WEEKDAY is always capitalised — it is what labels a row or a column;
 *   - a MONTH is capitalised only when it OPENS the string, which is the
 *     standalone-heading case ("Octubre 2026"). Inside a date it stays as
 *     Spanish writes it: "12 de octubre", never "12 de Octubre".
 *
 * Capitalising by PART rather than by first letter is what makes that
 * distinction possible at all — and it is why "12 de octubre" does not become
 * "12 De octubre".
 *
 * English is unaffected: Intl already capitalises there, and upper-casing an
 * already-upper letter is a no-op.
 */
export function formatCapitalized(fmt: Intl.DateTimeFormat, date: Date): string {
  const parts = fmt.formatToParts(date);
  const firstNamed = parts.findIndex((p) => p.type !== "literal");
  return parts
    .map((part, i) => {
      const capitalise =
        part.type === "weekday" || (part.type === "month" && i === firstNamed);
      return capitalise
        ? part.value.charAt(0).toLocaleUpperCase() + part.value.slice(1)
        : part.value;
    })
    .join("");
}

export function formatDayLong(utcIso: string, tz: string, locale: "es" | "en"): string {
  const cacheKey = `${locale}|${tz}`;
  let fmt = dayFormatters.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      timeZone: tz,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    dayFormatters.set(cacheKey, fmt);
  }
  return formatCapitalized(fmt, new Date(msOf(utcIso)));
}

const clockFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * "18:00", rebuilt from parts rather than taken as a formatted string, so the
 * h24 midnight quirk ("24:00") can never reach a screen. Both target locales
 * use latin digits, which is what makes the Number() round-trip safe.
 */
function formatClock(ms: number, tz: string, locale: "es" | "en"): string {
  const cacheKey = `${locale}|${tz}`;
  let fmt = clockFormatters.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    clockFormatters.set(cacheKey, fmt);
  }
  let hour = 0;
  let minute = 0;
  for (const part of fmt.formatToParts(new Date(ms))) {
    if (part.type === "hour") hour = Number(part.value) % 24;
    else if (part.type === "minute") minute = Number(part.value);
  }
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** "18:00–20:00" — en dash, no spaces, identical in both locales. */
export function formatTimeRange(
  startIso: string,
  endIso: string,
  tz: string,
  locale: "es" | "en",
): string {
  return `${formatClock(msOf(startIso), tz, locale)}–${formatClock(msOf(endIso), tz, locale)}`;
}

/**
 * "GMT-3". `shortOffset` is the only value that stays unambiguous for zones
 * with no vernacular abbreviation; it is also the newest, hence the ladder
 * down to `short` and finally to "" — a missing abbreviation must never take
 * the calendar down.
 */
export function zoneAbbrev(utcIso: string, tz: string, locale: "es" | "en"): string {
  const at = new Date(msOf(utcIso));
  for (const timeZoneName of ["shortOffset", "short"] as const) {
    try {
      const parts = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        timeZone: tz,
        timeZoneName,
      }).formatToParts(at);
      const found = parts.find((p) => p.type === "timeZoneName");
      if (found?.value) return found.value;
    } catch {
      // Runtime rejects this option value — fall through to the next one.
    }
  }
  return "";
}

/* ────────────────────────── conversion ────────────────────────── */

/**
 * Wall clock in `tz` → UTC ISO. `dateStr` is "YYYY-MM-DD", `timeStr` "HH:MM"
 * (a trailing ":SS" is tolerated and ignored) — i.e. exactly what the native
 * date and time inputs produce.
 *
 * Two passes: the first reads the offset at the instant the wall clock WOULD
 * be if it were UTC, which lands within an hour of the answer; the second
 * re-reads the offset at that corrected instant, which is what makes a DST
 * boundary converge instead of oscillating by an hour. A wall clock that does
 * not exist (the spring-forward gap) still resolves to a real instant, one
 * that is its own fixed point when fed back in — so re-editing a booking can
 * never walk it an hour at a time. Which side of the gap it lands on depends
 * on the sign of the zone's offset; Argentina has no DST, so the studio zone
 * never sees the case at all.
 *
 * The fall-back hour is the one place this is lossy, and unavoidably so: a
 * zone + a wall clock cannot name WHICH 02:30 a booking made in the repeated
 * hour meant, because the record stores no offset. The second pass always
 * settles on the later of the two, so such a booking moves by an hour the
 * first time it is re-saved and is then stable forever. Storing the offset
 * alongside the zone is the only real fix, and it buys one hour a year per
 * guest-spot zone — do not add it without a reason bigger than that.
 */
export function toUtcIso(dateStr: string, timeStr: string, tz: string): string {
  const wall = Date.parse(`${dateStr}T${timeStr.slice(0, 5)}:00Z`);
  if (!Number.isFinite(wall)) {
    throw new RangeError(`Invalid local date/time: ${dateStr} ${timeStr}`);
  }
  let ms = wall - tzOffsetMs(wall, tz);
  ms = wall - tzOffsetMs(ms, tz);
  return new Date(ms).toISOString();
}

/** UTC ISO → the wall clock an observer in `tz` reads, shaped for form inputs. */
export function fromUtcIso(utcIso: string, tz: string): { date: string; time: string } {
  const p = zonedParts(msOf(utcIso), tz);
  return {
    date: `${pad4(p.year)}-${pad2(p.month)}-${pad2(p.day)}`,
    time: `${pad2(p.hour)}:${pad2(p.minute)}`,
  };
}

/* ────────────────────────── durations ────────────────────────── */

/** "45m" · "2h" · "2h 30m". Never negative; a bad range reads as "0m". */
export function durationLabel(startIso: string, endIso: string): string {
  const total = Math.round((msOf(endIso) - msOf(startIso)) / MINUTE_MS);
  if (total <= 0) return "0m";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function addMinutesIso(utcIso: string, minutes: number): string {
  return new Date(msOf(utcIso) + minutes * MINUTE_MS).toISOString();
}

/** Half-open intervals: 18:00–20:00 and 20:00–22:00 do NOT overlap. */
export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return msOf(aStart) < msOf(bEnd) && msOf(bStart) < msOf(aEnd);
}
