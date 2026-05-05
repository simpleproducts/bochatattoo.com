"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

export function PageCurtain() {
  const [lifted, setLifted] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setGone(true);
      return;
    }
    const r = requestAnimationFrame(() => setLifted(true));
    const t = setTimeout(() => setGone(true), 1200);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[300] bg-bg pointer-events-none transition-transform duration-[900ms] ease-[cubic-bezier(.76,0,.24,1)] flex items-center justify-center ${
        lifted ? "-translate-y-full" : ""
      }`}
    >
      <div className="relative w-24 h-24 md:w-32 md:h-32 opacity-50 curtain-mark">
        <Image
          src="/logo/logo-white.png"
          alt="Bocha Tattoo"
          fill
          sizes="128px"
          priority
          className="object-contain"
        />
      </div>
    </div>
  );
}
