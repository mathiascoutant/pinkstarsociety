import { motion, useMotionValue, useTransform } from "framer-motion";
import { MouseEvent, useRef } from "react";

type Drop = {
  n: string;
  title: string;
  tag: string;
  hue: string;
  status: "ONLINE" | "SOLD OUT" | "SOON";
};

const drops: Drop[] = [
  {
    n: "001",
    title: "Chrome Tee — Liquid Star",
    tag: "Tee · 220 GSM",
    hue: "from-pss-pink/40 to-fuchsia-700/0",
    status: "ONLINE",
  },
  {
    n: "002",
    title: "Hoodie — Polished Mirror",
    tag: "Hoodie · oversize",
    hue: "from-white/30 to-pss-pink/0",
    status: "SOLD OUT",
  },
  {
    n: "003",
    title: "Cap — Star Halo",
    tag: "Cap · 5 panels",
    hue: "from-fuchsia-400/40 to-purple-700/0",
    status: "ONLINE",
  },
  {
    n: "004",
    title: "Pendant — Molten Star",
    tag: "Acier 316L · pink",
    hue: "from-pss-pink/50 to-pink-900/0",
    status: "SOON",
  },
];

export default function Drops() {
  return (
    <section
      id="drops"
      className="relative overflow-hidden border-t border-white/5 py-28 md:py-40"
    >
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-30" />

      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="pill mb-4">/ 02 — Drops</div>
            <h2 className="font-display text-5xl uppercase leading-none tracking-tight md:text-7xl">
              <span className="chrome-text">Limited.</span>{" "}
              <span className="chrome-pink">Forged.</span>
            </h2>
          </div>
          <p className="max-w-md text-sm text-white/60">
            Chaque pièce est numérotée, frappée, polie. Quand c'est terminé,
            c'est terminé.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {drops.map((d, i) => (
            <Card key={d.n} drop={d} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Card({ drop, index }: { drop: Drop; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useTransform(y, [-50, 50], [10, -10]);
  const ry = useTransform(x, [-50, 50], [-10, 10]);

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
      transition={{ delay: index * 0.08, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      className="group relative isolate overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 [transform-style:preserve-3d]"
      data-cursor="hover"
    >
      {/* halo */}
      <div
        className={`absolute inset-0 -z-10 bg-gradient-to-br ${drop.hue} opacity-60 transition-opacity duration-500 group-hover:opacity-100`}
      />
      <div className="absolute inset-0 -z-10 grid-noise opacity-40" />

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-white/60">#{drop.n}</span>
        <Status status={drop.status} />
      </div>

      <div className="relative my-6 grid h-56 place-items-center overflow-hidden rounded-2xl bg-black/40">
        <ChromeStarMini />
        <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-white/15" />
        <span className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          PSS · CHROME
        </span>
        <span className="absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          {drop.tag}
        </span>
      </div>

      <h3 className="font-display text-2xl uppercase leading-tight text-white">
        {drop.title}
      </h3>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm text-white/60">€ — sur demande</span>
        <span className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 transition group-hover:bg-pss-pink group-hover:text-black">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12h14M13 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </motion.div>
  );
}

function Status({ status }: { status: Drop["status"] }) {
  const map = {
    ONLINE: "bg-pss-pink/20 text-pss-pink border-pss-pink/40",
    "SOLD OUT": "bg-white/5 text-white/40 border-white/10",
    SOON: "bg-white/5 text-white/80 border-white/15",
  } as const;
  return (
    <span
      className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${map[status]}`}
    >
      {status}
    </span>
  );
}

function ChromeStarMini() {
  return (
    <svg viewBox="0 0 200 200" className="h-44 w-44 drop-shadow-[0_0_30px_rgba(255,0,122,0.45)]">
      <defs>
        <linearGradient id="ms" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe6f2" />
          <stop offset="0.45" stopColor="#ff007a" />
          <stop offset="0.55" stopColor="#5a0028" />
          <stop offset="1" stopColor="#ff7ad1" />
        </linearGradient>
        <radialGradient id="ms2" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform="translate(100,100)">
        <polygon
          fill="url(#ms)"
          stroke="#0c0010"
          strokeWidth="6"
          strokeLinejoin="round"
          points="0,-78 22,-26 78,-26 33,5 50,60 0,30 -50,60 -33,5 -78,-26 -22,-26"
        />
        <polygon
          fill="url(#ms2)"
          points="0,-78 22,-26 78,-26 33,5 50,60 0,30 -50,60 -33,5 -78,-26 -22,-26"
          opacity="0.7"
        />
      </g>
    </svg>
  );
}
