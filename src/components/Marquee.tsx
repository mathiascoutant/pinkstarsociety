export default function Marquee() {
  const items = [
    "PINK STAR SOCIETY",
    "★",
    "Y2K CHROME",
    "★",
    "DROP 01 — ONLINE",
    "★",
    "FORGED IN PINK",
    "★",
    "LIMITED EDITION",
    "★",
    "MADE IN EU",
    "★",
  ];

  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent py-5">
      <div className="flex w-max animate-marquee gap-8 will-change-transform">
        {[...items, ...items, ...items, ...items].map((t, i) => (
          <span
            key={i}
            className={`whitespace-nowrap font-display text-3xl uppercase tracking-[0.08em] md:text-5xl ${
              t === "★" ? "text-pss-pink" : "chrome-text"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
