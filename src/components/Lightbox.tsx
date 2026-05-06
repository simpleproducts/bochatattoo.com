"use client";
import { useEffect, useCallback, useRef, useState } from "react";
import { RemoteImage } from "./RemoteImage";
import { getImage, imageUrl } from "@/lib/images";

type Piece = {
  slug: string;
  /** Alt text shown nowhere visually — used only for screen-reader / aria. */
  alt: string;
  /** Visible category label in the lightbox header. */
  category?: string;
};

type EndCard = {
  title: string;
  copy: string;
  startOverLabel: string;
  continueLabel: string;
  continueHref: string;
};

type Props = {
  pieces: Piece[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (next: number) => void;
  labels: { close: string; next: string; prev: string; share: string };
  /** When set, advancing past the last piece shows this card instead of looping. */
  endCard?: EndCard;
  /** Called whenever the visible slug changes so the parent can sync ?foto= */
  onSlugChange?: (slug: string | null) => void;
};

export function Lightbox({
  pieces,
  index,
  onClose,
  onIndexChange,
  labels,
  endCard,
  onSlugChange,
}: Props) {
  const open = index !== null;
  const [direction, setDirection] = useState<1 | -1>(1);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const endIndex = endCard ? pieces.length : null;
  const isEnd = endIndex !== null && index === endIndex;

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      setDirection(delta > 0 ? 1 : -1);

      if (endIndex === null) {
        // No end card — wrap normally.
        const next = (index + delta + pieces.length) % pieces.length;
        onIndexChange(next);
        return;
      }

      if (delta > 0) {
        // Forward: …N-2 → N-1 → end → 0 → 1 …
        if (index === pieces.length - 1) onIndexChange(endIndex);
        else if (index === endIndex) onIndexChange(0);
        else onIndexChange(index + 1);
      } else {
        // Backward: …2 → 1 → 0 → end → N-1 → N-2 …
        // The end card is reachable from BOTH directions so users can find it
        // whether they navigate forward off the last piece or backward off the first.
        if (index === 0) onIndexChange(endIndex);
        else if (index === endIndex) onIndexChange(pieces.length - 1);
        else onIndexChange(index - 1);
      }
    },
    [index, pieces.length, onIndexChange, endIndex],
  );

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, go]);

  // Sync ?foto=slug into the URL whenever the open piece changes.
  useEffect(() => {
    if (!open || isEnd) {
      onSlugChange?.(null);
      return;
    }
    const slug = pieces[index!]?.slug ?? null;
    onSlugChange?.(slug);
  }, [open, index, isEnd, pieces, onSlugChange]);

  useEffect(() => {
    if (!open) return;
    const slug = pieces[index!]?.slug;
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("tattoo", slug);
    window.history.pushState({ lightbox: true }, "", url.toString());
    const onPopState = () => onCloseRef.current();
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (window.history.state?.lightbox) {
        const clean = new URL(window.location.href);
        clean.searchParams.delete("tattoo");
        window.history.back();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // While open, update the URL slug in-place as the user navigates.
  useEffect(() => {
    if (!open || isEnd) return;
    const slug = pieces[index!]?.slug;
    if (!slug) return;
    const url = new URL(window.location.href);
    url.searchParams.set("tattoo", slug);
    window.history.replaceState(window.history.state, "", url.toString());
  }, [open, index, isEnd, pieces]);

  // Preload neighbours so navigation feels instant.
  useEffect(() => {
    if (index === null || isEnd) return;
    const neighbours = [-1, 1]
      .map((d) => pieces[(index + d + pieces.length) % pieces.length])
      .filter(Boolean);
    for (const p of neighbours) {
      const entry = getImage(p.slug);
      if (!entry) continue;
      const img = new Image();
      img.src = imageUrl(
        p.slug,
        entry.sizes[entry.sizes.length - 1],
        entry.format ?? "avif",
      );
    }
  }, [index, pieces, isEnd]);

  if (!open) return null;

  const piece = isEnd ? null : pieces[index!];
  const entry = piece ? getImage(piece.slug) : null;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
    }
  };

  // Header counter / label — display the category (never the image's filename)
  const counterText = isEnd
    ? "—"
    : `${String((index ?? 0) + 1).padStart(2, "0")} / ${String(pieces.length).padStart(2, "0")}`;
  const headerTitle = isEnd ? endCard!.title : (piece?.category ?? "");
  const dialogLabel = isEnd ? endCard!.title : (piece?.alt ?? "");

  // Share the current image. The proxy returns a JPEG, which iOS / Android /
  // Instagram all recognise as a real photo (AVIF gets demoted to a link).
  //
  //  - Mobile with Web Share + files → opens the OS share sheet, user picks
  //    Instagram → Story / Feed and the photo is pre-attached.
  //  - Desktop or browsers without canShare(files) → triggers a JPEG download
  //    so the user can post it manually from their phone.
  //  - User-cancelled shares are silent.
  async function shareCurrent() {
    if (!piece || !entry) return;
    const url = `/api/share-image?slug=${encodeURIComponent(piece.slug)}`;
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) throw new Error("fetch-failed");
      // Force the MIME type to image/jpeg regardless of what the blob reports
      // — some user agents read it back as the original (avif/webp) which
      // makes Instagram treat the share as a link.
      const raw = await res.blob();
      const blob = new Blob([raw], { type: "image/jpeg" });
      const file = new File([blob], `bocha-${piece.slug}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: piece.alt,
          text: "@bocha.ttt",
        });
        return;
      }

      // Desktop / unsupported → trigger download so the user can post manually
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-bg/95 backdrop-blur-md flex items-center justify-center animate-lb-in"
      role="dialog"
      aria-modal="true"
      aria-label={dialogLabel}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 md:px-10 py-5 text-fg/80 font-mono text-xs uppercase tracking-[0.2em] z-10">
        <span className="truncate max-w-[30%]">{headerTitle}</span>
        <span>{counterText}</span>
        <div className="flex items-center gap-5">
          {!isEnd && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                shareCurrent();
              }}
              className="inline-flex items-center gap-1.5 hover:opacity-60 transition-opacity"
              aria-label={labels.share}
            >
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4 8 1 5 4" />
                <path d="M8 1v9" />
                <path d="M3 7v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7" />
              </svg>
              <span className="hidden sm:inline">{labels.share}</span>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="hover:opacity-60 transition-opacity"
            aria-label={labels.close}
          >
            {labels.close} ×
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          go(-1);
        }}
        aria-label={labels.prev}
        className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full border border-fg/30 hover:border-fg hover:bg-fg/10 active:scale-90 transition-all duration-150 text-xl z-10"
      >
        ←
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          go(1);
        }}
        aria-label={labels.next}
        className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full border border-fg/30 hover:border-fg hover:bg-fg/10 active:scale-90 transition-all duration-150 text-xl z-10"
      >
        →
      </button>

      <div
        key={isEnd ? "__end__" : index}
        className={`relative max-w-[88vw] max-h-[80vh] flex items-center justify-center ${
          direction === 1 ? "lb-slide-right" : "lb-slide-left"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isEnd ? (
          <div className="max-w-md text-center px-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted mb-4">
              {endCard!.title}
            </p>
            <h3 className="font-serif text-3xl md:text-4xl leading-tight mb-8 text-balance">
              {endCard!.copy}
            </h3>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <button
                type="button"
                onClick={() => {
                  setDirection(1);
                  onIndexChange(0);
                }}
                className="px-5 py-3 border border-fg/30 hover:border-fg hover:bg-fg hover:text-bg transition-colors font-mono text-[10px] uppercase tracking-[0.3em]"
              >
                ↺ {endCard!.startOverLabel}
              </button>
              <a
                href={endCard!.continueHref}
                className="px-5 py-3 border border-fg bg-fg text-bg hover:bg-transparent hover:text-fg transition-colors font-mono text-[10px] uppercase tracking-[0.3em]"
              >
                {endCard!.continueLabel}
              </a>
            </div>
          </div>
        ) : entry ? (
          <div
            className="relative"
            style={{
              aspectRatio: `${entry.width} / ${entry.height}`,
              width: `min(88vw, ${(entry.width / entry.height) * 80}vh)`,
            }}
          >
            <RemoteImage
              slug={piece!.slug}
              alt={piece!.alt}
              fill
              sizes="88vw"
              priority
              className="object-contain"
            />
          </div>
        ) : (
          <div className="w-[88vw] h-[80vh] max-w-[1200px] bg-line flex items-center justify-center text-muted text-xs uppercase tracking-[0.2em] font-mono">
            {piece?.slug}
          </div>
        )}
      </div>
    </div>
  );
}
