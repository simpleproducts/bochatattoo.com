type Props = {
  text: string;
  className?: string;
  /** If set, the badge becomes a link */
  href?: string;
  /** Accessible label for the link */
  ariaLabel?: string;
};

/**
 * Slowly-rotating circular text badge with a pulsing dot at the centre.
 * The text wraps the circle exactly once and auto-fits via SVG `textLength`,
 * so any locale length renders without clipping.
 */
export function BookingBadge({ text, className = "", href, ariaLabel }: Props) {
  const id = "booking-badge-path";
  // Circle radius 38 → circumference ≈ 238.76 SVG units (matches viewBox 100x100)
  const CIRCUMFERENCE = 238.76;
  const ring = ` ${text} · ${text} ·`;

  const inner = (
    <div
      className={`relative w-24 h-24 md:w-28 md:h-28 ${className}`}
      aria-label={ariaLabel ?? text}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full animate-spin-slow text-fg"
      >
        <defs>
          <path
            id={id}
            d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"
            fill="none"
          />
        </defs>
        <text
          fill="currentColor"
          style={{
            fontFamily:
              "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
            fontSize: "8px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          <textPath
            href={`#${id}`}
            startOffset="0"
            textLength={CIRCUMFERENCE}
            lengthAdjust="spacingAndGlyphs"
          >
            {ring}
          </textPath>
        </text>
      </svg>
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="block w-1.5 h-1.5 rounded-full bg-fg animate-pulse" />
      </span>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        aria-label={ariaLabel ?? text}
        className="block transition-opacity hover:opacity-80"
      >
        {inner}
      </a>
    );
  }
  return inner;
}
