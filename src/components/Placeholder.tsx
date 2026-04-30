type Props = {
  label?: string;
  ratio?: "portrait" | "square" | "landscape" | "tall";
  index?: number;
};

const RATIO: Record<NonNullable<Props["ratio"]>, string> = {
  portrait: "aspect-[3/4]",
  square: "aspect-square",
  landscape: "aspect-[4/3]",
  tall: "aspect-[2/3]",
};

export function Placeholder({ label = "Image", ratio = "portrait", index }: Props) {
  return (
    <figure
      className={`relative ${RATIO[ratio]} bg-line overflow-hidden group`}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 14px)",
        }}
      />
      <div className="absolute inset-0 flex items-end justify-between p-4 text-[10px] uppercase tracking-[0.2em] font-mono text-muted">
        <span>{label}</span>
        {typeof index === "number" && (
          <span>{String(index).padStart(2, "0")}</span>
        )}
      </div>
      <figcaption className="sr-only">{label} placeholder</figcaption>
    </figure>
  );
}
