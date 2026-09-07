/**
 * The timezone choices offered in the admin, as a short list of DISTINCT clocks.
 *
 * `Intl.supportedValuesOf("timeZone")` returns well over 400 ids, most of which
 * are aliases or historical curiosities, and dozens of which tell the same
 * time as each other. Madrid, Paris, Berlin, Rome, Amsterdam, Brussels, Vienna,
 * Prague, Stockholm and Warsaw are one clock; offering them as ten options is
 * ten ways to answer the same question.
 *
 * So: a curated candidate set covering where this studio actually works —
 * the Americas and Europe — collapsed at runtime into groups that keep the same
 * time as each other, and labelled with their offset plus a few example cities.
 *
 * Grouping is COMPUTED, not hardcoded, by sampling each zone's offset at four
 * points across the year. That catches the two things a static table gets
 * wrong: zones that share a winter offset but split on daylight saving (Phoenix
 * and Denver), and zones that stop observing it entirely (Mexico City in 2022,
 * São Paulo in 2019). When a country next changes its rules the list re-groups
 * itself with no edit here.
 *
 * Pure and client-safe: Intl only, no `server-only`, no Node built-ins.
 */

export type TimeZoneRegion = "americas" | "europe";

export type TimeZoneOption = {
  /** The IANA id actually stored on the booking. */
  id: string;
  /** e.g. "GMT-3 · Buenos Aires · São Paulo" */
  label: string;
  region: TimeZoneRegion;
};

/**
 * Candidates, not the final list. Several of these collapse into one option —
 * that is the point. Cities are the ones a reader would recognise, in the
 * order they should appear in a label.
 */
const CANDIDATES: { id: string; cities: string[]; region: TimeZoneRegion }[] = [
  // ── Americas, west to east ──
  { id: "Pacific/Honolulu", cities: ["Honolulu"], region: "americas" },
  { id: "America/Anchorage", cities: ["Anchorage"], region: "americas" },
  { id: "America/Los_Angeles", cities: ["Los Angeles", "Vancouver"], region: "americas" },
  { id: "America/Phoenix", cities: ["Phoenix"], region: "americas" },
  { id: "America/Denver", cities: ["Denver"], region: "americas" },
  { id: "America/Mexico_City", cities: ["Ciudad de México"], region: "americas" },
  { id: "America/Chicago", cities: ["Chicago"], region: "americas" },
  { id: "America/Bogota", cities: ["Bogotá", "Lima"], region: "americas" },
  { id: "America/New_York", cities: ["Nueva York", "Toronto", "Miami"], region: "americas" },
  { id: "America/Caracas", cities: ["Caracas"], region: "americas" },
  { id: "America/Halifax", cities: ["Halifax"], region: "americas" },
  { id: "America/Santiago", cities: ["Santiago"], region: "americas" },
  { id: "America/Argentina/Buenos_Aires", cities: ["Buenos Aires"], region: "americas" },
  { id: "America/Sao_Paulo", cities: ["São Paulo", "Montevideo"], region: "americas" },

  // ── Europe, west to east ──
  { id: "Atlantic/Reykjavik", cities: ["Reikiavik"], region: "europe" },
  { id: "Europe/Lisbon", cities: ["Lisboa"], region: "europe" },
  { id: "Europe/London", cities: ["Londres", "Dublín"], region: "europe" },
  { id: "Europe/Madrid", cities: ["Madrid", "París", "Berlín", "Roma"], region: "europe" },
  { id: "Europe/Amsterdam", cities: ["Ámsterdam", "Bruselas", "Viena"], region: "europe" },
  { id: "Europe/Warsaw", cities: ["Varsovia", "Estocolmo", "Praga"], region: "europe" },
  { id: "Europe/Athens", cities: ["Atenas", "Helsinki", "Bucarest"], region: "europe" },
  { id: "Europe/Kyiv", cities: ["Kiev"], region: "europe" },
  { id: "Europe/Istanbul", cities: ["Estambul"], region: "europe" },
  { id: "Europe/Moscow", cities: ["Moscú"], region: "europe" },
];

/** Minutes east of UTC for `tz` at `instant`. Positive is ahead of UTC. */
function offsetMinutes(tz: string, instant: Date): number {
  // "en-US" with an explicit numeric shape so the parse below is stable
  // regardless of the reader's own locale.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  // hour12:false can yield "24" for midnight in some ICU versions.
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * Four probes a quarter apart. Two would separate most zones, but they would
 * merge the northern and southern hemispheres' opposite daylight-saving swings
 * — Santiago and Halifax are both -4/-3 and must not collapse into one option.
 */
function signature(tz: string, year: number): string {
  const probes = [0, 3, 6, 9].map((month) => new Date(Date.UTC(year, month, 15, 12)));
  return probes.map((p) => offsetMinutes(tz, p)).join(",");
}

/** "GMT-3", or "GMT-4/-3" for a zone that changes with daylight saving. */
function offsetLabel(tz: string, year: number): string {
  const mins = [0, 3, 6, 9].map((month) =>
    offsetMinutes(tz, new Date(Date.UTC(year, month, 15, 12))),
  );
  const format = (m: number): string => {
    const sign = m < 0 ? "-" : "+";
    const abs = Math.abs(m);
    const h = Math.floor(abs / 60);
    const rest = abs % 60;
    return `${sign}${h}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
  };
  const low = format(Math.min(...mins));
  const high = format(Math.max(...mins));
  return low === high ? `GMT${low}` : `GMT${low}/${high}`;
}

/**
 * The options to offer, grouped so that no two tell the same time.
 *
 * `extra` is any zone that must appear even though it is not a candidate —
 * the reader's own zone, or the one already stored on an appointment being
 * edited. Without it, opening a booking made in Tokyo would silently show the
 * select sitting on some other value.
 */
export function timeZoneOptions(
  year: number,
  extra: (string | undefined)[] = [],
): TimeZoneOption[] {
  const seen = new Map<string, { id: string; cities: string[]; region: TimeZoneRegion }>();

  for (const candidate of CANDIDATES) {
    let sig: string;
    try {
      sig = signature(candidate.id, year);
    } catch {
      continue; // A runtime without this zone simply does not offer it.
    }
    const existing = seen.get(sig);
    if (existing) {
      // Same clock: fold the cities into the option already there rather than
      // offering a second way to say the same thing.
      for (const city of candidate.cities) {
        if (!existing.cities.includes(city)) existing.cities.push(city);
      }
      continue;
    }
    seen.set(sig, { ...candidate, cities: [...candidate.cities] });
  }

  const options: TimeZoneOption[] = [...seen.values()].map((group) => ({
    id: group.id,
    region: group.region,
    label: `${offsetLabel(group.id, year)} · ${group.cities.slice(0, 3).join(" · ")}`,
  }));

  for (const id of extra) {
    if (!id) continue;
    if (options.some((o) => o.id === id)) continue;
    // A zone we did not curate but must not lose. Grouped with the Americas or
    // Europe by its id, and anything else lands in Europe's list rather than
    // vanishing — being findable matters more than being filed correctly.
    let label: string;
    try {
      label = `${offsetLabel(id, year)} · ${id.split("/").pop()?.replace(/_/g, " ") ?? id}`;
    } catch {
      continue;
    }
    options.push({
      id,
      label,
      region: id.startsWith("America") || id.startsWith("Pacific") ? "americas" : "europe",
    });
  }

  return options;
}
