"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

const REDUCED_MOTION_MQ = "(prefers-reduced-motion: reduce)";

/**
 * Whether anything fades in at all is a fact about the VIEWER's machine, not
 * state this component owns, so it is read through `useSyncExternalStore` —
 * the pattern AdminCalendar and InstallPrompt use for the facts the server
 * cannot know — instead of being copied into state by an effect.
 *
 * Not subscribed to: the old effect read the query once at mount and never
 * looked again, and a viewer toggling the OS setting mid-scroll is not worth
 * re-deciding already-revealed blocks for.
 */
const subscribeNever = () => () => {};

/**
 * getSnapshot runs on every render and this component is on the page dozens of
 * times, so the MediaQueryList is made once for the module rather than per read.
 */
let reducedMotionQuery: MediaQueryList | null = null;

function readReducedMotion(): boolean {
  reducedMotionQuery ??= window.matchMedia(REDUCED_MOTION_MQ);
  return reducedMotionQuery.matches;
}

/**
 * `false` is what the server rendered before and must keep rendering, and React
 * uses this snapshot for the hydrating render too, so the first client paint
 * still matches the HTML. The real query is read on the re-render right after
 * hydration — the same moment the old effect ran.
 */
const readReducedMotionOnServer = (): boolean => false;

export function Reveal({ children, className = "", delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeNever,
    readReducedMotion,
    readReducedMotionOnServer,
  );
  const [revealed, setRevealed] = useState(false);

  // With motion reduced there is nothing to reveal — the block is simply
  // there — so that half is derived from the query rather than written into
  // state. globals.css already forces `.reveal` opaque under the same media
  // query; this only keeps the class in agreement with what is painted.
  const visible = reducedMotion || revealed;

  useEffect(() => {
    // Nothing to watch when motion is reduced: everything is already shown.
    if (reducedMotion) return;

    const el = ref.current;
    if (!el) return;

    // Already on-screen at mount → reveal immediately, skip the observer.
    // Avoids the "fades in only after I scroll" feel for above-the-fold blocks.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setRevealed(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setRevealed(true);
            io.unobserve(el);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={visible ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
