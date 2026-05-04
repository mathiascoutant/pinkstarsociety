import { motion, useMotionValue, useTransform } from "framer-motion";
import { MouseEvent, useRef } from "react";

type Service = {
  n: string;
  title: string;
  cat: string;
  duration: string;
  from: string;
  hue: string;
};

const services: Service[] = [
  {
    n: "01",
    title: "Set Chrome — Étoile Liquide",
    cat: "Pose complète",
    duration: "1 h 45",
    from: "à partir de 75 €",
    hue: "from-pss-pink/40 to-fuchsia-700/0",
  },
  {
    n: "02",
    title: "Finition Miroir — Pink",
    cat: "Remplissage",
    duration: "1 h 15",
    from: "à partir de 55 €",
    hue: "from-white/30 to-pss-pink/0",
  },
  {
    n: "03",
    title: "Halo Society",
    cat: "Nail art signature",
    duration: "2 h 00",
    from: "à partir de 95 €",
    hue: "from-fuchsia-400/40 to-purple-700/0",
  },
  {
    n: "04",
    title: "Polish Express",
    cat: "Retouche éclat",
    duration: "45 min",
    from: "à partir de 35 €",
    hue: "from-pss-pink/50 to-pink-900/0",
  },
];

export default function Services() {
  return (
    <section
      id="services"
      className="relative overflow-hidden border-t border-white/5 py-28 md:py-40"
    >
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />

      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <Header />

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {services.map((s, i) => (
            <Card key={s.n} svc={s} index={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.025] p-6 md:p-8"
        >
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
              Sur mesure
            </div>
            <div className="mt-1 font-display text-2xl uppercase text-white md:text-3xl">
              Pas trouvé ton drop ?{" "}
              <span className="chrome-pink">On compose pour toi.</span>
            </div>
          </div>
          <a href="#contact" className="btn-chrome">
            Demander un devis
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl">
        <SectionLabel n="01" label="Prestations" />
        <h2 className="mt-6 font-display text-5xl uppercase leading-[0.92] tracking-tight md:text-7xl">
          <span className="chrome-text">Quatre pièces.</span>{" "}
          <span className="chrome-pink">Aucune répétition.</span>
        </h2>
      </div>
      <p className="max-w-sm text-sm text-white/55">
        Chaque prestation est numérotée, frappée, polie. Le studio garde la
        main, jamais la machine.
      </p>
    </div>
  );
}

function Card({ svc, index }: { svc: Service; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useTransform(y, [-50, 50], [6, -6]);
  const ry = useTransform(x, [-50, 50], [-6, 6]);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    x.set(e.clientX - r.left - r.width / 2);
    y.set(e.clientY - r.top - r.height / 2);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        delay: index * 0.07,
        duration: 0.7,
        ease: [0.2, 0.8, 0.2, 1],
      }}
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100 }}
      className="group relative isolate flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 [transform-style:preserve-3d]"
      data-cursor="hover"
    >
      <div
        className={`absolute inset-0 -z-10 bg-gradient-to-br ${svc.hue} opacity-50 transition-opacity duration-500 group-hover:opacity-95`}
      />
      <div className="absolute inset-0 -z-10 grid-noise opacity-30" />

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-white/50">/{svc.n}</span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/65">
          {svc.cat}
        </span>
      </div>

      <Visual />

      <h3 className="font-display text-xl uppercase leading-tight text-white md:text-2xl">
        {svc.title}
      </h3>

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[12px] text-white/60">
        <span>⌖ {svc.duration}</span>
        <span className="text-white/85">{svc.from}</span>
      </div>

      <a
        href="#contact"
        className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[12px] uppercase tracking-[0.18em] text-white/80 transition group-hover:border-pss-pink/60 group-hover:bg-pss-pink/10 group-hover:text-white"
      >
        Réserver ce drop
        <span className="grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-white/[0.04] transition group-hover:bg-pss-pink group-hover:text-black">
          <Arrow />
        </span>
      </a>
    </motion.div>
  );
}

function Visual() {
  return (
    <div className="relative my-5 grid h-44 place-items-center overflow-hidden rounded-2xl bg-black/45">
      <svg viewBox="0 0 200 200" className="h-36 w-36">
        <defs>
          <linearGradient id="sv" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ffe6f2" />
            <stop offset="0.45" stopColor="#ff007a" />
            <stop offset="0.6" stopColor="#5a0028" />
            <stop offset="1" stopColor="#ff7ad1" />
          </linearGradient>
        </defs>
        <g transform="translate(100,100)">
          <polygon
            fill="url(#sv)"
            stroke="#0c0010"
            strokeWidth="6"
            strokeLinejoin="round"
            points="0,-78 22,-26 78,-26 33,5 50,60 0,30 -50,60 -33,5 -78,-26 -22,-26"
          />
        </g>
      </svg>
      <span className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        PSS · Chrome
      </span>
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

function Arrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12h14M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
