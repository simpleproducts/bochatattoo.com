"use client";
/**
 * The admin calendar's only stateful component.
 *
 * Data flow is the house idiom, not fetch-on-mount: the page server-renders
 * `initialMonths` and every mutation ends in `router.refresh()` inside a
 * transition, which re-runs the server component and arrives back here as a
 * new `initialMonths`. The one thing the server cannot anticipate is the admin
 * paging to a month it did not send, so that — and only that — is fetched.
 *
 * Two merge rules make the two sources agree. Both prune before they merge,
 * scoped to the month buckets they actually own, keyed by the UTC month of
 * `startsAt` because that is how the store buckets records. Anything else and
 * a booking moved to another month would live in two places at once.
 *
 * Display grouping is by EACH APPOINTMENT'S OWN zone (`byDay`), which is
 * deliberately a different question from which bucket a record is stored in: a
 * 00:30 UTC booking is stored in the next month but drawn in the previous one.
 * Keeping the neighbouring months warm (`monthsAround`) is what makes that
 * free. A 23:00 Berlin session lands on the Berlin day for the same reason a
 * Berlin session reads 23:00 everywhere: that is the day the artist standing
 * in Berlin will look for it on.
 *
 * `tz` is now only the READER's frame — which day is today, which day headings
 * are drawn, and what the secondary local line in the sheet says. The toolbar's
 * picker sets exactly that and nothing else; it no longer decides how any
 * appointment's own time is rendered.
 *
 * The effective timezone is studio-until-mounted, exactly like <LocalTime>:
 * SSR and the first client render must agree before the viewer's real zone can
 * be swapped in. The clock obeys the same rule and then keeps running: `nowIso`
 * seeds from the mount instant and is re-read afterwards, because a calendar
 * left open on a studio tablet must not still think "today" is yesterday.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { AdminLocaleSwitcher } from "@/components/admin/AdminLocaleSwitcher";
import { InstallPrompt } from "@/components/admin/InstallPrompt";
import { readError } from "@/components/admin/read-error";
import {
  dayKeyOf,
  monthKeyOf,
  monthsAround,
  resolveTimeZone,
  shiftMonth,
  zoneAbbrev,
} from "@/lib/booking-time";
import { isValidTimeZone } from "@/lib/bookings-types";
import type {
  AdminAppointment,
  BookingEmailKind,
  BookingId,
} from "@/lib/bookings-types";
import type { Trip } from "@/lib/trips-types";
import type { Locale } from "@/i18n/config";
import type { AdminDictionary } from "@/i18n/admin";
import { AgendaList } from "./AgendaList";
import { BookingSheet } from "./BookingSheet";
import { CalendarToolbar } from "./CalendarToolbar";
import { MonthGrid } from "./MonthGrid";
import { TripsPanel, type TripDraft } from "./TripsPanel";
import {
  FORM_TZ_STORAGE_KEY,
  toApiDeposit,
  toApiSeed,
  toApiSlot,
  TZ_AUTO,
  TZ_STORAGE_KEY,
  VIEW_STORAGE_KEY,
  type BookingFormValues,
  type CalendarView,
  type SheetState,
} from "./contract";

export type AdminCalendarProps = {
  /** "YYYY-MM" -> that month's appointments, sorted by start. Server-rendered. */
  initialMonths: Record<string, AdminAppointment[]>;
  /**
   * Every trip, sorted by startDate. Server-rendered too, and unlike the months
   * it is the WHOLE list every time: there are a handful a year and they all
   * live in one document, so there is no window to page and nothing here ever
   * has to fetch a trip the server did not send.
   */
  initialTrips: Trip[];
  studioTimeZone: string;
  /** `?b=<id>` from the deep link in Bocha's notification email. */
  initialSelectedId?: string;
  /** False when R2_PRIVATE_BUCKET / BOOKING_TOKEN_SECRET are missing. */
  configured: boolean;
  /**
   * Both resolved by the page, on the server. The locale is not only for the
   * switcher here: unlike the gallery, every date on this screen is formatted,
   * so `locale` is threaded down to the clock and month helpers as well.
   */
  locale: Locale;
  dict: AdminDictionary;
};

type ApptMap = Record<BookingId, AdminAppointment>;

/**
 * What a write route answers with, read through one type because there is one
 * write path. Every field is optional: these are half a dozen routes' bodies,
 * and each fills in only the part of this that its own operation is about — a
 * DELETE fills in none of it and is still a success.
 */
type WriteResult = {
  appointment?: AdminAppointment;
  trip?: Trip;
  /**
   * Set by a write route whose month-index update was swallowed. Every index
   * write outside the reindex route is best-effort, so this flag is the only
   * signal the admin gets that a booking may have just gone missing from the
   * calendar. A route that does not report it simply never raises the warning.
   */
  indexWarning?: boolean;
};

const DESKTOP_MQ = "(min-width: 768px)";

