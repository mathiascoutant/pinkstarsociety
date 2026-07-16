import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { LOYALTY_CYCLE_POINTS, LOYALTY_MILESTONES } from "../lib/adminShared";
import { useLenis } from "../lib/useLenis";
import { api } from "../lib/api";

const easeOut = [0.2, 0.8, 0.2, 1] as const;

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOut } },
};

type BookingRow = {
  id: string;
  publicToken: string;
  serviceTypeName: string;
  date: string;
  time: string;
  visitLabelFR?: string;
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function AccountBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 grid-noise opacity-20" />
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-32 top-10 h-[32rem] w-[32rem] rounded-full bg-pss-pink/15 blur-[160px]"
      />
      <div className="absolute -right-16 top-1/4 h-[24rem] w-[24rem] rounded-full bg-fuchsia-500/10 blur-[130px]" />
      <div className="absolute bottom-0 left-1/2 h-[18rem] w-[min(90vw,48rem)] -translate-x-1/2 rounded-full bg-violet-600/6 blur-[100px]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-pss-ink to-transparent" />
    </div>
  );
}

function BookingTabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-medium uppercase tracking-[0.08em] transition-all duration-300 ${
        active
          ? "bg-pss-pink/12 text-white shadow-[0_0_24px_rgba(255,43,177,0.15)] ring-1 ring-pss-pink/25"
          : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`grid min-w-[20px] place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
            active ? "bg-pss-pink/20 text-pss-pink" : "bg-white/[0.06] text-white/35"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function BookingCard({
  booking,
  variant,
}: {
  booking: BookingRow;
  variant: "upcoming" | "past";
}) {
  const isUpcoming = variant === "upcoming";
  return (
    <Link
      to={`/compte/prestation/${booking.id}`}
      className={`group block overflow-hidden rounded-xl transition-all duration-300 ${
        isUpcoming
          ? "border border-white/[0.08] bg-white/[0.03] hover:border-pss-pink/30 hover:bg-white/[0.06] hover:shadow-[0_0_20px_rgba(255,43,177,0.08)]"
          : "border border-white/[0.06] bg-white/[0.015] hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center gap-4 p-4 md:p-5">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
            isUpcoming
              ? "bg-pss-pink/10 text-pss-pink"
              : "bg-white/[0.04] text-white/40"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`truncate font-medium transition ${
              isUpcoming ? "text-white group-hover:text-pss-pink" : "text-white/80 group-hover:text-white"
            }`}
          >
            {booking.serviceTypeName}
          </p>
          <p className="mt-0.5 text-[13px] text-white/45">
            {formatDate(booking.date)} · {booking.time}
          </p>
          {booking.visitLabelFR && (
            <p className="mt-0.5 text-[11px] text-white/30">{booking.visitLabelFR}</p>
          )}
        </div>

        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition ${isUpcoming ? "text-white/25 group-hover:text-pss-pink" : "text-white/15 group-hover:text-white/40"}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 px-4 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.03]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <p className="text-sm text-white/35">{label}</p>
    </div>
  );
}

const loyaltyMilestones = LOYALTY_MILESTONES;

function nextMilestone(points: number) {
  return loyaltyMilestones.find((m) => points < m.points) ?? null;
}

