"use client";
import { useEffect, useCallback } from "react";
import { RemoteImage } from "./RemoteImage";
import { getImage } from "@/lib/images";

type Piece = { slug: string; title: string };

type Props = {
  pieces: Piece[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (next: number) => void;
  labels: { close: string; next: string; prev: string };
};

export function Lightbox({ pieces, index, onClose, onIndexChange, labels }: Props) {
  const open = index !== null;

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
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

  if (!open) return null;

  const piece = pieces[index];
  const entry = getImage(piece.slug);

  return (
    <div
      className="fixed inset-0 z-[200] bg-bg/95 backdrop-blur-md flex items-center justify-center animate-lb-in"
      role="dialog"
      aria-modal="true"
      aria-label={piece.title}
      onClick={onClose}
    >
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 md:px-10 py-5 text-fg/80 font-mono text-xs uppercase tracking-[0.2em]">
        <span>{piece.title}</span>
        <span>{String(index + 1).padStart(2, "0")} / {String(pieces.length).padStart(2, "0")}</span>
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
        className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full border border-fg/30 hover:border-fg hover:bg-fg/5 transition-colors text-xl"
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
        className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full border border-fg/30 hover:border-fg hover:bg-fg/5 transition-colors text-xl"
      >
        →
      </button>

      <div
        className="relative max-w-[88vw] max-h-[80vh] flex items-center justify-center"
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
