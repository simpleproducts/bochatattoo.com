"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LOCALES, LOCALE_LABELS } from "@/i18n";
import { translatePath } from "@/i18n/routes";
import type { Locale } from "@/i18n";

/*
 * The target URL comes from translatePath, not from swapping the "/en" prefix
 * here. Some segments are spelled differently per language — /tatuajes/animales
 * is /en/tattoos/animales — so prefix-swapping alone builds /en/tatuajes/animales,
 * which 404s. The switcher only knows the current pathname, so the mapping has
 * to live somewhere that can translate an arbitrary path: src/i18n/routes.ts.
 */

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
            href={translatePath(pathname, l)}
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
