const STEPS = [
  {
    n: "01",
    title: "Inquiry",
    body: "Send a short note with your idea, references, placement, and approximate size. Placeholder copy describing the intake.",
  },
  {
    n: "02",
    title: "Conversation",
    body: "We discuss the piece — what it means, how it should feel, where it lives on the body. Placeholder copy.",
  },
  {
    n: "03",
    title: "Design",
    body: "Bocha drafts a custom design from the brief. One round of refinements before the day. Placeholder copy.",
  },
  {
    n: "04",
    title: "Session",
    body: "We meet at the studio. Sessions are private, unhurried, and focused on the work. Placeholder copy.",
  },
];

export function Process() {
  return (
    <section
      id="process"
      className="px-6 md:px-10 py-24 md:py-32 border-t border-line"
    >
      <div className="flex items-baseline justify-between mb-12 md:mb-16">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          03 / Process
        </span>
        <h2 className="font-serif italic text-3xl md:text-5xl">
          From sketch to skin
        </h2>
      </div>

      <ol className="divide-y divide-line border-y border-line">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className="grid md:grid-cols-12 gap-4 md:gap-8 py-8 md:py-10 group"
          >
            <span className="md:col-span-2 font-mono text-xs uppercase tracking-[0.2em] text-muted pt-1">
              {step.n}
            </span>
            <h3 className="md:col-span-3 font-serif text-2xl md:text-3xl">
              {step.title}
            </h3>
            <p className="md:col-span-7 text-base md:text-lg leading-relaxed text-fg/80 max-w-2xl">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
