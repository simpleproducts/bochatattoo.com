"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";

const REDUCED_MOTION_MQ = "(prefers-reduced-motion: reduce)";

/**
 * Whether the curtain animates at all is a fact about the VIEWER's machine,
 * not state this component owns, so it is read through `useSyncExternalStore`
 * — the same pattern AdminCalendar and InstallPrompt use for the facts the
 * server cannot know — instead of being copied into state by an effect.
 *
 * The query is not subscribed to: the old effect read it once at mount and
 * decided the whole life of the curtain from that, and a viewer who flips the
 * OS setting mid-animation is not a case worth re-deciding for.
 */
const subscribeNever = () => () => {};

/** getSnapshot runs on every render, so the MediaQueryList is made once. */
let reducedMotionQuery: MediaQueryList | null = null;

function readReducedMotion(): boolean {
  reducedMotionQuery ??= window.matchMedia(REDUCED_MOTION_MQ);
  return reducedMotionQuery.matches;
}

/**
 * `false` is what the server rendered before and must keep rendering: the
 * curtain is in the HTML, and React uses this snapshot for the hydrating
 * render too, so the first client paint still matches. The real query is read
 * on the re-render right after hydration — the very moment the old effect ran.
 */
const readReducedMotionOnServer = (): boolean => false;

export function PageCurtain() {
  const reducedMotion = useSyncExternalStore(
    subscribeNever,
    readReducedMotion,
    readReducedMotionOnServer,
  );
  const [lifted, setLifted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // With motion reduced there is no curtain to lift, so it is already over.
  // That half is derived from the environment; only the timer's half is state.
  const gone = reducedMotion || timedOut;

  useEffect(() => {
    // Mobile Safari restores scroll based on stale heights; take manual control.
    // Runs post-hydration but the scrollTo override still snaps to top quickly.
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    // Split from the scroll handling above so that this half can depend on the
    // media query — the scroll reset stays a mount-only act, as it was.
    if (reducedMotion) return;
    const r = requestAnimationFrame(() => setLifted(true));
    const t = setTimeout(() => setTimedOut(true), 1200);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
    };
  }, [reducedMotion]);

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