export default function AccountLoyaltyPage() {
  useLenis();
  const { user, refresh } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [bookingTab, setBookingTab] = useState<"upcoming" | "past">("upcoming");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await api<{ bookings: BookingRow[] }>("/me/bookings");
      setBookings(r.bookings);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const t = todayISO();
  const { upcoming, past } = useMemo(() => {
    const up: BookingRow[] = [];
    const pa: BookingRow[] = [];
    for (const b of bookings) {
      if (b.date < t) pa.push(b);
      else up.push(b);
    }
    pa.sort((a, b) => (a.date < b.date ? 1 : -1));
    up.sort((a, b) => (a.date > b.date ? 1 : -1));
    return { upcoming: up, past: pa };
  }, [bookings, t]);

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()
    : "?";

  const points = user?.loyaltyPoints ?? 0;
  const progressPercent = Math.min((points / LOYALTY_CYCLE_POINTS) * 100, 100);
  const next = nextMilestone(points);
  const pointsToNext = next ? next.points - points : 0;

  return (
    <div className="relative min-h-screen bg-[#050507] text-white">
      <Navbar />

      <main className="relative">
        <AccountBackground />

        <div className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-28 md:px-8 md:pt-36">
          <motion.div variants={stagger} initial="hidden" animate="show">
            {/* Breadcrumb */}
            <motion.div variants={fadeUp}>
              <p className="text-[11px] uppercase tracking-[0.32em] text-white/35">
                <Link to="/" className="transition hover:text-pss-pink">
                  Accueil
                </Link>
                <span className="mx-2 text-white/20">/</span>
                <Link to="/compte" className="transition hover:text-pss-pink">
                  Compte
                </Link>
                <span className="mx-2 text-white/20">/</span>
                <span className="text-white/55">Fidélité</span>
              </p>
            </motion.div>

            {/* Header */}
            <motion.div variants={fadeUp} className="mt-8">
              <div className="glass-card overflow-hidden rounded-2xl">
                <div className="relative overflow-hidden px-6 py-7 md:px-10 md:py-8">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pss-pink/8 via-transparent to-violet-500/5" />
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-pss-pink/10 blur-[80px]" />
                  <div className="relative flex items-center gap-5 md:gap-6">
                    <div className="relative">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-pss-pink/30 to-pss-hot/20 font-display text-xl tracking-wider shadow-[0_0_40px_rgba(255,43,177,0.2)] ring-1 ring-white/10">
                        {initials}
                      </div>
                      <div className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 ring-2 ring-[#050507]">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h1 className="font-display text-2xl uppercase tracking-[0.08em] md:text-3xl">
                        <span className="text-white">Programme </span>
                        <span className="chrome-pink">fidélité</span>
                      </h1>
                      <p className="mt-1 text-sm text-white/40">
                        Tes points et l'avancement de tes récompenses
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Stats grid */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Points */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.55, ease: easeOut }}
              className="glass-card relative overflow-hidden rounded-2xl px-6 py-6"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pss-pink/40 to-transparent" />
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-pss-pink/8 blur-[40px]" />
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                Points disponibles
              </p>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-display text-5xl tabular-nums tracking-tight chrome-pink">
                  {points}
                </span>
                <span className="pb-1 text-lg text-white/30">pts</span>
              </div>
              <p className="mt-2 text-[11px] text-white/30">Crédités après chaque prestation</p>
            </motion.div>

            {/* Cycle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.55, ease: easeOut }}
              className="glass-card relative overflow-hidden rounded-2xl px-6 py-6"
            >
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-violet-500/8 blur-[40px]" />
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                Avant reset
              </p>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-display text-5xl tabular-nums tracking-tight text-white">
                  {LOYALTY_CYCLE_POINTS - points}
                </span>
                <span className="pb-1 text-lg text-white/30">pts</span>
              </div>
              <p className="mt-2 text-[11px] text-white/30">
                Puis retour à 0 pour un nouveau cycle
              </p>
            </motion.div>

            {/* Prochaine récompense */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.55, ease: easeOut }}
              className={`glass-card relative overflow-hidden rounded-2xl px-6 py-6 ${next ? "ring-1 ring-pss-pink/15" : ""}`}
            >
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-fuchsia-500/8 blur-[40px]" />
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                Prochaine récompense
              </p>
              {next ? (
                <>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="font-display text-5xl tabular-nums tracking-tight chrome-pink">
                      {next.reward}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-white/30">
                    Dans{" "}
                    <span className="font-medium text-white/55">
                      {pointsToNext} pt{pointsToNext > 1 ? "s" : ""}
                    </span>{" "}
                    ({next.label})
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-3">
                    <span className="font-display text-2xl tracking-tight text-white/60">
                      Cycle complet
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-white/30">Compteur remis à zéro</p>
                </>
              )}
            </motion.div>
          </div>

          {/* Progression + jalons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.55, ease: easeOut }}
            className="mt-4"
          >
            <div className="glass-card overflow-hidden rounded-2xl">
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-5 md:px-8">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-pss-pink/10">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-pss-pink">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-display text-sm uppercase tracking-[0.1em]">
                    Progression
                  </h2>
                  <p className="text-[11px] text-white/35">
                    Atteins les paliers pour débloquer tes récompenses
                  </p>
                </div>
              </div>

              <div className="px-6 py-7 md:px-8 md:py-8">
                {/* Barre de progression */}
                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.12em]">
                  <span className="text-white/45">Avancement</span>
                  <span className="font-medium text-pss-pink">
                    {points} / {LOYALTY_CYCLE_POINTS} pts
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ delay: 0.5, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
                    className="h-full rounded-full bg-gradient-to-r from-pss-pink via-fuchsia-400 to-violet-400"
                  />
                  {/* Marqueurs jalons sur la barre */}
                  {loyaltyMilestones.map((m) => (
                    <div
                      key={m.points}
                      className="absolute top-0 h-full w-px bg-[#050507]/60"
                      style={{ left: `${(m.points / LOYALTY_CYCLE_POINTS) * 100}%` }}
                    />
                  ))}
                </div>

                {/* Jalons détaillés */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {loyaltyMilestones.map((milestone) => {
                    const reached = points >= milestone.points;
                    const isNext = next?.points === milestone.points;
                    return (
                      <div
                        key={milestone.points}
                        className={`relative overflow-hidden rounded-xl border px-4 py-4 text-center transition-all ${
                          reached
                            ? "border-pss-pink/30 bg-pss-pink/8"
                            : isNext
                            ? "border-pss-pink/15 bg-white/[0.02] ring-1 ring-pss-pink/10"
                            : "border-white/[0.06] bg-white/[0.015]"
                        }`}
                      >
                        {reached && (
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pss-pink/50 to-transparent" />
                        )}
                        <div className={`mx-auto mb-2.5 grid h-8 w-8 place-items-center rounded-full ${reached ? "bg-pss-pink/20" : "bg-white/[0.05]"}`}>
                          {reached ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-pss-pink">
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className={`font-display text-[10px] ${isNext ? "text-white/60" : "text-white/25"}`}>
                              {milestone.points}
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] font-medium uppercase tracking-[0.08em] ${reached ? "text-white" : isNext ? "text-white/55" : "text-white/30"}`}>
                          {milestone.label}
                        </p>
                        <p className={`mt-0.5 font-display text-lg tracking-tight ${reached ? "chrome-pink" : isNext ? "text-white/45" : "text-white/20"}`}>
                          {milestone.reward}
                        </p>
                        {isNext && !reached && (
                          <p className="mt-1.5 text-[10px] text-pss-pink/70">
                            encore {milestone.points - points} pts
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 border-t border-white/[0.05] pt-4">
                  <div className="flex items-start gap-2.5 text-[12px] leading-relaxed text-white/35">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 shrink-0 text-white/20">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" strokeLinecap="round" />
                      <path d="M12 8h.01" strokeLinecap="round" />
                    </svg>
                    1 € dépensé = 1 point. À 300 pts : −30 %, à 500 pts : −50 %. À {LOYALTY_CYCLE_POINTS} pts, le compteur repart à 0 pour recommencer le cycle.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {err && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300"
              role="alert"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {err}
            </motion.div>
          )}

          {/* Séances */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.55, ease: easeOut }}
            className="mt-4"
          >
            <div className="glass-card overflow-hidden rounded-2xl">
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-5 md:px-8">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-pss-pink/10">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-pss-pink">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-sm uppercase tracking-[0.1em]">
                    Mes séances
                  </h2>
                  <p className="text-[11px] text-white/35">
                    Historique de tes prestations
                  </p>
                </div>
              </div>

              <div className="flex gap-2 px-6 pt-5 md:px-8">
                <BookingTabButton
                  active={bookingTab === "upcoming"}
                  label="À venir"
                  count={upcoming.length}
                  onClick={() => setBookingTab("upcoming")}
                />
                <BookingTabButton
                  active={bookingTab === "past"}
                  label="Passées"
                  count={past.length}
                  onClick={() => setBookingTab("past")}
                />
              </div>

              <div className="px-6 py-5 md:px-8">
                <AnimatePresence mode="wait">
                  {bookingTab === "upcoming" && (
                    <motion.div
                      key="upcoming"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.25, ease: easeOut }}
                      className="space-y-3"
                    >
                      {upcoming.length === 0 ? (
                        <EmptyState label="Aucune séance à venir" />
                      ) : (
                        upcoming.map((b) => (
                          <BookingCard key={b.id} booking={b} variant="upcoming" />
                        ))
                      )}
                    </motion.div>
                  )}

                  {bookingTab === "past" && (
                    <motion.div
                      key="past"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.25, ease: easeOut }}
                      className="space-y-3"
                    >
                      {past.length === 0 ? (
                        <EmptyState label="Aucune séance passée" />
                      ) : (
                        past.map((b) => (
                          <BookingCard key={b.id} booking={b} variant="past" />
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}