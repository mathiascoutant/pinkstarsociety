import { motion } from "framer-motion";

const steps = [
  {
    n: "01",
    title: "DM Instagram ou email",
    desc: "Vous m'envoyez votre inspiration et vos disponibilités — on cale la date et on fixe un prix ensemble par message.",
    icon: "message" as const,
  },
  {
    n: "02",
    title: "Acompte ou paiement total",
    desc: "",
    icon: "card" as const,
  },
  {
    n: "03",
    title: "Rendez-vous",
    desc: "",
    icon: "clock" as const,
  },
  {
    n: "04",
    title: "Galerie privée",
    desc: "",
    icon: "camera" as const,
  },
];

export default function Process() {
  return (
    <section
      id="process"
      className="relative overflow-hidden border-t border-white/5 py-28 md:py-36"
    >
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />
      <div className="pointer-events-none absolute -left-32 top-1/2 h-[26rem] w-[26rem] -translate-y-1/2 rounded-full bg-pss-pink/10 blur-[140px]" />

      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <SectionLabel n="02" label="Comment ça se passe" />
            <h2 className="mt-6 font-display text-5xl uppercase leading-[0.92] tracking-tight md:text-6xl">
              <span className="chrome-pink">Avoir un créneau</span>
            </h2>
          </div>
        </div>

        <div className="relative mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          <div className="pointer-events-none absolute left-0 right-0 top-[34px] hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent lg:block" />

          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="group relative"
            >
              <div className="relative z-10 grid h-[68px] w-[68px] place-items-center rounded-full border border-white/15 bg-pss-ink shadow-[0_0_0_4px_#050507] transition group-hover:border-pss-pink/60">
                <Icon name={s.icon} />
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-pss-ink px-2 py-0.5 font-mono text-[10px] text-white/70">
                  {s.n}
                </span>
              </div>

              <h3 className="mt-6 font-display text-2xl uppercase leading-tight text-white">
                {s.title}
              </h3>
              {s.desc ? (
                <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                  {s.desc}
                </p>
              ) : null}
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}

function Icon({
  name,
}: {
  name: "message" | "card" | "clock" | "camera";
}) {
  const stroke = "white";
  const sw = 1.7;
  switch (name) {
    case "message":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5V14a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5v-3.5H6.5A2.5 2.5 0 0 1 4 14V6.5Z"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <circle cx="9" cy="10" r="1" fill={stroke} />
          <circle cx="12" cy="10" r="1" fill={stroke} />
          <circle cx="15" cy="10" r="1" fill="#ff007a" />
        </svg>
      );
    case "card":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect
            x="3"
            y="6"
            width="18"
            height="13"
            rx="2.5"
            stroke={stroke}
            strokeWidth={sw}
          />
          <path d="M3 10.5h18" stroke={stroke} strokeWidth={sw} />
          <path
            d="M7 15.2h3"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </svg>
      );
    case "clock":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8.5" stroke={stroke} strokeWidth={sw} />
          <path
            d="M12 7.5v5l3 2"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "camera":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 8.5h2.5l1.4-2h6.2l1.4 2H19a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z"
            stroke={stroke}
            strokeWidth={sw}
          />
          <circle cx="12" cy="13.5" r="3.6" stroke={stroke} strokeWidth={sw} />
        </svg>
      );
  }
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
