import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { api } from "../lib/api";
import {
  BarRow,
  Booking,
  BookingRow,
  Icon,
  StatCard,
  computeRevenueAnalytics,
  computeHoursAnalytics,
  fmtEUR,
  fmtHoursMinutes,
  formatLongDate,
  shiftDate,
  shiftMonth,
  todayISO,
} from "../lib/adminShared";

type RevenueAnalytics = ReturnType<typeof computeRevenueAnalytics>;
type HoursAnalytics = ReturnType<typeof computeHoursAnalytics>;

export default function AdminDashboardPage() {
  const { openSidebar } = useOutletContext<{ openSidebar: () => void }>();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [showRevenue, setShowRevenue] = useState(false);
  const [showHours, setShowHours] = useState(false);
  const [revenueMonth, setRevenueMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [hoursMonth, setHoursMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const loadBookings = useCallback(async () => {
    try {
      const r = await api<{ bookings: Booking[] }>("/admin/bookings");
      setBookings(r.bookings);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const today = todayISO();

  const stats = useMemo(() => {
    const todayCount = bookings.filter((b) => b.date === today).length;
    const start = new Date(today + "T00:00:00");
    const weekStart = new Date(start);
    const day = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - day);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekCount = bookings.filter((b) => {
      const d = new Date(b.date + "T00:00:00");
      return d >= weekStart && d < weekEnd;
    }).length;
    const monthBookings = bookings.filter((b) => {
      const d = new Date(b.date + "T00:00:00");
      return d.getMonth() === start.getMonth() && d.getFullYear() === start.getFullYear();
    });
    const monthHours = computeHoursAnalytics(
      bookings,
      start.getFullYear(),
      start.getMonth(),
    );
    const monthRevenue = monthBookings.reduce((s, b) => s + b.priceCents, 0);
    const pendingCount = bookings.filter((b) => b.paymentStatus === "pending").length;
    return {
      todayCount,
      weekCount,
      monthRevenue,
      monthMinutes: monthHours.totalMinutes,
      monthBookingsCount: monthHours.totalBookings,
      pendingCount,
    };
  }, [bookings, today]);

  const dayBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.date === selectedDate)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [bookings, selectedDate],
  );

  const revenueAnalytics = useMemo(
    () => computeRevenueAnalytics(bookings, revenueMonth.year, revenueMonth.month),
    [bookings, revenueMonth],
  );

  const hoursAnalytics = useMemo(
    () => computeHoursAnalytics(bookings, hoursMonth.year, hoursMonth.month),
    [bookings, hoursMonth],
  );

  if (showRevenue) {
    return (
      <RevenueDetailView
        openSidebar={openSidebar}
        analytics={revenueAnalytics}
        onBack={() => setShowRevenue(false)}
        onPrevMonth={() => setRevenueMonth((m) => shiftMonth(m.year, m.month, -1))}
        onNextMonth={() => setRevenueMonth((m) => shiftMonth(m.year, m.month, 1))}
      />
    );
  }

  if (showHours) {
    return (
      <HoursDetailView
        openSidebar={openSidebar}
        analytics={hoursAnalytics}
        onBack={() => setShowHours(false)}
        onPrevMonth={() => setHoursMonth((m) => shiftMonth(m.year, m.month, -1))}
        onNextMonth={() => setHoursMonth((m) => shiftMonth(m.year, m.month, 1))}
      />
    );
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#050507]/90 px-4 backdrop-blur md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={openSidebar}
            className="lg:hidden text-white/70 shrink-0"
          >
            <Icon name="menu" />
          </button>
          <h1 className="truncate font-display text-base uppercase tracking-[0.14em] sm:text-lg">
            Tableau de bord
          </h1>
        </div>
      </header>

      <main className="px-3 py-6 sm:px-4 md:px-8 md:py-8 space-y-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 md:gap-4">
          <StatCard
            label="Aujourd'hui"
            value={String(stats.todayCount)}
            hint="rendez-vous"
            icon="calendar"
            accent
          />
          <StatCard
            label="Cette semaine"
            value={String(stats.weekCount)}
            hint="rendez-vous"
            icon="chart"
          />
          <StatCard
            label="CA du mois"
            value={fmtEUR(stats.monthRevenue)}
            hint="voir le détail"
            icon="euro"
            onClick={() => {
              const d = new Date();
              setRevenueMonth({ year: d.getFullYear(), month: d.getMonth() });
              setShowRevenue(true);
            }}
          />
          <StatCard
            label="Heures du mois"
            value={fmtHoursMinutes(stats.monthMinutes)}
            hint={`${stats.monthBookingsCount} rendez-vous · voir le détail`}
            icon="clock"
            onClick={() => {
              const d = new Date();
              setHoursMonth({ year: d.getFullYear(), month: d.getMonth() });
              setShowHours(true);
            }}
          />
          <StatCard
            label="En attente"
            value={String(stats.pendingCount)}
            hint="paiement"
            icon="chart"
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 md:p-5">
            <div>
              <h2 className="font-display text-base uppercase tracking-[0.14em] text-white">
                Agenda
              </h2>
              <p className="mt-1 text-sm capitalize text-white/55">
                {formatLongDate(selectedDate)}
              </p>
            </div>
            <div className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                className="rounded-lg border border-white/10 p-2 text-white/70 transition hover:border-white/20 hover:text-white"
              >
                <Icon name="chevronLeft" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(today)}
                className={`rounded-lg border px-3 py-2 text-[10px] uppercase tracking-[0.14em] transition sm:text-xs ${
                  selectedDate === today
                    ? "border-pss-pink/50 bg-pss-pink/15 text-pss-pink"
                    : "border-white/10 text-white/70 hover:border-white/20 hover:text-white"
                }`}
              >
                Auj.
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                className="rounded-lg border border-white/10 p-2 text-white/70 transition hover:border-white/20 hover:text-white"
              >
                <Icon name="chevronRight" className="h-4 w-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="hidden rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white sm:block"
              />
            </div>
          </div>

          <div className="p-5">
            {dayBookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
                <p className="text-sm text-white/55">Aucun rendez-vous ce jour-là.</p>
                <button
                  type="button"
                  onClick={() => navigate("/admin/reservations")}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs text-white/60 transition hover:border-pss-pink/30 hover:text-white"
                >
                  Voir toutes les réservations
                </button>
              </div>
            ) : (
              <ul className="space-y-3">
                {dayBookings.map((b) => (
                  <BookingRow
                    key={b.id}
                    b={b}
                    onSelect={(booking) =>
                      navigate(`/admin/reservations?detail=${booking.id}`)
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function RevenueDetailView({
  openSidebar,
  analytics,
  onBack,
  onPrevMonth,
  onNextMonth,
}: {
  openSidebar: () => void;
  analytics: RevenueAnalytics;
  onBack: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const totalPaidFull =
    analytics.paidFullOnline + analytics.paidFullCash + analytics.paidFullBank;
  const pct = (n: number) =>
    totalPaidFull > 0 ? Math.round((n / totalPaidFull) * 100) : 0;

  const maxWeekdayCount = Math.max(...analytics.byWeekday.map((d) => d.count), 1);
  const maxHourCount = Math.max(...analytics.byHour.map((d) => d.count), 1);
  const busiestDay = analytics.byWeekday.reduce(
    (best, d) => (d.count > best.count ? d : best),
    analytics.byWeekday[0],
  );

  const collectionRate =
    analytics.totalRevenueCents > 0
      ? Math.round((analytics.collectedCents / analytics.totalRevenueCents) * 100)
      : 0;

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#050507]/90 px-4 backdrop-blur md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={openSidebar}
            className="lg:hidden text-white/70 shrink-0"
          >
            <Icon name="menu" />
          </button>
          <h1 className="truncate font-display text-base uppercase tracking-[0.14em] sm:text-lg">
            CA du mois
          </h1>
        </div>
      </header>

      <main className="px-3 py-6 sm:px-4 md:px-8 md:py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
            Tableau de bord
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPrevMonth}
              className="rounded-lg border border-white/10 p-2 text-white/70 transition hover:border-white/20 hover:text-white"
            >
              <Icon name="chevronLeft" className="h-4 w-4" />
            </button>
            <span className="min-w-[140px] text-center text-sm capitalize text-white">
              {analytics.monthLabel}
            </span>
            <button
              type="button"
              onClick={onNextMonth}
              className="rounded-lg border border-white/10 p-2 text-white/70 transition hover:border-white/20 hover:text-white"
            >
              <Icon name="chevronRight" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard
            label="CA total"
            value={fmtEUR(analytics.totalRevenueCents)}
            hint={`${analytics.totalBookings} rendez-vous`}
            icon="euro"
            accent
          />
          <StatCard
            label="Encaissé"
            value={fmtEUR(analytics.collectedCents)}
            hint={`${collectionRate}% du CA`}
            icon="check"
          />
          <StatCard
            label="En attente"
            value={fmtEUR(analytics.pendingCents)}
            hint={`${analytics.pendingCount + analytics.depositOnlyCount} paiement(s)`}
            icon="clock"
          />
          <StatCard
            label="Jour le plus actif"
            value={busiestDay.count > 0 ? busiestDay.label : "—"}
            hint={busiestDay.count > 0 ? `${busiestDay.count} rendez-vous` : "aucune donnée"}
            icon="calendar"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="font-display text-sm uppercase tracking-[0.14em] text-white">
              Totalité payée — mode de règlement
            </h2>
            <p className="mt-1 text-xs text-white/50">
              {totalPaidFull} prestation(s) entièrement payée(s) ce mois
            </p>
            {totalPaidFull === 0 ? (
              <p className="mt-6 text-sm text-white/55">
                Aucune prestation entièrement payée sur cette période.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                <BarRow
                  label="Sur le site (Stripe)"
                  value={analytics.paidFullOnline}
                  max={totalPaidFull}
                  display={`${analytics.paidFullOnline} · ${pct(analytics.paidFullOnline)}%`}
                  color="bg-pss-pink"
                />
                <BarRow
                  label="Espèces (solde)"
                  value={analytics.paidFullCash}
                  max={totalPaidFull}
                  display={`${analytics.paidFullCash} · ${pct(analytics.paidFullCash)}%`}
                  color="bg-amber-400"
                />
                <BarRow
                  label="Virement (solde)"
                  value={analytics.paidFullBank}
                  max={totalPaidFull}
                  display={`${analytics.paidFullBank} · ${pct(analytics.paidFullBank)}%`}
                  color="bg-sky-400"
                />
              </div>
            )}
            {(analytics.depositOnlyCount > 0 || analytics.pendingCount > 0) && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
                {analytics.depositOnlyCount > 0 && (
                  <p>{analytics.depositOnlyCount} acompte(s) en ligne, solde restant à encaisser</p>
                )}
                {analytics.pendingCount > 0 && (
                  <p className={analytics.depositOnlyCount > 0 ? "mt-1" : ""}>
                    {analytics.pendingCount} réservation(s) sans paiement
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="font-display text-sm uppercase tracking-[0.14em] text-white">
              Activité par jour de la semaine
            </h2>
            <p className="mt-1 text-xs text-white/50">Nombre de rendez-vous par jour</p>
            {analytics.totalBookings === 0 ? (
              <p className="mt-6 text-sm text-white/55">Aucun rendez-vous ce mois.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {analytics.byWeekday.map((d) => (
                  <BarRow
                    key={d.label}
                    label={d.label}
                    value={d.count}
                    max={maxWeekdayCount}
                    display={`${d.count} · ${fmtEUR(d.revenueCents)}`}
                    color={
                      d.count === busiestDay.count && d.count > 0
                        ? "bg-pss-pink"
                        : "bg-white/40"
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="font-display text-sm uppercase tracking-[0.14em] text-white">
              Heures les plus demandées
            </h2>
            <p className="mt-1 text-xs text-white/50">Créneaux horaires de début</p>
            {analytics.byHour.length === 0 ? (
              <p className="mt-6 text-sm text-white/55">Aucune donnée.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {analytics.byHour.map((h) => (
                  <BarRow
                    key={h.hour}
                    label={`${h.hour}h`}
                    value={h.count}
                    max={maxHourCount}
                    display={String(h.count)}
                    color="bg-pss-pink/80"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="font-display text-sm uppercase tracking-[0.14em] text-white">
              CA par prestation
            </h2>
            <p className="mt-1 text-xs text-white/50">Classement par montant total</p>
            {analytics.byService.length === 0 ? (
              <p className="mt-6 text-sm text-white/55">Aucune prestation.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {analytics.byService.map((s, i) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{s.name}</p>
                      <p className="text-xs text-white/50">
                        {s.count} prestation{s.count > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg text-pss-pink">
                        {fmtEUR(s.revenueCents)}
                      </p>
                      {i === 0 && analytics.byService.length > 1 && (
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                          Top
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function HoursDetailView({
  openSidebar,
  analytics,
  onBack,
  onPrevMonth,
  onNextMonth,
}: {
  openSidebar: () => void;
  analytics: HoursAnalytics;
  onBack: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const maxWeekdayMinutes = Math.max(...analytics.byWeekday.map((d) => d.minutes), 1);
  const maxHourMinutes = Math.max(...analytics.byHour.map((d) => d.minutes), 1);
  const busiestDay = analytics.byWeekday.reduce(
    (best, d) => (d.minutes > best.minutes ? d : best),
    analytics.byWeekday[0],
  );

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#050507]/90 px-4 backdrop-blur md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={openSidebar}
            className="lg:hidden text-white/70 shrink-0"
          >
            <Icon name="menu" />
          </button>
          <h1 className="truncate font-display text-base uppercase tracking-[0.14em] sm:text-lg">
            Heures du mois
          </h1>
        </div>
      </header>

      <main className="px-3 py-6 sm:px-4 md:px-8 md:py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
            Tableau de bord
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPrevMonth}
              className="rounded-lg border border-white/10 p-2 text-white/70 transition hover:border-white/20 hover:text-white"
            >
              <Icon name="chevronLeft" className="h-4 w-4" />
            </button>
            <span className="min-w-[140px] text-center text-sm capitalize text-white">
              {analytics.monthLabel}
            </span>
            <button
              type="button"
              onClick={onNextMonth}
              className="rounded-lg border border-white/10 p-2 text-white/70 transition hover:border-white/20 hover:text-white"
            >
              <Icon name="chevronRight" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard
            label="Total heures"
            value={fmtHoursMinutes(analytics.totalMinutes)}
            hint={`${analytics.totalBookings} rendez-vous`}
            icon="clock"
            accent
          />
          <StatCard
            label="Moyenne / RDV"
            value={fmtHoursMinutes(analytics.avgMinutesPerBooking)}
            hint="durée moyenne"
            icon="chart"
          />
          <StatCard
            label="Jour le plus chargé"
            value={busiestDay.minutes > 0 ? busiestDay.label : "—"}
            hint={
              busiestDay.minutes > 0
                ? `${fmtHoursMinutes(busiestDay.minutes)} · ${busiestDay.count} RDV`
                : "aucune donnée"
            }
            icon="calendar"
          />
          <StatCard
            label="Prestations"
            value={String(analytics.byService.length)}
            hint="types différents"
            icon="scissors"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="font-display text-sm uppercase tracking-[0.14em] text-white">
              Heures par jour de la semaine
            </h2>
            <p className="mt-1 text-xs text-white/50">Temps total planifié par jour</p>
            {analytics.totalBookings === 0 ? (
              <p className="mt-6 text-sm text-white/55">Aucun rendez-vous ce mois.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {analytics.byWeekday.map((d) => (
                  <BarRow
                    key={d.label}
                    label={d.label}
                    value={d.minutes}
                    max={maxWeekdayMinutes}
                    display={`${fmtHoursMinutes(d.minutes)} · ${d.count} RDV`}
                    color={
                      d.minutes === busiestDay.minutes && d.minutes > 0
                        ? "bg-pss-pink"
                        : "bg-white/40"
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="font-display text-sm uppercase tracking-[0.14em] text-white">
              Heures par créneau de début
            </h2>
            <p className="mt-1 text-xs text-white/50">Temps total par heure de début</p>
            {analytics.byHour.length === 0 ? (
              <p className="mt-6 text-sm text-white/55">Aucune donnée.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {analytics.byHour.map((h) => (
                  <BarRow
                    key={h.hour}
                    label={`${h.hour}h`}
                    value={h.minutes}
                    max={maxHourMinutes}
                    display={`${fmtHoursMinutes(h.minutes)} · ${h.count}`}
                    color="bg-pss-pink/80"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="font-display text-sm uppercase tracking-[0.14em] text-white">
            Heures par prestation
          </h2>
          <p className="mt-1 text-xs text-white/50">Classement par temps total</p>
          {analytics.byService.length === 0 ? (
            <p className="mt-6 text-sm text-white/55">Aucune prestation.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {analytics.byService.map((s, i) => (
                <li
                  key={s.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{s.name}</p>
                    <p className="text-xs text-white/50">
                      {s.count} prestation{s.count > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg text-pss-pink">
                      {fmtHoursMinutes(s.minutes)}
                    </p>
                    {i === 0 && analytics.byService.length > 1 && (
                      <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                        Top
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
