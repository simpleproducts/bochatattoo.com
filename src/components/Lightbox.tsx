"use client";
import { useEffect, useCallback, useRef, useState } from "react";
import { RemoteImage } from "./RemoteImage";
import { getImage, imageUrl } from "@/lib/images";

type Piece = { slug: string; title: string; category?: string };

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
  labels: { close: string; next: string; prev: string };
  /** When set, advancing past the last piece shows this card instead of looping. */
  endCard?: EndCard;
};

export function Lightbox({
  pieces,
  index,
  onClose,
  onIndexChange,
  labels,
  endCard,
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

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ lightbox: true }, "");
    const onPopState = () => onCloseRef.current();
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (window.history.state?.lightbox) {
        window.history.back();
      }
    };
  }, [open]);

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

  return (
    <div
      className="fixed inset-0 z-[200] bg-bg/95 backdrop-blur-md flex items-center justify-center animate-lb-in"
      role="dialog"
      aria-modal="true"
      aria-label={headerTitle}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 md:px-10 py-5 text-fg/80 font-mono text-xs uppercase tracking-[0.2em] z-10">
        <span className="truncate max-w-[40%]">{headerTitle}</span>
        <span>{counterText}</span>
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
