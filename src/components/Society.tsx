import { motion } from "framer-motion";

const perks = [
  {
    title: "Drops Anticipés",
    desc: "Accès 48h avant tout le monde aux pièces numérotées.",
  },
  {
    title: "Lookbook Privé",
    desc: "Photos brutes, behind the scenes, archives jamais publiques.",
  },
  {
    title: "Pieces 1/1",
    desc: "Des objets uniques, frappés à la commande, jamais ré-édités.",
  },
  {
    title: "IRL",
    desc: "Pop-ups, expos chrome, listes d'invités sans filtre.",
  },
];

export default function Society() {
  return (
    <section
      id="societe"
      className="relative overflow-hidden border-t border-white/5 py-28 md:py-40"
    >
      <div className="pointer-events-none absolute -right-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-pss-pink/15 blur-[140px]" />

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-14 px-5 md:px-10 lg:grid-cols-2">
        <div>
          <div className="pill mb-4">/ 03 — La Société</div>
          <h2 className="font-display text-5xl uppercase leading-none tracking-tight md:text-7xl">
            <span className="chrome-text">Une famille,</span>
            <br />
            <span className="chrome-pink">pas une mailing list.</span>
          </h2>
          <p className="mt-7 max-w-md text-base text-white/65">
            La PinkStar Society est un cercle restreint. Pas de spam, pas de
            promo creuse — juste des pièces, des invitations, et un canal direct
            avec le studio.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3 max-w-md">
            <Counter n="2003" l="Année 0" />
            <Counter n="04" l="Drops actifs" />
            <Counter n="11" l="Villes" />
            <Counter n="∞" l="Sparkles" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {perks.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08, duration: 0.6 }}
              className="glass-card group relative overflow-hidden rounded-3xl p-6"
              data-cursor="hover"
            >
              <div className="mb-6 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5">
                <span className="font-mono text-xs text-pss-pink">
                  0{i + 1}
                </span>
              </div>
              <h3 className="font-display text-2xl uppercase leading-tight">
                {p.title}
              </h3>
              <p className="mt-2 text-sm text-white/60">{p.desc}</p>
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-pss-pink/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Counter({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="font-display text-3xl text-white">{n}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/50">
        {l}
      </div>
    </div>
  );
}
