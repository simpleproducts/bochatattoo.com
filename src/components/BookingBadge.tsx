type Props = {
  text: string;
  className?: string;
};

/**
 * Slowly-rotating circular text badge with a pulsing dot at the center.
 */
export function BookingBadge({ text, className = "" }: Props) {
  const id = "booking-badge-path";
  // Repeat so the text wraps fully around the circle.
  const ring = ` · ${text} · ${text} `;
  return (
    <div
      className={`relative w-24 h-24 md:w-28 md:h-28 ${className}`}
      aria-label={text}
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
            fontSize: "9px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          <textPath href={`#${id}`} startOffset="0">
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
}
