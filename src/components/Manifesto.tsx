import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const lines = [
  "Le chrome n'est pas une couleur, c'est une posture.",
  "Le rose n'est pas un cliché, c'est une arme.",
  "Le Y2K n'est pas nostalgique, c'est un futur qui a tenu parole.",
  "On ne suit pas la hype — on la fond et on la coule en pièces.",
];

export default function Manifesto() {
  const ref = useRef<HTMLElement>(null);

  return (
    <section
      id="manifeste"
      ref={ref}
      className="relative overflow-hidden py-32 md:py-44"
    >
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-30" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-pss-pink/10 blur-[140px]" />

      <div className="mx-auto max-w-[1200px] px-5 md:px-10">
        <Header />
        <div className="mt-14 space-y-2 md:space-y-4">
          {lines.map((line, i) => (
            <Line key={i} text={line} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Header() {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <div className="pill mb-4">/ 01 — Manifeste</div>
        <h2 className="font-display text-5xl uppercase leading-none tracking-tight chrome-text md:text-7xl">
          On forge,
          <br />
          on ne suit pas.
        </h2>
      </div>
      <div className="hidden max-w-xs text-right text-sm text-white/55 md:block">
        Quatre principes. Aucun compromis. Le reste se lit dans la lumière sur
        les surfaces.
      </div>
    </div>
  );
}

function Line({ text, index }: { text: string; index: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "start 30%"],
  });
  const opacity = useTransform(scrollYProgress, [0, 1], [0.18, 1]);
  const x = useTransform(scrollYProgress, [0, 1], [-30, 0]);

  return (
    <motion.p
      ref={ref}
      style={{ opacity, x }}
      className="flex items-baseline gap-4 font-display text-3xl uppercase leading-tight tracking-tight md:gap-8 md:text-6xl"
    >
      <span className="font-mono text-xs text-pss-pink md:text-sm">
        0{index + 1}
      </span>
      <span className="text-white">{text}</span>
    </motion.p>
  );
}
