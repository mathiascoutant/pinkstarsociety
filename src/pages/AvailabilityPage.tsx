import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AvailabilityCalendar, {
  MonthHeader,
} from "../components/AvailabilityCalendar";
import {
  defaultMonth,
  fetchPublicMonth,
  type MonthAvailability,
} from "../lib/availability";

const INSTA_URL = "https://instagram.com/pinkstar_society";

export default function AvailabilityPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthAvailability>(() =>
    defaultMonth(now.getFullYear(), now.getMonth() + 1),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(defaultMonth(year, month));

    (async () => {
      try {
        const monthData = await fetchPublicMonth(year, month);
        if (!cancelled) setData(monthData);
      } catch {
        if (!cancelled) setData(defaultMonth(year, month));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [year, month]);

  function prev() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }
  function next() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507] text-white">
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 grid-noise opacity-[0.18]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(244,63,155,0.18),transparent_55%)]" />
        <div className="absolute -left-40 top-[30%] h-[28rem] w-[28rem] rounded-full bg-pss-pink/[0.07] blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-[22rem] w-[22rem] rounded-full bg-white/[0.03] blur-[100px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050507] to-transparent" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-[1200px] items-center justify-between px-5 py-5 md:px-10">
        <Link to="/" className="group flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center transition group-hover:scale-105">
            <Star />
          </span>
          <span className="font-display text-base uppercase tracking-[0.06em] text-white">
            PinkStar<span className="text-pss-pink">.</span>Society
          </span>
        </Link>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 text-[11px] uppercase tracking-[0.2em] text-white/60 transition hover:border-pss-pink/40 hover:text-pss-pink"
        >
          <ArrowLeft />
          Accueil
        </Link>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1000px] px-5 pb-20 pt-4 md:px-10 md:pt-10">
        {/* Intro */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 text-center md:mb-14"
        >
          <div className="flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.34em] text-white/50">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-pss-pink/70" />
            <span>Agenda</span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-pss-pink/70" />
          </div>

          <h1 className="mt-5 font-display text-[2.6rem] uppercase leading-[0.95] tracking-[-0.03em] sm:text-5xl md:text-6xl">
            <span className="block text-white">Quand</span>
            <span className="block text-pss-pink">est-ce ?</span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="mx-auto mt-5 max-w-md font-serif text-[16px] leading-relaxed text-white/60 md:text-[17px]"
          >
            Choisis un jour, regarde les créneaux libres, puis écris-moi pour
            réserver le tien.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.55 }}
            className="mx-auto mt-4 max-w-sm text-[12px] leading-relaxed text-white/45"
          >
            Le samedi est possible avec une{" "}
            <span className="text-pss-pink/90">majoration de 10&nbsp;€</span>.
          </motion.p>
        </motion.div>

        {/* Calendar */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.055] to-white/[0.015] p-4 shadow-[0_30px_80px_-40px_rgba(244,63,155,0.35)] sm:rounded-[2rem] sm:p-7 md:p-9"
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-pss-pink/40 to-transparent" />

          <MonthHeader
            year={year}
            month={month}
            onPrev={prev}
            onNext={next}
            right={
              data.published ? undefined : (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/45">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                  Bientôt
                </span>
              )
            }
          />

          <div className="relative mt-7 sm:mt-9">
            <div className={data.published ? "" : "pointer-events-none select-none"}>
              <AvailabilityCalendar data={data} mode="public" />
            </div>

            {(!data.published || loading) && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-[#050507]/55 backdrop-blur-[4px]">
                <div className="max-w-xs px-6 text-center">
                  <div className="font-display text-3xl uppercase leading-tight tracking-tight text-white">
                    {loading ? "Chargement…" : "Bientôt"}
                  </div>
                  {!loading && (
                    <p className="mt-3 font-serif text-[15px] leading-relaxed text-white/65">
                      Les disponibilités de ce mois ne sont pas encore
                      publiées. Reviens plus tard ou écris en DM.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.65 }}
          className="relative mt-8 overflow-hidden rounded-[1.75rem] border border-pss-pink/25 bg-gradient-to-br from-pss-pink/[0.12] via-white/[0.03] to-transparent p-6 sm:mt-10 sm:rounded-[2rem] sm:p-8"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-pss-pink/20 blur-[70px]" />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-pss-pink/80">
                Réservation
              </p>
              <h2 className="mt-2 font-display text-2xl uppercase leading-[1.05] tracking-tight text-white sm:text-3xl">
                Un créneau te plaît ?
              </h2>
              <p className="mt-2 max-w-sm font-serif text-[15px] leading-relaxed text-white/60">
                Envoie-moi un message — on valide ensemble la date et le set.
              </p>
            </div>
            <a
              href={INSTA_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-pink w-full justify-center sm:w-auto"
            >
              <InstaIcon />
              DM Instagram
            </a>
          </div>
        </motion.section>
      </main>
    </div>
  );
}

function Star() {
  return (
    <svg viewBox="0 0 100 100" className="h-6 w-6">
      <defs>
        <linearGradient id="dispo-star" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffd4ee" />
          <stop offset="0.5" stopColor="#f43f9b" />
          <stop offset="1" stopColor="#d61e7c" />
        </linearGradient>
      </defs>
      <polygon
        fill="url(#dispo-star)"
        stroke="#0c0010"
        strokeWidth="4"
        strokeLinejoin="round"
        points="50,5 61,38 96,38 67,58 78,92 50,72 22,92 33,58 4,38 39,38"
      />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M19 12H5M11 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
