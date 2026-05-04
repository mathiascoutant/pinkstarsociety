export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/5 bg-black">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pss-pink/60 to-transparent" />

      <div className="relative mx-auto max-w-[1400px] px-5 py-16 md:px-10">
        {/* Giant wordmark */}
        <div className="overflow-hidden">
          <h2
            className="font-display text-[20vw] leading-[0.85] uppercase tracking-tight chrome-text"
            style={{ fontStretch: "100%" }}
          >
            PinkStarSociety
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 md:max-w-xl md:gap-12">
          <Col title="Lien">
            <li>
              <a
                className="hover:text-white"
                href="https://instagram.com/pinkstar_society"
                target="_blank"
                rel="noreferrer"
              >
                Instagram
              </a>
            </li>
            <li>
              <a
                className="hover:text-white"
                href="mailto:contact@pinkstarsociety.fr"
              >
                contact@pinkstarsociety.fr
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

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-6 text-xs text-white/40">
          <span>© {new Date().getFullYear()} Pink Star Society — All chrome reserved.</span>
          <span className="font-mono">★ Forged in pink ★</span>
        </div>
      </div>
    </footer>
  );
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4 text-[11px] uppercase tracking-[0.2em] text-white/40">
        {title}
      </div>
      <ul className="space-y-2 text-sm text-white/70">{children}</ul>
    </div>
  );
}
