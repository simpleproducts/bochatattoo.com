import { Placeholder } from "./Placeholder";

const PIECES: { label: string; ratio: "portrait" | "square" | "landscape" | "tall" }[] = [
  { label: "Untitled — Forearm", ratio: "portrait" },
  { label: "Untitled — Sternum", ratio: "tall" },
  { label: "Untitled — Hand", ratio: "square" },
  { label: "Untitled — Calf", ratio: "portrait" },
  { label: "Untitled — Back", ratio: "landscape" },
  { label: "Untitled — Thigh", ratio: "portrait" },
  { label: "Untitled — Ribs", ratio: "tall" },
  { label: "Untitled — Neck", ratio: "square" },
  { label: "Untitled — Shoulder", ratio: "portrait" },
];

export function Work() {
  return (
    <section id="work" className="px-6 md:px-10 py-24 md:py-32">
      <div className="flex items-baseline justify-between mb-12 md:mb-16">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            01 / Work
          </span>
        </div>
        <h2 className="font-serif italic text-3xl md:text-5xl">
          Selected pieces
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        {PIECES.map((p, i) => (
          <Placeholder key={i} label={p.label} ratio={p.ratio} index={i + 1} />
        ))}
      </div>

      <div className="mt-12 flex justify-end">
        <a
          href="#contact"
          className="text-xs uppercase tracking-[0.2em] font-mono border-b border-current pb-1 hover:opacity-60 transition-opacity"
        >
          Inquire about a piece →
        </a>
      </div>
    </section>
  );
}
