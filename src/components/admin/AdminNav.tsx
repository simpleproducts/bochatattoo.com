/**
 * The admin area's top-level tab bar: Gallery | Calendar.
 *
 * Rendered BY EACH PAGE, never by src/app/admin/layout.tsx. The login page is
 * a child of that layout and is one of middleware's PUBLIC_PATHS, so a nav
 * hoisted into the layout would show an unauthenticated visitor a tab bar
 * advertising and linking into the protected area.
 *
 * A server component on purpose: `active` is decided by whichever page renders
 * it, so there is nothing here for the client bundle to do.
 *
 * The class strings are lifted verbatim from the images/categories tab bar in
 * AdminGallery.tsx so the two rows of tabs are indistinguishable.
 */
import Link from "next/link";

const TABS = [
  { key: "gallery", href: "/admin", label: "Gallery" },
  { key: "calendar", href: "/admin/calendar", label: "Calendar" },
] as const;

type Props = { active: "gallery" | "calendar" };

export function AdminNav({ active }: Props) {
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
