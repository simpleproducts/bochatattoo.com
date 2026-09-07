"use client";
/**
 * The admin area's tab bar: Calendar | Images | Categories.
 *
 * One row for all three, because they are peers — the calendar is not a
 * different section of the admin, it is the screen Bocha opens first. Calendar
 * leads, and /admin redirects to it, so signing in lands on the schedule.
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
 * Spanish it does: CALENDARIO · IMÁGENES · CATEGORÍAS is ~357px of mono type
 * at this size and tracking, against the 328px `<main>`'s px-4 leaves on a
 * 360px phone. Wrapping rather than scrolling because a second line keeps all
 * three tabs visible and tappable; a scroll container would hide the third
 * behind a gesture there is no affordance for.
 */
import Link from "next/link";
import type { AdminDictionary } from "@/i18n/admin";

export type AdminTab = "calendar" | "images" | "categories";

const TABS = [
  { key: "calendar", href: "/admin/calendar" },
  { key: "images", href: "/admin/gallery" },
  { key: "categories", href: "/admin/gallery?tab=categories" },
] as const;

/**
 * `onSelectTab` is how the gallery avoids a server round trip between its own
 * two views: Images and Categories are two renderings of one payload the page
 * already holds, so when the gallery supplies this handler they become buttons
 * and switch instantly. Calendar is always a real navigation — it needs data
 * this page does not have. The calendar page passes no handler, so there all
 * three stay links.
 */
export function AdminNav({
  active,
  dict,
  onSelectTab,
}: {
  active: AdminTab;
  dict: AdminDictionary;
  onSelectTab?: (tab: Exclude<AdminTab, "calendar">) => void;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-line">
      {TABS.map((tab) => {
        const className = `px-3 py-2 text-xs uppercase tracking-[0.2em] font-mono border-b-2 transition-colors cursor-pointer ${
          tab.key === active
            ? "border-fg text-fg"
            : "border-transparent text-muted hover:text-fg"
        }`;
        const current = tab.key === active ? "page" : undefined;

        if (onSelectTab && tab.key !== "calendar") {
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
    </nav>
  );
}
