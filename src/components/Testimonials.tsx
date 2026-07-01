const GOOGLE_REVIEWS_URL =
  "https://www.google.com/search?q=PINKSTARSOCIETY+Avis&tbm=lcl&hl=fr-FR#lkt=LocalPoiReviews&rlfi=hd:;si:5693739190603809137,l,ChRQSU5LU1RBUlNPQ0lFVFkgQXZpcyICOAGSAQxiZWF1dHlfc2Fsb24;mv:[[44.85550087731902,-0.5697356139189154],[44.85514092268096,-0.5702433860810845]]";

export default function Testimonials() {
  return (
    <section
      id="echos"
      className="relative overflow-hidden border-t border-white/5 py-28 md:py-36"
    >
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[24rem] w-[24rem] rounded-full bg-pss-pink/10 blur-[140px]" />

      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="max-w-2xl">
          <SectionLabel n="04" label="Avis" />
          <h2 className="mt-6 font-display text-5xl uppercase leading-[0.92] tracking-tight md:text-6xl">
            <span className="text-white">Ce qu'</span>
            <span className="chrome-pink">iels</span>
            <span className="text-white"> en disent</span>
          </h2>
        </div>

        <div className="glass-card mt-14 flex flex-col items-start gap-8 rounded-3xl px-6 py-10 md:flex-row md:items-center md:justify-between md:px-14 md:py-12">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-pss-pink">
              <span className="text-2xl tracking-[0.2em]">★ ★ ★ ★ ★</span>
            </div>
            <p className="mt-4 font-body text-lg leading-relaxed text-white/70 md:text-xl">
              Nos clients partagent leur expérience sur Google. Découvre leurs
              avis directement sur notre fiche.
            </p>
          </div>

          <a
            href={GOOGLE_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-chrome shrink-0"
          >
            Voir nos avis
          </a>
        </div>
      </div>
    </section>
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
