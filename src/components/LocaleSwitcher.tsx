"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LOCALES, DEFAULT_LOCALE, LOCALE_LABELS, isLocale } from "@/i18n";
import type { Locale } from "@/i18n";

function buildPath(target: Locale, currentPath: string): string {
  // Strip any leading locale segment.
  const parts = currentPath.split("/").filter(Boolean);
  if (parts[0] && isLocale(parts[0])) parts.shift();
  const rest = parts.join("/");
  if (target === DEFAULT_LOCALE) return rest ? `/${rest}` : "/";
  return rest ? `/${target}/${rest}` : `/${target}`;
}

export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname() ?? "/";
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] font-mono"
    >
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="opacity-40">/</span>}
          <Link
            href={buildPath(l, pathname)}
            aria-current={l === current ? "true" : undefined}
            className={`transition-opacity ${
              l === current ? "opacity-100" : "opacity-50 hover:opacity-100"
            }`}
          >
            {LOCALE_LABELS[l]}
          </Link>
        </span>
      ))}
    </div>
  );
}
