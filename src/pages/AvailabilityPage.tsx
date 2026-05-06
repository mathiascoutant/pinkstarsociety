import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AvailabilityCalendar, {
  MonthHeader,
} from "../components/AvailabilityCalendar";
import {
  bookingSlot,
  getMonth,
  type MonthAvailability,
} from "../lib/availability";
import { api } from "../lib/api";

type PublicSlot = { date: string; time: string };
type PublicAvailability = {
  year: number;
  month: number;
  slots: PublicSlot[];
};

export default function AvailabilityPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthAvailability>(() =>
    getMonth(now.getFullYear(), now.getMonth() + 1),
  );

  // Charge les blocages admin (localStorage) puis merge en live les RDV
  // confirmés via l'endpoint public — ce qui rend la mise à jour automatique
  // dès qu'un acompte ou paiement total est encaissé, sans action admin.
  useEffect(() => {
    let cancelled = false;
    const local = getMonth(year, month);
    setData(local);

    (async () => {
      try {
        const r = await api<PublicAvailability>(
          `/public/availability/${year}/${month}`,
        );
        if (cancelled) return;
        const out: MonthAvailability = JSON.parse(JSON.stringify(local));
        const target = `${year}-${String(month).padStart(2, "0")}`;
        for (const s of r.slots || []) {
          if (!s.date?.startsWith(target)) continue;
          const day = parseInt(s.date.split("-")[2], 10);
          if (!Number.isFinite(day)) continue;
          const slot = bookingSlot(s.time || "00:00");
          const d = out.days.find((x) => x.day === day);
          if (d) d[slot] = "blocked";
        }
        if (!cancelled) setData(out);
      } catch {
        // backend offline → on reste sur le local
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
      {/* BG */}
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-[36rem] w-[36rem] rounded-full bg-pss-pink/15 blur-[180px]" />
      <div className="pointer-events-none absolute -right-32 -bottom-32 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/12 blur-[150px]" />

      {/* Top bar */}
      <div className="relative z-10 mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 md:px-10">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center">
            <Star />
          </span>
          <span className="font-display text-base uppercase tracking-[0.06em] text-white">
            PinkStar<span className="text-pss-pink">.</span>Society
          </span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-white/55 transition hover:text-pss-pink"
        >
          <ArrowLeft />
          Retour
        </Link>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1100px] px-5 pb-16 pt-2 md:px-10 md:pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <div className="flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.32em] text-white/55">
            <span className="font-mono text-pss-pink">/03</span>
            <span className="h-px w-10 bg-white/15" />
            <span>Disponibilités</span>
          </div>
          <h1 className="mt-4 font-display text-3xl uppercase leading-[1] tracking-[-0.02em] sm:text-5xl">
            <span className="block py-[0.06em] text-white">
              Quand <span className="text-pss-pink">est-ce</span> ?
            </span>
          </h1>
          <div className="mx-auto mt-5 flex flex-wrap items-center justify-center gap-2 sm:mt-6 sm:gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-emerald-200 sm:gap-2 sm:px-4 sm:py-2 sm:text-[12px] sm:tracking-[0.18em]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.7)] sm:h-2.5 sm:w-2.5" />
              Libre
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-red-200 sm:gap-2 sm:px-4 sm:py-2 sm:text-[12px] sm:tracking-[0.18em]">
              <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)] sm:h-2.5 sm:w-2.5" />
              Pris
            </span>
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="glass-card relative rounded-2xl p-3 sm:rounded-3xl sm:p-7 md:p-8"
        >
          <MonthHeader
            year={year}
            month={month}
            onPrev={prev}
            onNext={next}
            right={
              data.published ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Publié
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/55">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40" />À
                  venir
                </span>
              )
            }
          />

          <div className="relative mt-8">
            <div className={data.published ? "" : "pointer-events-none"}>
              <AvailabilityCalendar data={data} mode="public" />
            </div>

            {!data.published && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/40 backdrop-blur-[3px]">
                <div className="max-w-xs px-6 text-center">
                  <div className="font-display text-3xl uppercase leading-tight text-white">
                    Bientôt
                  </div>
                  <p className="mt-2 font-serif text-[15px] leading-relaxed text-white/70">
                    Les disponibilités de ce mois ne sont pas encore publiées.
                    Reviens plus tard ou écris en DM.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Booking CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7"
        >
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">
              Un créneau te plaît ?
            </div>
            <div className="mt-1 font-display text-xl uppercase leading-tight text-white sm:text-2xl">
              On commence par{" "}
              <span className="text-pss-pink">un message.</span>
            </div>
          </div>
          <a
            href="https://instagram.com/pinkstar_society"
            target="_blank"
            rel="noreferrer"
            className="btn-pink"
          >
            <InstaIcon />
            DM Instagram
          </a>
        </motion.div>
      </div>
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
