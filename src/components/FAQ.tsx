import { Reveal } from "./Reveal";
import type { Dictionary } from "@/i18n/types";

export function FAQ({ dict }: { dict: Dictionary["faq"] }) {
	return (
		<section
			id="faq"
			className="px-6 md:px-10 py-24 md:py-32 border-t border-line"
		>
			<Reveal>
				<div className="flex items-baseline justify-between mb-12 md:mb-16">
					<h2 className="font-serif italic text-3xl md:text-5xl">{dict.title}</h2>
					<span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
						{dict.eyebrow}
					</span>
				</div>
			</Reveal>

			<ol className="divide-y divide-line border-y border-line">
				{dict.items.map((item, i) => (
					<Reveal key={i} delay={i * 60}>
						<li className="grid md:grid-cols-12 gap-4 md:gap-8 py-8 md:py-10">
							<span className="md:col-span-1 font-mono text-xs uppercase tracking-[0.2em] text-muted pt-1">
								{String(i + 1).padStart(2, "0")}
							</span>
							<h3 className="md:col-span-5 font-serif italic text-xl md:text-2xl leading-snug">
								{item.q}
							</h3>
							<p
								className="md:col-span-6 text-base md:text-lg leading-relaxed text-fg/80 max-w-2xl [&_a]:underline [&_a]:hover:opacity-60 [&_a]:transition-opacity"
								dangerouslySetInnerHTML={{ __html: item.a }}
							/>
						</li>
					</Reveal>
				))}
			</ol>
		</section>
	);
}
