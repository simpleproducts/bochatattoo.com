"use client";
import { useEffect, useRef } from "react";

const VIDEO_URL = process.env.NEXT_PUBLIC_HERO_VIDEO_URL;
const POSTER_URL = process.env.NEXT_PUBLIC_HERO_POSTER_URL;

export function HeroBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

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

    let mraf = 0;
    let mx = 50;
    let my = 50;
    let cx = 50;
    let cy = 50;
    const onMove = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth) * 100;
      my = (e.clientY / window.innerHeight) * 100;
    };
    const tick = () => {
      cx += (mx - cx) * 0.06;
      cy += (my - cy) * 0.06;
      const el = spotlightRef.current;
      if (el) {
        el.style.setProperty("--mx", `${cx}%`);
        el.style.setProperty("--my", `${cy}%`);
      }
      mraf = requestAnimationFrame(tick);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    if (!reduce && !window.matchMedia("(pointer: coarse)").matches) {
      window.addEventListener("mousemove", onMove, { passive: true });
      mraf = requestAnimationFrame(tick);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(mraf);
    };
  }, []);

  return (
    <div ref={rootRef} className="absolute inset-0 -z-10 overflow-hidden bg-bg">
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
            <source
              srcSet="/site/bocha-bg-desktop.avif"
              type="image/avif"
            />
            <source
              srcSet="/site/bocha-bg-desktop.webp"
              type="image/webp"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/site/bocha-bg-desktop.webp"
              alt=""
              aria-hidden
              fetchPriority="high"
              className="w-full h-full object-cover object-center md:scale-[1.36] md:translate-x-[35%] md:origin-center"
            />
          </picture>
        )}
      </div>

      {/* Mouse-tracked spotlight (uses CSS vars set in the rAF loop above) */}
      <div
        ref={spotlightRef}
        aria-hidden
        className="absolute inset-0 pointer-events-none hero-spotlight"
        style={{
          ["--mx" as string]: "50%",
          ["--my" as string]: "30%",
        }}
      />

      {/* Vignette + bottom fade so text stays legible */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(10,10,10,0.65)_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent via-bg/70 to-bg"
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
