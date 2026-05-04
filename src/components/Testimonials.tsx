import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";

type Quote = {
  q: string;
  name: string;
  role: string;
};

const quotes: Quote[] = [
  {
    q: "Première fois que je sors d'un rendez-vous nail en ayant l'impression d'avoir une pièce d'orfèvre sur les mains.",
    name: "Léa M.",
    role: "Pose gel · nail art",
  },
  {
    q: "Je ne pensais pas franchir le pas, mais l'accueil est nickel — zéro jugement, juste un boulot précis sur mes ongles.",
    name: "Yann B.",
    role: "Renforcement transparent",
  },
  {
    q: "Les photos envoyées dans mon espace après le RDV, c'est le détail qui change tout. On repart avec un vrai souvenir.",
    name: "Inès R.",
    role: "Nail art french",
  },
  {
    q: "Tout le monde me demande où. Je ne dis rien.",
    name: "Maya T.",
    role: "Set chrome",
  },
  {
    q: "Réservé en ligne, payé l'acompte, créneau bloqué dans la foulée. C'est carré du début à la fin.",
    name: "Sami K.",
    role: "Pose semi",
  },
  {
    q: "On prend le temps, on échange. Je viens chaque mois maintenant.",
    name: "Jules D.",
    role: "Renfort + déco",
  },
];

const AUTO_MS = 6500;

export default function Testimonials() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(
    () => setIndex((i) => (i + 1) % quotes.length),
    [],
  );
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + quotes.length) % quotes.length),
    [],
  );

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, AUTO_MS);
    return () => clearInterval(id);
  }, [next, paused]);

  const q = quotes[index];

  return (
    <section
      id="echos"
      className="relative overflow-hidden border-t border-white/5 py-28 md:py-36"
    >
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[24rem] w-[24rem] rounded-full bg-pss-pink/10 blur-[140px]" />

      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <SectionLabel n="04" label="Avis" />
            <h2 className="mt-6 font-display text-5xl uppercase leading-[0.92] tracking-tight md:text-6xl">
              <span className="text-white">Ce qu'iels</span>{" "}
              <span className="chrome-pink">en disent.</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/50">
            <span className="text-pss-pink">★ ★ ★ ★ ★</span>
            <span>4,9 / 5 — 312 visites</span>
          </div>
        </div>

        <div
          className="relative mt-14"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="glass-card relative min-h-[260px] overflow-hidden rounded-3xl px-6 py-10 md:min-h-[220px] md:px-14 md:py-12">
            <AnimatePresence mode="wait">
              <motion.figure
                key={index}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
                className="grid grid-cols-1 items-center gap-6 md:grid-cols-[auto_1fr_auto] md:gap-10"
              >
                <span
                  aria-hidden
                  className="font-display text-7xl leading-none text-pss-pink/40 md:text-8xl"
                >
                  "
                </span>

                <blockquote className="font-body text-lg leading-relaxed text-white/85 md:text-2xl md:leading-snug">
                  {q.q}
                </blockquote>

                <figcaption className="flex items-center justify-between gap-6 border-t border-white/10 pt-4 md:flex-col md:items-end md:justify-center md:border-l md:border-t-0 md:pl-8 md:pt-0">
                  <div className="text-right">
                    <div className="font-display text-base uppercase text-white">
                      {q.name}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-white/45">
                      {q.role}
                    </div>
                  </div>
                  <span className="text-pss-pink">★★★★★</span>
                </figcaption>
              </motion.figure>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {quotes.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Avis ${i + 1}`}
                  className={`group h-1.5 transition-all ${
                    i === index ? "w-7" : "w-3"
                  }`}
                >
                  <span
                    className={`block h-full w-full rounded-full transition ${
                      i === index
                        ? "bg-pss-pink shadow-[0_0_10px_rgba(255,0,122,0.7)]"
                        : "bg-white/15 group-hover:bg-white/35"
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prev}
                aria-label="Précédent"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-white/80 transition hover:border-pss-pink/60 hover:text-pss-pink"
              >
                <ChevronLeft />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Suivant"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-white/80 transition hover:border-pss-pink/60 hover:text-pss-pink"
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
