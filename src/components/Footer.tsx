export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/5 bg-black">
      {/* top accent line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pss-pink/60 to-transparent" />
      {/* soft pink halo */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pss-pink/10 blur-[160px]" />

      <div className="relative mx-auto max-w-[1400px] px-5 py-16 md:px-10 md:py-20">
        {/* CENTERED WORDMARK */}
        <div className="pt-2 text-center">
          <h2 className="font-display uppercase leading-[0.92] tracking-[-0.02em] chrome-text sm:tracking-tight">
            <span className="block text-[19vw] sm:hidden">PinkStar</span>
            <span className="block text-[19vw] sm:hidden">Society</span>
            <span className="hidden whitespace-nowrap sm:block sm:text-[12vw] md:text-[10vw] lg:text-[8.6vw]">
              PinkStarSociety
            </span>
          </h2>
        </div>

        {/* tagline + decorative line */}
        <div className="mx-auto mt-8 flex max-w-md items-center gap-4">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-pss-pink/80">
            ★ Bordeaux ★
          </span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
        </div>

        {/* CENTERED COLUMNS */}
        <div className="mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-10 text-center sm:grid-cols-2 sm:gap-16">
          <Col title="Cliquez ici">
            <li>
              <a
                className="inline-flex min-w-[170px] items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:border-pss-pink/60 hover:bg-pss-pink/20"
                href="https://instagram.com/pinkstar_society"
                target="_blank"
                rel="noreferrer"
              >
                Instagram
              </a>
            </li>
            <li>
              <a
                className="inline-flex min-w-[170px] items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:border-pss-pink/60 hover:bg-pss-pink/20"
                href="mailto:contact@pinkstarsociety.fr"
              >
                Mail
              </a>
            </li>
          </Col>

          <Col title="Légal">
            <li>
              <a className="hover:text-white" href="#">
                Mentions légales
              </a>
            </li>
            <li>
              <a className="hover:text-white" href="#">
                CGV
              </a>
            </li>
            <li>
              <a className="hover:text-white" href="#">
                Confidentialité
              </a>
            </li>
          </Col>
        </div>

        {/* BOTTOM */}
        <div className="mx-auto mt-14 max-w-md border-t border-white/5 pt-6 text-center text-[11px] text-white/40">
          © {new Date().getFullYear()} Pink Star Society — Tous droits
          réservés.
        </div>
      </div>
    </footer>
  );
}

function Col({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 text-[10px] uppercase tracking-[0.32em] text-white/40">
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-pss-pink/80" />
          {title}
        </span>
      </div>
      <ul className="space-y-2 text-sm text-white/70">{children}</ul>
    </div>
  );
}
