"use client";
import { useEffect, useRef } from "react";

const VIDEO_URL = process.env.NEXT_PUBLIC_HERO_VIDEO_URL;
const POSTER_URL = process.env.NEXT_PUBLIC_HERO_POSTER_URL;

export function HeroBackground() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const onScroll = () => {
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
    <div className="absolute inset-0 -z-10 overflow-hidden bg-bg">
      <div ref={layerRef} className="absolute inset-0 will-change-transform">
        {VIDEO_URL ? (
          <video
            src={VIDEO_URL}
            poster={POSTER_URL}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 hero-placeholder" aria-hidden />
        )}
      </div>

      {/* Vignette + bottom fade so text stays legible */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(10,10,10,0.65)_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent via-bg/70 to-bg"
      />

      {/* Scanline / film grain affectation only on the hero */}
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
