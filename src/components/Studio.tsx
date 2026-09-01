import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const principles = [
  "Le chrome n'est pas une couleur, c'est une posture.",
  "Le rose n'est pas un cliché, c'est une signature.",
  "Le studio garde la main, jamais la machine.",
];

export default function Studio() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section
      id="studio"
      ref={ref}
      className="relative overflow-hidden border-t border-white/5 py-28 md:py-44"
    >
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-5 md:px-10 lg:grid-cols-12 lg:gap-16">
        {/* LEFT: editorial copy */}
        <div className="lg:col-span-7">
          <SectionLabel n="03" label="Studio" />
          <h2 className="mt-6 font-display text-5xl uppercase leading-[0.9] tracking-tight md:text-7xl">
            <span className="chrome-text">On forge,</span>
            <br />
            <span className="chrome-pink">on ne suit pas.</span>
          </h2>

          <div className="mt-10 max-w-xl text-base leading-relaxed text-white/65">
            PinkStar Society est un studio fermé sur rendez-vous. Trois
            principes, aucune répétition, une obsession : la lumière qui se
            pose sur la finition.
          </div>

          <ul className="mt-12 space-y-4">
            {principles.map((p, i) => (
              <motion.li
                key={p}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="flex items-baseline gap-5 border-t border-white/10 pt-4"
              >
                <span className="font-mono text-xs text-pss-pink">
                  /0{i + 1}
                </span>
                <span className="font-display text-2xl uppercase leading-snug text-white md:text-3xl">
                  {p}
                </span>
              </motion.li>
            ))}
          </ul>

          <div className="mt-14 flex flex-wrap gap-8 border-t border-white/10 pt-8">
            <Stat n="2003" l="Année 0" />
            <Stat n="04" l="Drops actifs" />
            <Stat n="11" l="Villes" />
            <Stat n="100%" l="Chrome" />
          </div>
        </div>

        {/* RIGHT: editorial column */}
        <motion.div style={{ y }} className="relative lg:col-span-5">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-white/10">
            <div className="absolute inset-0 bg-gradient-to-br from-pss-pink/30 via-fuchsia-700/20 to-black" />
            <div className="absolute inset-0 grid-noise opacity-50" />
            <div className="absolute inset-x-0 top-0 grid place-items-center p-8">
              <BigStar />
            </div>
            <div className="absolute inset-x-6 bottom-6 flex items-end justify-between text-white/80">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                  Studio
                </div>
                <div className="mt-1 font-display text-2xl uppercase">
                  Paris · 11ᵉ
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                  Sur RDV
                </div>
                <div className="mt-1 font-display text-2xl uppercase">
                  7 j / 7
                </div>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-card -mt-10 ml-6 w-[calc(100%-1.5rem)] rounded-2xl p-5 backdrop-blur lg:ml-10 lg:w-[calc(100%-2.5rem)]"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-pss-pink/15 text-pss-pink">
                ★
              </span>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                  Note collective
                </div>
                <div className="font-display text-lg text-white">
                  4,9 / 5 — 312 visites
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="font-display text-3xl text-white md:text-4xl">{n}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/45">
        {l}
      </div>
    </div>
  );
}

function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/55">
      <span className="font-mono text-pss-pink">/{n}</span>
      <span className="h-px w-10 bg-white/20" />
      <span>{label}</span>
    </div>
  );
}

function BigStar() {
  return (
    <svg
      viewBox="0 0 240 240"
      className="h-44 w-44 drop-shadow-[0_0_40px_rgba(255,0,122,0.45)] md:h-56 md:w-56"
    >
      <defs>
        <linearGradient id="bs" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe6f4" />
          <stop offset="0.45" stopColor="#ff007a" />
          <stop offset="0.6" stopColor="#5a0028" />
          <stop offset="1" stopColor="#ff7ad1" />
        </linearGradient>
      </defs>
      <g transform="translate(120,120)">
        <polygon
          fill="url(#bs)"
          stroke="#0c0010"
          strokeWidth="8"
          strokeLinejoin="round"
          points="0,-96 27,-32 96,-32 41,6 62,76 0,36 -62,76 -41,6 -96,-32 -27,-32"
        />
      </g>
    </svg>
  );
}