/**
 * How often the day clock is re-read. Nothing in the calendar is finer-grained
 * than a day, and the tick below bails out of the state update unless midnight
 * was crossed, so this is a cheap comparison rather than a re-render a minute.
 */
const CLOCK_TICK_MS = 60_000;

/**
 * Two runtime facts the server cannot know, both read through
 * `useSyncExternalStore` rather than a setState-in-effect. The server snapshot
 * is what SSR and the first client render both use, so hydration still agrees;
 * React then re-renders once with the browser's real answer.
 */
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** The viewport half of the view preference genuinely changes — subscribe to it. */
function subscribeViewport(onChange: () => void): () => void {
  const mq = window.matchMedia(DESKTOP_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** A stored choice wins; otherwise the viewport decides. Returns a primitive,
 *  so React's Object.is check is stable without any caching. */
function readPreferredView(): CalendarView {
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "month" || stored === "agenda") return stored;
  } catch {
    // Private mode / blocked storage. The media query still gives an answer.
  }
  return window.matchMedia(DESKTOP_MQ).matches ? "month" : "agenda";
}

/** Unchanged from the old `useState("month")`: same first paint, same HTML. */
const serverPreferredView = (): CalendarView => "month";

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * Replace the buckets `served` names, keep everything else. Pruning first is
 * what lets a deleted or rescheduled booking actually disappear; merging
 * without it would leave a ghost in the old month forever.
 */
function mergeMonths(
  prev: ApptMap,
  months: Record<string, AdminAppointment[]>,
  served: string[],
): ApptMap {
  const owned = new Set(served);
  const next: ApptMap = {};
  for (const appt of Object.values(prev)) {
    if (!owned.has(monthKeyOf(appt.startsAt, "UTC"))) next[appt.id] = appt;
  }
  for (const list of Object.values(months)) {
    for (const appt of list) next[appt.id] = appt;
  }
  return next;
}

/**
 * Fold one saved trip back into the list, replacing any earlier version of
 * itself, and re-sort the way `listTrips()` sorts. The sort is the point: the
 * refresh that follows a write lands a moment later with the server's own
 * order, and a row that appeared at the bottom and then jumped would read as a
 * second save.
 */
function mergeTrip(prev: Trip[], trip: Trip): Trip[] {
  const next = prev.filter((t) => t.id !== trip.id);
  next.push(trip);
  // Zero-padded ISO dates sort chronologically as plain strings; these all are.
  return next.sort((a, b) =>
    a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0,
  );
}

function flatten(months: Record<string, AdminAppointment[]>): ApptMap {
  const out: ApptMap = {};
  for (const list of Object.values(months)) {
    for (const appt of list) out[appt.id] = appt;
  }
  return out;
}

/**
 * Where the calendar opens. A deep link wins; otherwise the middle of the
 * three months the page sent, which is the current one — read from the props
 * rather than from `new Date()` so the server and the client agree.
 */
function initialCursor(
  months: Record<string, AdminAppointment[]>,
  selectedId: string | undefined,
  tz: string,
): string {
  if (selectedId) {
    for (const list of Object.values(months)) {
      // The deep-linked booking's OWN month, because that is the grid it is
      // drawn in; `tz` below is only the fallback for "no link, no data".
      const hit = list.find((a) => a.id === selectedId);
      if (hit) return monthKeyOf(hit.startsAt, hit.timeZone);
    }
  }
  const keys = Object.keys(months).sort();
  if (keys.length > 0) return keys[Math.floor(keys.length / 2)];
  return monthKeyOf(new Date().toISOString(), tz);
}

/**
 * Renders `calendar.notConfigured.body` with its three {placeholder} tokens
 * replaced by mono spans — the same split-at-render technique ConfirmedPanel
 * uses for `booking.done.body`'s anchors, and for the same reason: Spanish and
 * English each keep their own word order around the env-var names.
 */
function notConfiguredBody(template: string) {
  const NAMES: Record<string, string> = {
    "{privateBucket}": "R2_PRIVATE_BUCKET",
    "{bucket}": "R2_BUCKET",
    "{secret}": "BOOKING_TOKEN_SECRET",
  };
  return template
    .split(/(\{privateBucket\}|\{bucket\}|\{secret\})/)
    .map((part, i) =>
      NAMES[part] ? (
        <span key={i} className="font-mono">
          {NAMES[part]}
        </span>
      ) : (
        part
      )
    );
}

/**
 * The two halves of the header tally. Same shape as MonthGrid's and
 * AgendaList's `appointmentCount`, and resolved separately rather than as one
 * sentence because the counts move independently: the studio's first month
 * holds exactly one appointment and it is pending, and a quiet month is one
 * booking away from the same shape.
 */
function appointmentCount(n: number, dict: AdminDictionary): string {
  const template =
    n === 1 ? dict.calendar.appointmentsOne : dict.calendar.appointments;
  return template.replace("{count}", String(n));
}

