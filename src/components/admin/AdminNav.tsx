"use client";
/**
 * The admin area's tab bar: Calendar | Images | Categories | Settings.
 *
 * One row for all four, because they are peers — the calendar is not a
 * different section of the admin, it is the screen Bocha opens first. Calendar
 * leads, and /admin redirects to it, so signing in lands on the schedule.
 * Settings comes last: it is the screen touched once and then left alone.
 *
 * Rendered BY EACH PAGE, never by src/app/admin/layout.tsx. The login page is
 * a child of that layout and is one of middleware's PUBLIC_PATHS, so a nav
 * hoisted into the layout would show an unauthenticated visitor a tab bar
 * advertising and linking into the protected area.
 *
 * A server component on purpose: `active` is decided by whichever page renders
 * it, so there is nothing here for the client bundle to do. Images and
 * Categories are two views of one page and switch by query string; Next
 * client-navigates between them, so the tab still feels instant.
 *
 * `dict` arrives from the page rather than being read here, for the same
 * reason: this component never learns the locale, it is told the words. Its
 * `key` is deliberately the `nav` key too, so a tab can only exist if the
 * dictionary has a label for it.
 *
 * The row wraps. Every label is a single unbreakable word, so a flex item's
 * `min-width: auto` resolves to the whole word and the items cannot shrink —
 * without `flex-wrap` the row simply overflows, and nothing above it clips or
 * scrolls, so the overflow becomes horizontal scroll on the whole admin. In
 * Spanish it does, and now sooner: CALENDARIO · IMÁGENES · CATEGORÍAS was
 * already ~357px of mono type at this size and tracking against the 328px the
 * `<main>`'s px-4 leaves on a 360px phone, and AJUSTES is a fourth word on the
 * same line. Wrapping rather than scrolling because a second line keeps every
 * tab visible and tappable; a scroll container would hide the last ones behind
 * a gesture there is no affordance for.
 */
import Link from "next/link";
import type { AdminDictionary } from "@/i18n/admin";

/** Every tab the bar can draw, and the only keys `dict.nav` has labels for. */
export type AdminNavTab = "calendar" | "images" | "categories" | "settings";

/**
 * The three tabs that are either the calendar or one of the gallery's own two
 * views — i.e. everything except Settings.
 *
 * Kept as its own name because `Exclude<AdminTab, "calendar">` is how the
 * gallery types the setter behind `onSelectTab`, and that union has to stay
 * exactly {images, categories}. Settings is a real page with its own data, so
 * it can never be one of the gallery's in-page views; widening this to include
 * it would type a handler that promises to render a screen the gallery does
 * not have.
 */
export type AdminTab = Exclude<AdminNavTab, "settings">;

const TABS = [
  { key: "calendar", href: "/admin/calendar" },
  { key: "images", href: "/admin/gallery" },
  { key: "categories", href: "/admin/gallery?tab=categories" },
  { key: "settings", href: "/admin/settings" },
] as const;

/**
 * `onSelectTab` is how the gallery avoids a server round trip between its own
 * two views: Images and Categories are two renderings of one payload the page
 * already holds, so when the gallery supplies this handler they become buttons
 * and switch instantly. Calendar and Settings are always real navigations —
 * each needs data this page does not have, so both stay links even when the
 * handler is given. The calendar and settings pages pass no handler, so there
 * all four stay links.
 */
export function AdminNav({
  active,
  dict,
  onSelectTab,
}: {
  active: AdminNavTab;
  dict: AdminDictionary;
  onSelectTab?: (tab: Exclude<AdminTab, "calendar">) => void;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-line">
      {/*
        Sign out lives here, on the bar that is the same on every admin screen,
        rather than in each page's own header. `ml-auto` pins it to the far end
        of the row; when the tabs wrap on a narrow phone it simply wraps with
        them instead of overlapping anything.
      */}
      {TABS.map((tab) => {
        const className = `px-3 py-2 text-xs uppercase tracking-[0.2em] font-mono border-b-2 transition-colors cursor-pointer ${
          tab.key === active
            ? "border-fg text-fg"
            : "border-transparent text-muted hover:text-fg"
        }`;
        const current = tab.key === active ? "page" : undefined;

        if (onSelectTab && tab.key !== "calendar" && tab.key !== "settings") {
          return (
            <button
              key={tab.key}
              type="button"
              aria-current={current}
              onClick={() => onSelectTab(tab.key)}
              className={className}
            >
              {dict.nav[tab.key]}
            </button>
          );
        }
        return (
          <Link key={tab.key} href={tab.href} aria-current={current} className={className}>
            {dict.nav[tab.key]}
          </Link>
        );
      })}

      <form action="/api/admin/logout" method="post" className="ml-auto">
        <button
          type="submit"
          className="px-3 py-2 text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg cursor-pointer"
        >
          {dict.common.signOut}
        </button>
      </form>
    </nav>
  );
}
