import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function Intro() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "end 40%"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section
      id="apropos"
      ref={ref}
      className="relative overflow-hidden border-t border-white/5 py-28 md:py-40"
    >
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-pss-pink/10 blur-[140px]" />

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-5 md:px-10 lg:grid-cols-12 lg:gap-16">
        <motion.div style={{ y }} className="lg:col-span-7">
          <SectionLabel n="01" label="L'idée" />
          <h2 className="mt-6 font-display text-5xl uppercase leading-[0.9] tracking-tight md:text-7xl">
            <Reveal>
              <span className="block chrome-pink">Une main posée,</span>
            </Reveal>
            <Reveal delay={0.1}>
              <span className="block text-white">une présence.</span>
            </Reveal>
          </h2>

          <div className="mt-10 max-w-xl space-y-5 font-serif text-[16px] leading-relaxed text-white/75 md:text-[18px]">
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              PinkStar Society, c'est un espace de création nail art à
              Bordeaux, sur rendez-vous. Pose gel, dépose, créations à la
              main : chaque set est conçu à partir d'une inspiration
              partagée — pas de carte figée, on adapte.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.6 }}
            >
              Avant de partir, vos ongles sont photographiés. Les images vous
              attendent dans votre{" "}
              <span className="text-white">espace personnel</span>, séance
              après séance.
            </motion.p>
          </div>
        </motion.div>

        <div className="lg:col-span-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Pill
              k="Sur-mesure"
              v="Pas de carte figée — on construit avec votre inspiration."
              tone="pink"
            />
            <Pill
              k="Soin inclus"
              v="Préparation, hygiène, finition glossy ou mat."
            />
            <Pill
              k="Rendez-vous calibrés"
              v="Le temps qu'il faut, sans rendez-vous superposés."
            />
            <Pill
              k="Galerie privée"
              v="Photos après chaque séance, archivées dans votre espace personnel."
              tone="pink"
            />
          </div>
        </div>
      </div>
    </section>
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
        initial={{ y: "110%" }}
        whileInView={{ y: "0%" }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay, duration: 0.85, ease: [0.2, 0.85, 0.2, 1] }}
        className="block will-change-transform"
      >
        {children}
      </motion.span>
    </span>
  );
}

function Pill({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: "pink";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6 }}
      className={`flex items-start gap-4 rounded-2xl border p-4 transition hover:bg-white/[0.04] md:p-5 ${
        tone === "pink"
          ? "border-pss-pink/30 bg-pss-pink/[0.06]"
          : "border-white/10 bg-white/[0.025]"
      }`}
    >
      <span
        className={`mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
          tone === "pink"
            ? "border-pss-pink/50 bg-pss-pink/15 text-pss-pink"
            : "border-white/15 bg-white/5 text-white/70"
        }`}
      >
        ✦
      </span>
      <div>
        <div className="font-display text-base uppercase text-white">{k}</div>
        <div className="mt-1 text-[13px] text-white/55">{v}</div>
      </div>
    </motion.div>
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