function pendingLabel(n: number, dict: AdminDictionary): string {
  const template = n === 1 ? dict.calendar.pendingOne : dict.calendar.pending;
  return template.replace("{count}", String(n));
}

/**
 * Reads the persisted zone once. Storage can throw in private mode.
 *
 * The value is re-validated rather than trusted. It was written by an older
 * visit — possibly an older browser, possibly a tzdb release ago — and every
 * `Intl` call in booking-time THROWS on an id this runtime does not know. `tz`
 * feeds `dayKeyOf` during render, so one stale id in storage would take the
 * whole calendar down on every load and keep doing it, with no way back that
 * does not involve clearing site data. Falling back to "follow this browser" is
 * the same answer a first visit gets.
 */
function readStoredTz(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(TZ_STORAGE_KEY);
    if (!stored || stored === TZ_AUTO || !isValidTimeZone(stored)) return null;
    return stored;
  } catch {
    return null;
  }
}

/**
 * The zone of the last booking saved from this browser — a different question
 * from `readStoredTz` above, which is the zone the calendar is being READ in.
 * A guest spot is a week of appointments entered in one sitting, and this is
 * what makes that a zone chosen once.
 */
function readLastFormTz(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(FORM_TZ_STORAGE_KEY);
    // Validated for the same reason as above: this one reaches `Intl` through
    // `emptyFormValues`, so a stale id would blow up the composer instead.
    if (!stored || !isValidTimeZone(stored)) return null;
    return stored;
  } catch {
    return null;
  }
}

