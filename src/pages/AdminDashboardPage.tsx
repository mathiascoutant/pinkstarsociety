import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { api } from "../lib/api";
import {
  BarRow,
  Booking,
  BookingRow,
  Icon,
  PERIOD_MODE_LABELS,
  PeriodMode,
  RevenuePeriod,
  StatCard,
  bookingCollectedCents,
  computeRevenueAnalytics,
  computeHoursAnalytics,
  fmtEUR,
  fmtHoursMinutes,
  formatLongDate,
  paymentStatusLabel,
  paymentStatusTone,
  shiftDate,
  shiftMonth,
  shiftPeriod,
  todayISO,
} from "../lib/adminShared";

type RevenueAnalytics = ReturnType<typeof computeRevenueAnalytics>;
type HoursAnalytics = ReturnType<typeof computeHoursAnalytics>;

const AGENDA_SLOTS = ["08:00", "10:00", "14:00", "17:00"] as const;

function normalizeTime(time: string) {
  const [h = "0", m = "00"] = time.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0").slice(0, 2)}`;
}

function slotLabel(slot: string) {
  return `${Number(slot.slice(0, 2))}h`;
}

export default function AdminDashboardPage() {
  const { openSidebar } = useOutletContext<{ openSidebar: () => void }>();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [showRevenue, setShowRevenue] = useState(false);
  const [showHours, setShowHours] = useState(false);
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>(() => ({
    mode: "month",
    anchor: todayISO(),
  }));
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
    const year = start.getFullYear();
    const month = start.getMonth();
    const weekStart = new Date(start);
    const day = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - day);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekCount = bookings.filter((b) => {
      const d = new Date(b.date + "T00:00:00");
      return d >= weekStart && d < weekEnd;
    }).length;

    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const mtdBookings = bookings.filter((b) => b.date >= monthStart && b.date <= today);
    const mtdCollectedCents = mtdBookings.reduce((s, b) => s + bookingCollectedCents(b), 0);
    const mtdRevenueCents = mtdBookings.reduce((s, b) => s + b.priceCents, 0);

    const monthHours = computeHoursAnalytics(bookings, year, month);
    const pendingCount = bookings.filter((b) => b.paymentStatus === "pending").length;

    return {
      todayCount,
      weekCount,
      mtdCollectedCents,
      mtdRevenueCents,
      mtdBookingsCount: mtdBookings.length,
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

  const agendaSlots = useMemo(() => {
    const used = new Set<string>();
    const slots = AGENDA_SLOTS.map((slot) => {
      const hour = slot.slice(0, 2);
      const booking =
        dayBookings.find((b) => normalizeTime(b.time) === slot) ||
        dayBookings.find((b) => normalizeTime(b.time).startsWith(`${hour}:`));
      if (booking) used.add(booking.id);
      return { slot, booking: booking ?? null };
    });
    const extras = dayBookings.filter((b) => !used.has(b.id));
    return { slots, extras };
  }, [dayBookings]);

  const revenueAnalytics = useMemo(
    () => computeRevenueAnalytics(bookings, revenuePeriod),
    [bookings, revenuePeriod],
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
        period={revenuePeriod}
        onBack={() => setShowRevenue(false)}
        onModeChange={(mode) => setRevenuePeriod((p) => ({ ...p, mode }))}
        onPrev={() => setRevenuePeriod((p) => shiftPeriod(p, -1))}
        onNext={() => setRevenuePeriod((p) => shiftPeriod(p, 1))}
        onReset={() => setRevenuePeriod((p) => ({ ...p, anchor: todayISO() }))}
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
            label="Gains du mois"
            value={fmtEUR(stats.mtdCollectedCents)}
            hint={`${stats.mtdBookingsCount} RDV · CA ${fmtEUR(stats.mtdRevenueCents)} · détail`}
            icon="euro"
            onClick={() => {
              setRevenuePeriod({ mode: "month", anchor: todayISO() });
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

          <div className="space-y-4 p-4 md:p-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {agendaSlots.slots.map(({ slot, booking }) =>
                booking ? (
                  <button
                    key={slot}
                    type="button"
                    onClick={() =>
                      navigate(`/admin/reservations?detail=${booking.id}`)
                    }
                    className="flex min-h-[120px] flex-col rounded-2xl border border-pss-pink/40 bg-pss-pink/10 p-4 text-left transition hover:border-pss-pink/60 hover:bg-pss-pink/15"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-lg text-pss-pink">
                        {slotLabel(slot)}
                      </span>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ${paymentStatusTone(booking.paymentStatus)}`}
                      >
                        {paymentStatusLabel(booking.paymentStatus)}
                      </span>
                    </div>
                    <span className="mt-2 truncate text-sm font-medium text-white">
                      {booking.serviceTypeName}
                    </span>
                    <span className="mt-1 truncate text-xs text-white/60">
                      {booking.clientName ||
                        (booking.clientUserId ? "—" : "Visiteur")}
                    </span>
                    <span className="mt-auto pt-3 text-xs text-white/50">
                      {normalizeTime(booking.time)}
                      {booking.endTime ? ` → ${booking.endTime}` : ""}
                    </span>
                  </button>
                ) : (
                  <button
                    key={slot}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/admin/reservations?new=1&date=${selectedDate}&time=${encodeURIComponent(slot)}`,
                      )
                    }
                    className="flex min-h-[120px] flex-col items-start justify-between rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-left transition hover:border-pss-pink/40 hover:bg-white/[0.04]"
                  >
                    <span className="font-display text-lg text-white/70">
                      {slotLabel(slot)}
                    </span>
                    <span className="text-xs text-white/40">
                      Libre · cliquer pour réserver
                    </span>
                  </button>
                ),
              )}
            </div>

            {agendaSlots.extras.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Autres créneaux
                </p>
                <ul className="space-y-2">
                  {agendaSlots.extras.map((b) => (
                    <BookingRow
                      key={b.id}
                      b={b}
                      onSelect={(booking) =>
                        navigate(`/admin/reservations?detail=${booking.id}`)
                      }
                    />
                  ))}
                </ul>
              </div>
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
  period,
  onBack,
  onModeChange,
  onPrev,
  onNext,
  onReset,
}: {
  openSidebar: () => void;
  analytics: RevenueAnalytics;
  period: RevenuePeriod;
  onBack: () => void;
  onModeChange: (mode: PeriodMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
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

  const avgTicketCents =
    analytics.totalBookings > 0
      ? Math.round(analytics.totalRevenueCents / analytics.totalBookings)
      : 0;

  const periodWord =
    period.mode === "day" ? "ce jour" : period.mode === "week" ? "cette semaine" : "ce mois";

  const navigate = useNavigate();
  const [showPending, setShowPending] = useState(false);

  /** RDV en attente de paiement, groupés par jour. */
  const pendingGroups = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of analytics.pendingBookings) {
      if (!map.has(b.date)) map.set(b.date, []);
      map.get(b.date)!.push(b);
    }
    return Array.from(map.entries());
  }, [analytics.pendingBookings]);

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
            {period.mode === "day"
              ? "CA du jour"
              : period.mode === "week"
                ? "CA de la semaine"
                : "CA du mois"}
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
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
              {(["day", "week", "month"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onModeChange(mode)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition sm:text-xs ${
                    period.mode === mode
                      ? "bg-pss-pink/15 text-pss-pink"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {PERIOD_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onPrev}
                className="rounded-lg border border-white/10 p-2 text-white/70 transition hover:border-white/20 hover:text-white"
              >
                <Icon name="chevronLeft" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onReset}
                className="min-w-[140px] rounded-lg px-2 py-1.5 text-center text-sm capitalize text-white transition hover:text-pss-pink"
                title="Revenir à la période en cours"
              >
                {analytics.periodLabel}
              </button>
              <button
                type="button"
                onClick={onNext}
                className="rounded-lg border border-white/10 p-2 text-white/70 transition hover:border-white/20 hover:text-white"
              >
                <Icon name="chevronRight" className="h-4 w-4" />
              </button>
            </div>
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
            onClick={() => setShowPending((v) => !v)}
          />
          {period.mode === "day" ? (
            <StatCard
              label="Panier moyen"
              value={fmtEUR(avgTicketCents)}
              hint={analytics.totalBookings > 0 ? "par rendez-vous" : "aucune donnée"}
              icon="chart"
            />
          ) : (
            <StatCard
              label="Jour le plus actif"
              value={busiestDay.count > 0 ? busiestDay.label : "—"}
              hint={busiestDay.count > 0 ? `${busiestDay.count} rendez-vous` : "aucune donnée"}
              icon="calendar"
            />
          )}
        </div>

        {showPending && (
          <div className="rounded-2xl border border-pss-pink/30 bg-white/[0.02] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-sm uppercase tracking-[0.14em] text-white">
                  Paiements en attente
                </h2>
                <p className="mt-1 text-xs text-white/50">
                  {analytics.pendingBookings.length} rendez-vous · {fmtEUR(analytics.pendingCents)}{" "}
                  restant à encaisser {periodWord}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPending(false)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/60 transition hover:border-white/20 hover:text-white"
              >
                Masquer
              </button>
            </div>
            {pendingGroups.length === 0 ? (
              <p className="mt-6 text-sm text-white/55">
                Tout est encaissé {periodWord}.
              </p>
            ) : (
              <div className="mt-4 space-y-5">
                {pendingGroups.map(([date, list]) => (
                  <div key={date}>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/45">
                      {formatLongDate(date)}
                    </p>
                    <ul className="space-y-2">
                      {list.map((b) => (
                        <BookingRow
                          key={b.id}
                          b={b}
                          onSelect={(booking) =>
                            navigate(`/admin/reservations?detail=${booking.id}`)
                          }
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={`grid gap-4 ${period.mode === "day" ? "" : "lg:grid-cols-2"}`}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="font-display text-sm uppercase tracking-[0.14em] text-white">
              Totalité payée — mode de règlement
            </h2>
            <p className="mt-1 text-xs text-white/50">
              {totalPaidFull} prestation(s) entièrement payée(s) {periodWord}
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

          {period.mode !== "day" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <h2 className="font-display text-sm uppercase tracking-[0.14em] text-white">
                Activité par jour de la semaine
              </h2>
              <p className="mt-1 text-xs text-white/50">Nombre de rendez-vous par jour</p>
              {analytics.totalBookings === 0 ? (
                <p className="mt-6 text-sm text-white/55">Aucun rendez-vous {periodWord}.</p>
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
          )}
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
