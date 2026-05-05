"use client";
import { useEffect, useCallback, useRef, useState } from "react";
import { RemoteImage } from "./RemoteImage";
import { getImage, imageUrl } from "@/lib/images";

type Piece = { slug: string; title: string };

type Props = {
  pieces: Piece[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (next: number) => void;
  labels: { close: string; next: string; prev: string };
};

export function Lightbox({
  pieces,
  index,
  onClose,
  onIndexChange,
  labels,
}: Props) {
  const open = index !== null;
  const [direction, setDirection] = useState<1 | -1>(1);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      setDirection(delta > 0 ? 1 : -1);
      const next = (index + delta + pieces.length) % pieces.length;
      onIndexChange(next);
    },
    [index, pieces.length, onIndexChange],
  );

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

  // Preload neighbours so navigation feels instant.
  useEffect(() => {
    if (index === null) return;
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
  }, [index, pieces]);

  if (!open) return null;

  const piece = pieces[index];
  const entry = getImage(piece.slug);

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

  return (
    <div
      className="fixed inset-0 z-[200] bg-bg/95 backdrop-blur-md flex items-center justify-center animate-lb-in"
      role="dialog"
      aria-modal="true"
      aria-label={piece.title}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 md:px-10 py-5 text-fg/80 font-mono text-xs uppercase tracking-[0.2em] z-10">
        <span className="truncate max-w-[40%]">{piece.title}</span>
        <span>
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(pieces.length).padStart(2, "0")}
        </span>
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
        // key remounts the slide on each index change → CSS animation re-runs.
        key={index}
        className={`relative max-w-[88vw] max-h-[80vh] flex items-center justify-center ${
          direction === 1 ? "lb-slide-right" : "lb-slide-left"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {entry ? (
          <div
            className="relative"
            style={{
              aspectRatio: `${entry.width} / ${entry.height}`,
              width: `min(88vw, ${(entry.width / entry.height) * 80}vh)`,
            }}
          >
            <RemoteImage
              slug={piece.slug}
              fill
              sizes="88vw"
              priority
              className="object-contain"
            />
          </div>
        ) : (
          <div className="w-[88vw] h-[80vh] max-w-[1200px] bg-line flex items-center justify-center text-muted text-xs uppercase tracking-[0.2em] font-mono">
            {piece.slug}
          </div>
        )}
      </div>
    </div>
  );
}
