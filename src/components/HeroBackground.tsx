"use client";
import { useEffect, useRef } from "react";

export function HeroBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    const onScroll = () => {
      if (reduce) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = layerRef.current;
        if (!el) return;
        const y = Math.min(window.scrollY * 0.35, 400);
        el.style.transform = `translate3d(0, ${y}px, 0) scale(1.06)`;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden bg-bg z-0">
      <div ref={layerRef} className="absolute inset-0 will-change-transform">
        <picture>
          <source
            media="(max-width: 768px)"
            srcSet="/site/bocha-bg-mobile.avif"
            type="image/avif"
          />
          <source
            media="(max-width: 768px)"
            srcSet="/site/bocha-bg-mobile.webp"
            type="image/webp"
          />
          <source srcSet="/site/bocha-bg-desktop.avif" type="image/avif" />
          <source srcSet="/site/bocha-bg-desktop.webp" type="image/webp" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/site/bocha-bg-desktop.webp"
            alt=""
            aria-hidden
            fetchPriority="high"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
            }}
          />
        </picture>
      </div>

      {/* Vignette + bottom fade so text stays legible */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(10,10,10,0.65)_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,10,10,0) 0%, rgba(10,10,10,0.7) 55%, #0a0a0a 100%)",
        }}
      />

      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0 1px, transparent 1px 3px)",
        }}
      />
    </div>
  );
}
