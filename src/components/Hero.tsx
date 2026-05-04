import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const INSTA_URL = "https://instagram.com/pinkstar_society";

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const yCopy = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const yArt = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative min-h-[100svh] w-full overflow-hidden pt-32 md:pt-40"
    >
      <BackgroundFX />

      <div className="relative z-10 mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-10 px-5 pb-24 sm:px-7 md:px-10 lg:grid-cols-12 lg:gap-12">
        <motion.div
          style={{ y: yCopy, opacity }}
          className="relative lg:col-span-7"
        >
          <Eyebrow />

          <h1 className="font-display uppercase leading-[0.86] tracking-tight">
            <Reveal delay={0.05}>
              <span className="block text-[12vw] text-white md:text-[7.4vw] lg:text-[7.8rem] [text-shadow:0_4px_30px_rgba(255,0,122,0.18)]">
                Pink Star
              </span>
            </Reveal>
            <Reveal delay={0.18}>
              <span className="block text-[12vw] chrome-pink md:text-[7.4vw] lg:text-[7.8rem]">
                Society.
              </span>
            </Reveal>
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/65"
          >
            <span className="h-px w-8 bg-pss-pink" />
            <span>Nail art sur-mesure</span>
            <span className="text-white/25">·</span>
            <span>Bordeaux</span>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7 }}
            className="mt-8 max-w-[36rem] font-body text-[15px] leading-relaxed text-white/70 md:text-[17px]"
          >
            Pose gel, dépose, créations à la main. Chaque set se construit à
            partir d'une inspiration partagée, et chaque séance se termine par
            un shoot — archivé dans votre espace personnel.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <a
              href={INSTA_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-pink"
            >
              <InstaIcon />
              Prendre rendez-vous
            </a>
            <a href="#process" className="btn-chrome">
              Comment ça marche
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="mt-14 grid max-w-md grid-cols-3 gap-x-6 gap-y-1 border-t border-white/10 pt-6"
          >
            <Meta k="Lieu" v="Bordeaux" />
            <Meta k="Format" v="Sur rendez-vous" />
            <Meta k="Photos" v="Espace privé" />
          </motion.div>
        </motion.div>

        <motion.div
          style={{ y: yArt }}
          className="relative h-[440px] w-full lg:col-span-5 lg:h-[600px]"
        >
          <Composition />
        </motion.div>
      </div>

      <ScrollCue />
    </section>
  );
}

function Eyebrow() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className="mb-8 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/55"
    >
      <span className="grid h-1.5 w-1.5 place-items-center rounded-full bg-pss-pink shadow-[0_0_10px_rgba(255,0,122,0.8)]" />
      <span className="text-white/85">Édition 01</span>
      <span className="text-white/25">/</span>
      <span>Réservations ouvertes</span>
    </motion.div>
  );
}

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <span className="block overflow-hidden">
      <motion.span
        initial={{ y: "112%" }}
        animate={{ y: "0%" }}
        transition={{ delay, duration: 0.95, ease: [0.2, 0.85, 0.2, 1] }}
        className="block will-change-transform"
      >
        {children}
      </motion.span>
    </span>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">
        {k}
      </div>
      <div className="mt-1 font-body text-sm text-white/85">{v}</div>
    </div>
  );
}

function BackgroundFX() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />
      <motion.div
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -left-32 top-1/4 h-[40rem] w-[40rem] rounded-full bg-pss-pink/22 blur-[180px]"
      />
      <div className="pointer-events-none absolute -right-32 -bottom-32 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/12 blur-[150px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-pss-ink to-transparent" />
    </>
  );
}

function Composition() {
  return (
    <div className="relative h-full w-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        className="absolute inset-0 grid place-items-center"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <StarMark />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05, duration: 0.7 }}
        className="glass-card absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-5 py-2.5"
      >
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-white/75">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pss-pink shadow-[0_0_10px_rgba(255,0,122,0.8)]" />
          <span>Carnet de RDV en ligne</span>
        </div>
      </motion.div>

      <Sparkles />
    </div>
  );
}

function StarMark() {
  return (
    <svg
      viewBox="0 0 320 320"
      className="h-72 w-72 drop-shadow-[0_0_60px_rgba(255,0,122,0.35)] md:h-[24rem] md:w-[24rem]"
    >
      <defs>
        <linearGradient id="hp" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe6f4" />
          <stop offset="0.42" stopColor="#ff007a" />
          <stop offset="0.6" stopColor="#5a0028" />
          <stop offset="1" stopColor="#ff7ad1" />
        </linearGradient>
        <radialGradient id="hp-shine" cx="50%" cy="32%" r="55%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ring" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ff7ad1" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ff007a" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      <ellipse
        cx="160"
        cy="170"
        rx="142"
        ry="38"
        transform="rotate(-18 160 170)"
        fill="none"
        stroke="url(#ring)"
        strokeWidth="1.4"
        opacity="0.85"
      />

      <g transform="translate(160 160)">
        <polygon
          fill="url(#hp)"
          stroke="#1a0010"
          strokeWidth="9"
          strokeLinejoin="round"
          points="0,-128 36,-42 128,-42 54,8 82,98 0,48 -82,98 -54,8 -128,-42 -36,-42"
        />
        <polygon
          fill="url(#hp-shine)"
          opacity="0.85"
          points="0,-128 36,-42 128,-42 54,8 82,98 0,48 -82,98 -54,8 -128,-42 -36,-42"
        />
      </g>

      <g fill="#ff7ad1" opacity="0.9">
        <path d="M280 96 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3z" />
        <path d="M48 224 l2.5 7 7 2.5 -7 2.5 -2.5 7 -2.5 -7 -7 -2.5 7 -2.5z" />
      </g>
    </svg>
  );
}

function Sparkles() {
  const items = Array.from({ length: 6 });
  return (
    <div className="pointer-events-none absolute inset-0">
      {items.map((_, i) => {
        const top = `${Math.random() * 80 + 10}%`;
        const left = `${Math.random() * 90 + 5}%`;
        const size = 5 + Math.random() * 8;
        const delay = Math.random() * 2;
        return (
          <span
            key={i}
            className="sparkle"
            style={{
              top,
              left,
              width: size,
              height: size,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function ScrollCue() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
      <div className="flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-white/45">
        <span>Faire défiler</span>
        <motion.span
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="block h-7 w-px bg-gradient-to-b from-pss-pink to-transparent"
        />
      </div>
    </div>
  );
}

function InstaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

