type Props = {
  children: string;
  className?: string;
  /** ms between each character */
  stagger?: number;
  /** ms before the first character starts */
  delay?: number;
};

/**
 * Splits a string into per-character spans for a kinetic-type entrance.
 * The animation itself lives in globals.css under `.split-char`.
 */
export function SplitText({
  children,
  className = "",
  stagger = 45,
  delay = 100,
}: Props) {
  return (
    <span aria-label={children} className={`split inline-block ${className}`}>
      {[...children].map((char, i) => (
        <span
          key={i}
          aria-hidden
          className="split-char inline-block"
          style={{ animationDelay: `${delay + i * stagger}ms` }}
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </span>
  );
}
