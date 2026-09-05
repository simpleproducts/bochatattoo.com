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
 */
import Link from "next/link";

export type AdminTab = "calendar" | "images" | "categories";

const TABS = [
  { key: "calendar", href: "/admin/calendar", label: "Calendar" },
  { key: "images", href: "/admin/gallery", label: "Images" },
  { key: "categories", href: "/admin/gallery?tab=categories", label: "Categories" },
] as const;

export function AdminNav({ active }: { active: AdminTab }) {
  return (
    <nav className="flex items-center gap-2 border-b border-line">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={`px-3 py-2 text-xs uppercase tracking-[0.2em] font-mono border-b-2 transition-colors cursor-pointer ${
            tab.key === active
              ? "border-fg text-fg"
              : "border-transparent text-muted hover:text-fg"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
