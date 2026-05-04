import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

type Shot = {
  id: string;
  caption: string;
  tag: string;
  span?: "wide" | "tall" | "normal";
  hue: string;
};

const shots: Shot[] = [
  {
    id: "001",
    caption: "Pose gel · finition glossy",
    tag: "Léa",
    span: "tall",
    hue: "from-pss-pink/45 via-fuchsia-700/20 to-black",
  },
  {
    id: "002",
    caption: "Nail art french · noir / rose",
    tag: "Inès",
    hue: "from-fuchsia-500/35 via-pss-pink/15 to-black",
  },
  {
    id: "003",
    caption: "Renforcement gel · transparent",
    tag: "Yann",
    hue: "from-zinc-400/25 via-fuchsia-700/10 to-black",
  },
  {
    id: "004",
    caption: "Set chrome · short carré",
    tag: "Maya",
    span: "wide",
    hue: "from-pss-pink/30 via-pink-900/30 to-black",
  },
  {
    id: "005",
    caption: "Pose semi · couleur unique",
    tag: "Sami",
    hue: "from-rose-400/30 via-fuchsia-700/15 to-black",
  },
  {
    id: "006",
    caption: "Renfort + déco mini cœurs",
    tag: "Jules",
    hue: "from-pss-pink/40 via-pink-700/20 to-black",
  },
];

export default function Gallery() {
  return (
    <section
      id="galerie"
      className="relative overflow-hidden border-t border-white/5 py-28 md:py-36"
    >
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />

      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <SectionLabel n="03" label="Galerie" />
            <h2 className="mt-6 font-display text-5xl uppercase leading-[0.92] tracking-tight md:text-6xl">
              <span className="chrome-text">Photos prises</span>{" "}
              <span className="chrome-pink">au studio.</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm text-white/55">
            Chaque rendez-vous se termine par un shoot des ongles. Les photos
            te sont envoyées en DM, archives partagées ici (avec accord).
          </p>
        </div>

        <div className="mt-14 grid auto-rows-[220px] grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 lg:auto-rows-[260px]">
          {shots.map((s, i) => (
            <Cell key={s.id} shot={s} index={i} />
          ))}
        </div>

        <div className="mt-10 text-center text-xs text-white/40">
          ✦ Les photos sont publiées avec l'accord des clients · @pinkstar_society sur Instagram
        </div>
      </div>
    </section>
  );
}

function Cell({ shot, index }: { shot: Shot; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [20, -20]);

  const span =
    shot.span === "wide"
      ? "md:col-span-2"
      : shot.span === "tall"
        ? "row-span-2"
        : "";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: index * 0.06, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      className={`group relative isolate overflow-hidden rounded-2xl border border-white/10 ${span}`}
      data-cursor="hover"
    >
      <div
        className={`absolute inset-0 -z-10 bg-gradient-to-br ${shot.hue}`}
      />
      <div className="absolute inset-0 -z-10 grid-noise opacity-40" />

      <motion.div
        style={{ y }}
        className="relative grid h-full w-full place-items-center"
      >
        <Placeholder />
      </motion.div>

      {/* Hover overlay */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em]">
          <span className="text-white/85">{shot.caption}</span>
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-white/70">
            #{shot.id}
          </span>
        </div>
        <div className="mt-1 font-display text-xl text-white">@{shot.tag}</div>
      </div>

      <span className="absolute left-3 top-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
        PSS · {shot.id}
      </span>
    </motion.div>
  );
}

function Placeholder() {
  return (
    <svg viewBox="0 0 200 200" className="h-2/3 w-2/3 max-w-[150px] opacity-90">
      <defs>
        <linearGradient id="ph" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe6f4" />
          <stop offset="0.5" stopColor="#ff007a" />
          <stop offset="1" stopColor="#5a0028" />
        </linearGradient>
      </defs>
      {/* Two "nails" — ellipses to suggest shape */}
      <g transform="translate(60 100)">
        <ellipse rx="22" ry="46" fill="url(#ph)" stroke="#0c0010" strokeWidth="3" />
      </g>
      <g transform="translate(110 90)">
        <ellipse rx="22" ry="50" fill="url(#ph)" stroke="#0c0010" strokeWidth="3" />
      </g>
      <g transform="translate(155 105)">
        <ellipse rx="20" ry="40" fill="url(#ph)" stroke="#0c0010" strokeWidth="3" />
      </g>
      <g fill="#ffffff" opacity="0.7">
        <circle cx="60" cy="80" r="3" />
        <circle cx="110" cy="64" r="3" />
        <circle cx="155" cy="80" r="2.5" />
      </g>
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