export function AdminCalendar({
  initialMonths,
  initialTrips,
  studioTimeZone,
  initialSelectedId,
  configured,
  locale,
  dict,
}: AdminCalendarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [byId, setById] = useState<ApptMap>(() => flatten(initialMonths));
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(
    () => new Set(Object.keys(initialMonths)),
  );
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [cursor, setCursor] = useState<string>(() =>
    initialCursor(initialMonths, initialSelectedId, studioTimeZone),
  );
  /** An explicit click this session outranks the stored/viewport preference. */
  const [viewOverride, setViewOverride] = useState<CalendarView | null>(null);
  /** `null` means "whatever today is"; a string is a day the admin picked. */
  const [pickedDayKey, setPickedDayKey] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>({ mode: "closed" });
  const [tripsOpen, setTripsOpen] = useState(false);
  /**
   * Bumped on every dismissal, so an in-flight save can tell whether the sheet
   * it would re-open is still the one the admin was looking at.
   */
  const sheetEpoch = useRef(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  /** A write route reported that it could not update a month index. */
  const [indexWarning, setIndexWarning] = useState(false);
  const [reindexBusy, setReindexBusy] = useState(false);
  const [reindexNote, setReindexNote] = useState<string | null>(null);

  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);
  const preferredView = useSyncExternalStore(
    subscribeViewport,
    readPreferredView,
    serverPreferredView,
  );
  const view = viewOverride ?? preferredView;

  /**
   * The zone every time on this screen is rendered in.
   *
   * Defaults to following the browser, which is what a guest spot abroad wants
   * — but "abroad" is exactly when an admin needs to think in studio hours
   * instead, so the choice is explicit and persisted. `null` means follow the
   * browser; anything else is an IANA id the admin picked.
   *
   * Read in a lazy initialiser and then gated on `mounted`, not in an effect:
   * this repo lints setState-inside-useEffect as an error, and the gate is what
   * keeps the hydrating render agreeing with HTML the server produced without
   * access to storage.
   */
  const viewerTz = resolveTimeZone(mounted);
  const [storedTz, setStoredTz] = useState<string | null>(readStoredTz);
  // Held back until `mounted`, for the same reason resolveTimeZone is: the
  // server cannot know this value, so using it in the hydrating render would
  // make the first client paint disagree with the HTML.
  const tzChoice = mounted ? storedTz : null;

  const setTimeZone = useCallback((next: string | null) => {
    setStoredTz(next);
    try {
      window.localStorage.setItem(TZ_STORAGE_KEY, next ?? TZ_AUTO);
    } catch {
      // Same as above: the choice still applies for this session.
    }
  }, []);

  const tz = tzChoice ?? viewerTz;

  /**
   * What a fresh composer opens on. Lazy initialiser, not an effect: this repo
   * lints setState-inside-useEffect as an error, and the value is only ever
   * read when the sheet is open — i.e. after a click, long past hydration. It
   * is still held back until `mounted` for the same reason `tzChoice` is, so
   * the hydrating render cannot disagree with the server's HTML.
   */
  const [lastFormTz, setLastFormTz] = useState<string | null>(readLastFormTz);
  const defaultFormTz = (mounted ? lastFormTz : null) ?? tz;

  /** Called on save, so the NEXT booking inherits the zone of the last one. */
  const rememberFormTz = useCallback((next: string) => {
    setLastFormTz(next);
    try {
      window.localStorage.setItem(FORM_TZ_STORAGE_KEY, next);
    } catch {
      // Private mode. The default still holds for the rest of this session.
    }
  }, []);

  /* ── the day clock ── */

  /**
   * Seeded from the mount instant so SSR and hydration agree, then advanced by
   * the tick below — but only to an instant that lands on a different DAY in
   * `tz`, which is the only granularity anything downstream reads.
   */
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const todayKey = dayKeyOf(nowIso, tz);
  const tzAbbrev = zoneAbbrev(nowIso, tz, locale);

  /**
   * `todayKey` is the source of the filled square, the TODAY button's target,
   * the agenda's selected day and the composer's default date. Frozen at mount
   * it makes every one of them point at yesterday on a tablet that was left
   * open, so it is re-read on a timer and on the two events that fire when the
   * screen comes back — a sleeping tab runs no interval.
   */
  useEffect(() => {
    const tick = () => {
      const next = new Date().toISOString();
      setNowIso((prev) =>
        dayKeyOf(prev, tz) === dayKeyOf(next, tz) ? prev : next,
      );
    };
    const timer = window.setInterval(tick, CLOCK_TICK_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [tz]);

  /**
   * The agenda's selected day, derived rather than stored. The old state seed
   * read the STUDIO zone once at mount, so a viewer elsewhere could open on the
   * wrong day and stay there for the life of the tab; following `todayKey`
   * fixes both halves of that, and an explicit pick still wins.
   */
  const selectedDayKey = pickedDayKey ?? todayKey;

  /**
   * The cursor follows the clock across midnight, but only for an admin who
   * never moved: a month step, a day pick and a `?b=` deep link each park the
   * calendar somewhere on purpose, and a rollover must not steal it back. The
   * `previous` check is what makes the deep link safe without a second flag —
   * a cursor sitting on December was never showing the day that just ended.
   */
  const navigated = useRef(false);
  const lastTodayKey = useRef(todayKey);
  useEffect(() => {
    const previous = lastTodayKey.current;
    if (previous === todayKey) return;
    lastTodayKey.current = todayKey;
    if (navigated.current) return;
    if (!previous.startsWith(cursor) || todayKey.startsWith(cursor)) return;
    setCursor(todayKey.slice(0, 7));
  }, [todayKey, cursor]);

  /* ── view preference ── */

  const changeView = useCallback((next: CalendarView) => {
    setViewOverride(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // A view preference is not worth failing a render over.
    }
  }, []);

  /* ── the deep link from the notification email ── */

  const openedDeepLink = useRef(false);
  useEffect(() => {
    if (openedDeepLink.current || !initialSelectedId) return;
    openedDeepLink.current = true;
    setSheet({ mode: "view", id: initialSelectedId });
  }, [initialSelectedId]);

  /* ── server refreshes ── */

  // React's documented "adjust state when a prop changes" pattern, run during
  // render rather than in an effect so the merged data paints in the SAME
  // commit the new prop arrives in. An effect here would render one frame of
  // stale rows after every router.refresh().
  const [servedMonths, setServedMonths] = useState(initialMonths);
  if (servedMonths !== initialMonths) {
    const served = Object.keys(initialMonths);
    setServedMonths(initialMonths);
    setById((prev) => mergeMonths(prev, initialMonths, served));
    setLoadedMonths((prev) => new Set([...prev, ...served]));
  }

  // The same pattern for trips, and a REPLACEMENT rather than a merge: the
  // server sends every trip there is, so what it just said is the whole truth
  // and the local list — which may hold a trip folded in a moment ago, or one
  // deleted elsewhere — has nothing left to contribute. Tracked with its own
  // "served" marker because the optimistic fold below makes `trips` diverge
  // from `initialTrips` on purpose; comparing those two directly would undo it
  // on the very next render.
  const [servedTrips, setServedTrips] = useState(initialTrips);
  if (servedTrips !== initialTrips) {
    setServedTrips(initialTrips);
    setTrips(initialTrips);
  }

  /* ── months the server did not send ── */

  useEffect(() => {
    if (!configured) return;
    const wanted = monthsAround(cursor).filter((m) => !loadedMonths.has(m));
    if (wanted.length === 0) return;
    const ctrl = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/admin/bookings?months=${wanted.join(",")}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as {
          months: Record<string, AdminAppointment[]>;
        };
        setById((prev) => mergeMonths(prev, data.months, wanted));
        setLoadedMonths((prev) => new Set([...prev, ...wanted]));
        setLoadErr(null);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        // Whatever is already loaded stays on screen — a failed page turn must
        // not blank a month the admin can still read.
        setLoadErr((e as Error).message);
      }
    })();
    return () => ctrl.abort();
  }, [cursor, loadedMonths, configured, reload]);

  /* ── derived views of the data ── */

  /**
   * Bucketed by the appointment's OWN zone, so the day a session appears under
   * is the day it happens where it happens. It no longer depends on `tz` at
   * all: switching the toolbar's picker re-labels the reader's frame — today,
   * the headings — without shuffling appointments between squares, which is
   * exactly what that picker now means.
   */
  const byDay = useMemo(() => {
    const map: Record<string, AdminAppointment[]> = {};
    for (const appt of Object.values(byId)) {
      const key = dayKeyOf(appt.startsAt, appt.timeZone);
      (map[key] ??= []).push(appt);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return map;
  }, [byId]);

  const all = useMemo(
    () =>
      Object.values(byId).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [byId],
  );

  /** The header tally has to count exactly what the grid draws — same key. */
  const monthAppointments = useMemo(
    () => all.filter((a) => dayKeyOf(a.startsAt, a.timeZone).startsWith(cursor)),
    [all, cursor],
  );
  const pendingCount = monthAppointments.filter((a) => a.status === "pending").length;

  const openId = sheet.mode === "view" || sheet.mode === "edit" ? sheet.id : null;
  const openAppt = openId ? (byId[openId] ?? null) : null;

  /* ── an open appointment the loaded months do not contain ── */

  /**
   * `?b=<id>` in Bocha's notification email names a booking that can sit months
   * outside the three the page server-renders, and nothing else would ever go
   * and get it: the month effect above only ever wants `monthsAround(cursor)`,
   * which is already loaded, so the sheet opened on an id that was never there.
   * Read that one record by id and move the cursor to its month, which then
   * pulls the rest of that window in the normal way.
   *
   * The record is merged into `byId` and NOWHERE else. Adding its month to
   * `loadedMonths` would claim December is loaded on the strength of a single
   * record, and the next `mergeMonths` over that bucket — it would now count as
   * served — would delete every other December booking on the way past.
   *
   * The same path recovers a sheet whose appointment was pruned by a refresh
   * that no longer serves its month.
   */
  const missingId = openId && !byId[openId] ? openId : null;
  const attemptedId = useRef<string | null>(null);
  const [missingErr, setMissingErr] = useState<string | null>(null);
  const [missingReload, setMissingReload] = useState(0);

  /**
   * Read out of `dict` here rather than inside the effect so the dependency is
   * the string itself: it changes only when the language does, and the `attempted`
   * guard below makes that re-run a no-op.
   */
  const noAppointmentError = dict.calendar.errors.noAppointment;

  useEffect(() => {
    if (!configured || !missingId) return;
    // Guarded on the id rather than on a boolean: a 404 leaves `missingId` set
    // for as long as the sheet is open, so an ungated effect would re-fire on
    // every render for the rest of the session.
    if (attemptedId.current === missingId) return;
    attemptedId.current = missingId;
    setMissingErr(null);
    const ctrl = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/admin/bookings/${missingId}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as { appointment?: AdminAppointment };
        const appt = data.appointment;
        if (!appt) throw new Error(noAppointmentError);
        setById((prev) => ({ ...prev, [appt.id]: appt }));
        // The month the booking is DRAWN in, which is its own zone's — the
        // same key `byDay` and the month tally below bucket it under, so the
        // cursor lands on the grid that actually contains it.
        setCursor(monthKeyOf(appt.startsAt, appt.timeZone));
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setMissingErr((e as Error).message);
      }
    })();
    return () => ctrl.abort();
  }, [missingId, configured, missingReload, noAppointmentError]);

  const retryMissing = useCallback(() => {
    attemptedId.current = null;
    setMissingErr(null);
    setMissingReload((n) => n + 1);
  }, []);

  /* ── mutations ── */

  /**
   * The single write path. Errors surface as `readError`'s message; a success
   * folds whatever the route returned straight into the local state so the
   * open sheet or panel updates before the refresh lands, then re-runs the
   * server component.
   *
   * It answers with the parsed body, or `null` for a failure — which is the
   * only signal a caller gets that the write did not happen, and the one a
   * DELETE (whose body names nothing) has to go on.
   */
  const call = useCallback(
    async (path: string, init?: RequestInit): Promise<WriteResult | null> => {
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch(path, { cache: "no-store", ...init });
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as WriteResult;
        if (data.indexWarning) setIndexWarning(true);
        const appt = data.appointment;
        if (appt) setById((prev) => ({ ...prev, [appt.id]: appt }));
        const trip = data.trip;
        if (trip) setTrips((prev) => mergeTrip(prev, trip));
        startTransition(() => router.refresh());
        return data;
      } catch (e) {
        setErr((e as Error).message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const onSubmitForm = useCallback(
    (values: BookingFormValues) => {
      // BookingForm gates its submit on the deposit parse but the form carries
      // `noValidate`, so a cleared date field still reaches this handler and
      // `toApiSlot` throws. Caught rather than left to an error boundary: the
      // admin should see a message in the sheet, not a blank screen mid-save.
      let slot: { startsAt: string; endsAt: string };
      let seed: ReturnType<typeof toApiSeed>;
      let deposit: ReturnType<typeof toApiDeposit>;
      try {
        // No zone argument: `values.timeZone` is the appointment's own, and
        // converting the typed wall clock through the reader's instead would
        // shift every booking made during a guest spot. See contract.ts.
        slot = toApiSlot(values);
        seed = toApiSeed(values);
        deposit = toApiDeposit(values);
      } catch (e) {
        // The dictionary string, never `e.message`. These two throw sites —
        // `toUtcIso` and `toApiDeposit` — raise English RangeErrors naming the
        // raw input, which are diagnostics for us and untranslated noise on a
        // Spanish screen. Unlike a server message arriving through readError(),
        // this one is ours to word, and `errors.invalidSlot` is already the
        // humanised version of both. The original still reaches the console.
        console.error("admin/calendar: form values did not convert", e);
        setErr(dict.calendar.errors.invalidSlot);
        return;
      }
      const adminNotes = values.adminNotes.trim();
      // Remembered on the way out rather than on the way back: the next
      // composer should open on the zone the admin was just working in even if
      // the save itself failed and they are about to retry it.
      rememberFormTz(values.timeZone);
      // Read before the await: a sheet the admin dismisses while the save is in
      // flight must stay dismissed, not spring back open when the response
      // lands. The write itself still folds into the map either way.
      const epoch = sheetEpoch.current;
      void (async () => {
        if (sheet.mode === "create") {
          const written = await call(
            "/api/admin/bookings",
            jsonInit("POST", {
              ...slot,
              timeZone: values.timeZone,
              seed,
              // The create contract takes no `null` — omit instead of clearing.
              ...(deposit ? { deposit } : {}),
              adminNotes,
            }),
          );
          const appt = written?.appointment;
          if (appt && sheetEpoch.current === epoch) {
            setSheet({ mode: "view", id: appt.id });
          }
          return;
        }
        if (sheet.mode !== "edit") return;
        const id = sheet.id;
        const written = await call(
          `/api/admin/bookings/${id}`,
          jsonInit("PATCH", {
            ...slot,
            timeZone: values.timeZone,
            seed,
            deposit,
            adminNotes,
          }),
        );
        if (written?.appointment && sheetEpoch.current === epoch) {
          setSheet({ mode: "view", id });
        }
      })();
    },
    [call, sheet, dict, rememberFormTz]
  );

  const onCancelToggle = useCallback(
    (cancelled: boolean) => {
      if (!openId) return;
      void call(`/api/admin/bookings/${openId}`, jsonInit("PATCH", { cancelled }));
    },
    [call, openId],
  );

  const onDelete = useCallback(() => {
    if (!openId) return;
    const id = openId;
    void (async () => {
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/bookings/${id}`, {
          method: "DELETE",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await readError(res));
        setById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setSheet({ mode: "closed" });
        startTransition(() => router.refresh());
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
    })();
  }, [openId, router]);

  const onRotateLink = useCallback(() => {
    if (!openId) return;
    void call(`/api/admin/bookings/${openId}/link`, { method: "POST" });
  }, [call, openId]);

  /**
   * The studio attaching a receipt a client sent by WhatsApp. Multipart rather
   * than `jsonInit`: `call` forwards the init untouched, and a FormData body
   * must carry the boundary `fetch` generates for it, so no content-type is set
   * here on purpose. The answer is the same `{ appointment }` every other write
   * returns, so it folds into the map through the one path.
   */
  const onUploadReceipt = useCallback(
    (file: File) => {
      if (!openId) return;
      const body = new FormData();
      body.append("file", file);
      void call(`/api/admin/bookings/${openId}/receipt`, { method: "POST", body });
    },
    [call, openId],
  );

  const onDeleteReceipt = useCallback(() => {
    if (!openId) return;
    void call(`/api/admin/bookings/${openId}/receipt`, { method: "DELETE" });
  }, [call, openId]);

  const onResend = useCallback(
    (kind: BookingEmailKind) => {
      if (!openId) return;
      void call(`/api/admin/bookings/${openId}/resend`, jsonInit("POST", { kind }));
    },
    [call, openId],
  );

  /* ── trips ── */

  /**
   * Three writes through the one `call` path, so a refused trip lands in the
   * same error strip — and the same panel — as a refused booking. None of them
   * touches an appointment: a trip proposes a zone to a booking that does not
   * exist yet and questions one that disagrees, and that is the whole of its
   * authority. Moving a trip's dates here can never re-time a session already
   * made, which is exactly why the panel needs no warning about it.
   */
  const onCreateTrip = useCallback(
    (draft: TripDraft) => {
      void call("/api/admin/trips", jsonInit("POST", draft));
    },
    [call],
  );

  const onUpdateTrip = useCallback(
    (id: string, draft: TripDraft) => {
      void call(`/api/admin/trips/${id}`, jsonInit("PATCH", draft));
    },
    [call],
  );

  /**
   * The DELETE body names nothing, so the row is dropped on the strength of
   * `call` having succeeded at all. Dropped here rather than optimistically
   * before the request for the reason the booking delete does the same: a
   * failed write must leave the trip on screen, because the error strip
   * explaining why is no use beside a list that already acted as though it had
   * worked.
   */
  const onDeleteTrip = useCallback(
    (id: string) => {
      void (async () => {
        const done = await call(`/api/admin/trips/${id}`, { method: "DELETE" });
        if (done) setTrips((prev) => prev.filter((t) => t.id !== id));
      })();
    },
    [call],
  );

  const openTrips = useCallback(() => {
    setErr(null);
    setTripsOpen(true);
  }, []);

  const closeTrips = useCallback(() => {
    setErr(null);
    setTripsOpen(false);
  }, []);

  /* ── the month-index repair ── */

  /**
   * Every month-index write outside this route is best-effort — it logs the
   * failure and returns — and a dropped entry makes a booking invisible on the
   * calendar while its private link keeps working. `POST .../reindex` is the
   * documented repair for exactly that, and this is its only caller.
   */
  const onReindex = useCallback(() => {
    setReindexBusy(true);
    setReindexNote(null);
    void (async () => {
      try {
        const res = await fetch("/api/admin/bookings/reindex", {
          method: "POST",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as { months?: number; records?: number };
        const months = data.months ?? 0;
        const records = data.records ?? 0;
        // No plural engine: one is the only irregular count either language
        // has, so the caller picks the twin and the template joins them.
        const r = dict.calendar.reindex;
        setReindexNote(
          r.done
            .replace(
              "{months}",
              (months === 1 ? r.monthsOne : r.months).replace(
                "{count}",
                String(months)
              )
            )
            .replace(
              "{bookings}",
              (records === 1 ? r.bookingsOne : r.bookings).replace(
                "{count}",
                String(records)
              )
            )
        );
        setIndexWarning(false);
        // A repair only pays off if the months are read again, and only an
        // UNLOADED month is ever fetched — so forget what is loaded and let
        // both the month effect and the refresh below refill it.
        setLoadedMonths(new Set());
        startTransition(() => router.refresh());
      } catch (e) {
        setReindexNote((e as Error).message);
      } finally {
        setReindexBusy(false);
      }
    })();
  }, [router, dict]);

  /* ── navigation ── */

  const goMonth = useCallback((delta: number) => {
    navigated.current = true;
    setCursor((c) => shiftMonth(c, delta));
  }, []);

  const goToday = useCallback(() => {
    // Back to following the clock, so a later midnight rollover moves with it.
    navigated.current = false;
    setPickedDayKey(null);
    setCursor(todayKey.slice(0, 7));
  }, [todayKey]);

  /** The strip can walk out of the month it is drawn in; the cursor follows. */
  const onSelectDay = useCallback((dayKey: string) => {
    navigated.current = true;
    setPickedDayKey(dayKey);
    setCursor(dayKey.slice(0, 7));
  }, []);

  const closeSheet = useCallback(() => {
    sheetEpoch.current += 1;
    setErr(null);
    setSheet({ mode: "closed" });
  }, []);

  const openCreate = useCallback((dayKey: string) => {
    setErr(null);
    setSheet({ mode: "create", dayKey });
  }, []);

  const openAppointment = useCallback((id: BookingId) => {
    setErr(null);
    setSheet({ mode: "view", id });
  }, []);

  const defaultCreateDay = todayKey.startsWith(cursor)
    ? todayKey
    : selectedDayKey.startsWith(cursor)
      ? selectedDayKey
      : `${cursor}-01`;

  /**
   * A write error belongs where the admin is looking. The sheet and the trips
   * panel each print `err` themselves, so the strip behind them would be the
   * same sentence twice — and, worse, one of them behind an overlay that
   * covers it.
   */
  const strip =
    loadErr ?? (sheet.mode === "closed" && !tripsOpen ? err : null);

  /**
   * A month with no rows is either empty or not fetched yet, and the two must
   * not read the same sentence. Once the fetch has actually failed, `loadErr`
   * is the better explanation and the empty state is honest again.
   */
  const monthLoading =
    configured &&
    !loadErr &&
    monthsAround(cursor).some((m) => !loadedMonths.has(m));

  return (
    <>
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-4">
          <h1 className="font-serif italic text-2xl md:text-3xl">
            {dict.nav.calendar}
          </h1>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {dict.calendar.counts
              .replace(
                "{appointments}",
                appointmentCount(monthAppointments.length, dict)
              )
              .replace("{pending}", pendingLabel(pendingCount, dict))}
            {tzAbbrev ? ` · ${tzAbbrev}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isPending ? (
            <span className="text-xs font-mono text-muted">
              {dict.common.refreshing}
            </span>
          ) : null}
          <AdminLocaleSwitcher locale={locale} label={dict.common.language} />
        </div>
      </header>

      {!configured ? (
        <div className="border border-red-400 p-4 flex flex-col gap-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-red-400">
            {dict.calendar.notConfigured.title}
          </p>
          <p className="text-sm text-fg/80 leading-relaxed">
            {notConfiguredBody(dict.calendar.notConfigured.body)}
          </p>
        </div>
      ) : (
        <>
          {strip ? (
            <div className="border border-red-400 text-red-400 p-3 text-xs font-mono break-words flex items-center justify-between gap-3 flex-wrap">
              <span>{strip}</span>
              {loadErr ? (
                <button
                  type="button"
                  onClick={() => setReload((n) => n + 1)}
                  className="border border-red-400 px-2 py-1 uppercase tracking-[0.2em] text-[10px] hover:bg-red-400 hover:text-bg cursor-pointer"
                >
                  {dict.common.retry}
                </button>
              ) : null}
            </div>
          ) : null}

          {indexWarning ? (
            <div className="border border-status-partial text-status-partial p-3 text-xs font-mono flex items-center justify-between gap-3 flex-wrap">
              <span>{dict.calendar.indexWarning}</span>
              <button
                type="button"
                onClick={onReindex}
                disabled={reindexBusy}
                className="border border-status-partial px-2 py-1 uppercase tracking-[0.2em] text-[10px] hover:bg-status-partial hover:text-bg disabled:opacity-40 cursor-pointer"
              >
                {reindexBusy
                  ? dict.calendar.reindex.busy
                  : dict.calendar.reindex.label}
              </button>
            </div>
          ) : null}

          <CalendarToolbar
            monthKey={cursor}
            view={view}
            tz={tz}
            tzAbbrev={tzAbbrev}
            viewerTz={viewerTz}
            studioTz={studioTimeZone}
            tzAuto={tzChoice === null}
            onTimeZone={setTimeZone}
            locale={locale}
            dict={dict}
            onView={changeView}
            onPrev={() => goMonth(-1)}
            onNext={() => goMonth(1)}
            onToday={goToday}
            onCreate={() => openCreate(defaultCreateDay)}
            onManageTrips={openTrips}
            onReindex={onReindex}
            reindexBusy={reindexBusy}
            reindexNote={reindexNote}
          />

          {view === "month" ? (
            <MonthGrid
              monthKey={cursor}
              byDay={byDay}
              tz={tz}
              todayKey={todayKey}
              trips={trips}
              locale={locale}
              dict={dict}
              onOpenAppt={openAppointment}
              onCreate={openCreate}
              loading={monthLoading}
            />
          ) : (
            <AgendaList
              monthKey={cursor}
              byDay={byDay}
              tz={tz}
              todayKey={todayKey}
              trips={trips}
              selectedDayKey={selectedDayKey}
              locale={locale}
              dict={dict}
              onSelectDay={onSelectDay}
              onOpenAppt={openAppointment}
              onCreate={openCreate}
              loading={monthLoading}
            />
          )}

          <BookingSheet
            state={sheet}
            appt={openAppt}
            tz={tz}
            studioTz={studioTimeZone}
            defaultTimeZone={defaultFormTz}
            locale={locale}
            dict={dict}
            busy={busy || isPending}
            error={err}
            all={all}
            trips={trips}
            loadPending={missingId !== null && missingErr === null}
            loadError={missingErr}
            onRetryLoad={retryMissing}
            onClose={closeSheet}
            onSubmitForm={onSubmitForm}
            onRequestEdit={() => {
              if (openId) setSheet({ mode: "edit", id: openId });
            }}
            onCancelToggle={onCancelToggle}
            onDelete={onDelete}
            onRotateLink={onRotateLink}
            onUploadReceipt={onUploadReceipt}
            onDeleteReceipt={onDeleteReceipt}
            onResend={onResend}
          />

          {/*
            `viewerTz` here is the calendar's CURRENT viewing zone, not the
            browser's raw one — the same value the sheet forwards to the
            booking form's zone select, so the two selects on this screen offer
            the same two shortcuts and "my current zone" means one thing.
          */}
          <TripsPanel
            open={tripsOpen}
            trips={trips}
            busy={busy || isPending}
            error={err}
            studioTz={studioTimeZone}
            viewerTz={tz}
            dict={dict}
            onClose={closeTrips}
            onCreate={onCreateTrip}
            onUpdate={onUpdateTrip}
            onDelete={onDeleteTrip}
          />
        </>
      )}

      {/*
        Outside the `configured` branch and last in the tree on purpose: the
        offer to install is about the SCREEN, not about the data, so it still
        belongs on a calendar that could not reach R2 — and low, below
        everything, because a home-screen tip must never sit between Bocha and
        the schedule. It renders nothing at all once installed, once dismissed,
        or on any browser it cannot positively identify.
      */}
      <InstallPrompt dict={dict} />
    </>
  );
}
