import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AvailabilityCalendar, {
  MonthHeader,
} from "../components/AvailabilityCalendar";
import {
  defaultMonth,
  fetchAdminMonth,
  mergeBookings,
  migrateLegacyAvailabilityIfNeeded,
  publishMonth,
  saveAdminMonth,
  setDayBothPure,
  toggleSlotPure,
  unpublishMonth,
  type BookingLite,
  type MonthAvailability,
} from "../lib/availability";
import { api } from "../lib/api";

export default function AdminAvailabilityPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [baseData, setBaseData] = useState<MonthAvailability>(() =>
    defaultMonth(now.getFullYear(), now.getMonth() + 1),
  );
  const [confirmedBookings, setConfirmedBookings] = useState<BookingLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [syncCount, setSyncCount] = useState<number | null>(null);

  const data = useMemo(
    () => mergeBookings(baseData, confirmedBookings),
    [baseData, confirmedBookings],
  );

  useEffect(() => {
    void migrateLegacyAvailabilityIfNeeded();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSyncCount(null);

    (async () => {
      try {
        const monthData = await fetchAdminMonth(year, month);
        if (cancelled) return;

        const r = await api<{ bookings: BookingLite[] }>("/admin/bookings");
        if (cancelled) return;

        const target = `${year}-${String(month).padStart(2, "0")}`;
        const monthBookings = (r.bookings || []).filter(
          (b) =>
            b.date?.startsWith(target) &&
            (b.paymentStatus === "deposit_paid" || b.paymentStatus === "paid"),
        );
        setBaseData(monthData);
        setConfirmedBookings(monthBookings);
        setSyncCount(monthBookings.length);
      } catch {
        if (!cancelled) {
          setBaseData(defaultMonth(year, month));
          setConfirmedBookings([]);
          setSyncCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const stats = useMemo(() => {
    const total = data.days.length * 2;
    const open = data.days.reduce(
      (n, d) =>
        n + (d.morning === "open" ? 1 : 0) + (d.afternoon === "open" ? 1 : 0),
      0,
    );
    return { total, open, blocked: total - open };
  }, [data]);

  function prev() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function next() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  async function persistBase(next: MonthAvailability) {
    const saved = await saveAdminMonth(next);
    setBaseData(saved);
    return saved;
  }

  async function handleToggle(day: number, slot: "morning" | "afternoon") {
    try {
      await persistBase(toggleSlotPure(baseData, day, slot));
    } catch {
      setFlash("Sauvegarde échouée");
      setTimeout(() => setFlash(null), 2400);
    }
  }

  async function handleToggleDay(day: number) {
    const d = baseData.days.find((x) => x.day === day);
    if (!d) return;
    const allOpen = d.morning === "open" && d.afternoon === "open";
    try {
      await persistBase(setDayBothPure(baseData, day, allOpen ? "blocked" : "open"));
    } catch {
      setFlash("Sauvegarde échouée");
      setTimeout(() => setFlash(null), 2400);
    }
  }

  async function handlePublish() {
    try {
      const saved = await publishMonth(year, month);
      setBaseData(saved);
      setFlash(`✓ ${monthLabel(month)} ${year} publié`);
      setTimeout(() => setFlash(null), 2400);
    } catch {
      setFlash("Publication échouée");
      setTimeout(() => setFlash(null), 2400);
    }
  }

  async function handleUnpublish() {
    try {
      const saved = await unpublishMonth(year, month);
      setBaseData(saved);
      setFlash("Mois remis en brouillon");
      setTimeout(() => setFlash(null), 2400);
    } catch {
      setFlash("Dépublication échouée");
      setTimeout(() => setFlash(null), 2400);
    }
  }

  async function resyncBookings() {
    try {
      const monthData = await fetchAdminMonth(year, month);
      const r = await api<{ bookings: BookingLite[] }>("/admin/bookings");
      const target = `${year}-${String(month).padStart(2, "0")}`;
      const monthBookings = (r.bookings || []).filter(
        (b) =>
          b.date?.startsWith(target) &&
          (b.paymentStatus === "deposit_paid" || b.paymentStatus === "paid"),
      );
      setBaseData(monthData);
      setConfirmedBookings(monthBookings);
      setSyncCount(monthBookings.length);
      setFlash(`Sync ok — ${monthBookings.length} RDV pris en compte`);
      setTimeout(() => setFlash(null), 2400);
    } catch {
      setFlash("Sync échouée");
      setTimeout(() => setFlash(null), 2400);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507] text-white">
      {/* BG */}
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-[36rem] w-[36rem] rounded-full bg-pss-pink/15 blur-[180px]" />

      {/* Top bar */}
      <div className="relative z-10 mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6 md:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center">
            <Star />
          </span>
          <span className="font-display text-base uppercase tracking-[0.06em] text-white">
            PinkStar<span className="text-pss-pink">.</span>Society
          </span>
        </Link>
        <Link
          to="/admin"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-[11px] uppercase tracking-[0.2em] text-white/70 transition hover:border-pss-pink/40 hover:text-pss-pink"
        >
          <ArrowLeft />
          Panel admin
        </Link>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1100px] px-4 pb-16 pt-2 sm:px-6 md:px-8 md:pt-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-white/55">
            <span className="font-mono text-pss-pink">/admin</span>
            <span className="h-px w-10 bg-white/15" />
            <span>Disponibilités</span>
          </div>
          <h1 className="mt-3 font-display text-3xl uppercase leading-[1] tracking-[-0.02em] sm:text-4xl">
            <span className="block py-[0.06em] text-white">
              Gestion des <span className="text-pss-pink">créneaux.</span>
            </span>
          </h1>
          <p className="mt-3 max-w-xl font-serif text-[15px] leading-relaxed text-white/65 md:text-[16px]">
            Cliquez sur un créneau pour le basculer.{" "}
            <span className="text-white">Publier le mois</span> le rend visible
            côté client.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 md:p-7"
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
                  Publié — visible client
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                  Brouillon
                </span>
              )
            }
          />

          {/* Sync info */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pss-pink/20 bg-pss-pink/5 px-4 py-3 text-[12px] text-white/75">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-pss-pink/25 text-pss-pink">
                <RefreshIcon />
              </span>
              <span>
                {loading || syncCount === null ? (
                  <>Chargement et synchronisation des RDV…</>
                ) : syncCount === 0 ? (
                  <>Aucun RDV confirmé sur ce mois.</>
                ) : (
                  <>
                    <span className="text-white">{syncCount}</span> RDV
                    confirmé{syncCount > 1 ? "s" : ""} synchronisé
                    {syncCount > 1 ? "s" : ""} → créneaux passés en rouge.
                  </>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void resyncBookings()}
              disabled={loading}
              className="min-h-10 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/75 transition hover:border-pss-pink/60 hover:text-pss-pink disabled:opacity-50"
            >
              Re-synchroniser
            </button>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Créneaux" value={String(stats.total)} />
            <Stat
              label="Disponibles"
              value={String(stats.open)}
              tone="ok"
            />
            <Stat
              label="Bloqués"
              value={String(stats.blocked)}
              tone="off"
            />
          </div>

          <div className="mt-8">
            <AvailabilityCalendar
              data={data}
              mode="admin"
              onToggle={(day, slot) => void handleToggle(day, slot)}
              onToggleDay={(day) => void handleToggleDay(day)}
            />
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
            <div className="text-[11px] text-white/45">
              {data.published
                ? "Toute modification est immédiatement visible côté client."
                : "Le mois est en brouillon. Les visiteurs voient « À venir »."}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data.published ? (
                <button
                  type="button"
                  onClick={() => void handleUnpublish()}
                  className="min-h-11 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-[12px] uppercase tracking-[0.18em] text-white/75 transition hover:border-white/25 hover:text-white"
                >
                  Dépublier
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  className="btn-pink min-h-11"
                >
                  Publier ce mois
                  <Arrow />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {flash && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-4 py-2 text-sm text-emerald-200 backdrop-blur"
          >
            {flash}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "off";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "off"
        ? "text-red-300"
        : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl ${color}`}>{value}</div>
    </div>
  );
}

function monthLabel(m: number) {
  return [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ][m - 1];
}

function Star() {
  return (
    <svg viewBox="0 0 100 100" className="h-6 w-6">
      <defs>
        <linearGradient id="adm-dispo-star" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffd4ee" />
          <stop offset="0.5" stopColor="#f43f9b" />
          <stop offset="1" stopColor="#d61e7c" />
        </linearGradient>
      </defs>
      <polygon
        fill="url(#adm-dispo-star)"
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

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12h14M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
