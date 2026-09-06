// Shared types, utility functions, and UI components for admin pages

import { bookingDurationMinutes } from "./availability";
import { useBodyScrollLock } from "./useBodyScrollLock";

// ====== Types ======

export type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  loyaltyPoints?: number;
  loyaltyProgressCount?: number;
  totalCompletedServices?: number;
  lastServiceName?: string;
  createdAt?: string;
};

export type EditUserState = AdminUser;

export const LOYALTY_CYCLE_POINTS = 1000;
export const LOYALTY_MILESTONES = [
  { points: 300, reward: "–30%", label: "300 pts" },
  { points: 500, reward: "–50%", label: "500 pts" },
  { points: 1000, reward: "Reset", label: "1000 pts" },
] as const;

export type ServiceType = { id: string; name: string };

export type LoyaltyCode = {
  id: string;
  code: string;
  points: number;
  maxUses: number;
  usageCount: number;
  isActive: boolean;
};

export type InspirationImage = {
  id: string;
  originalName?: string;
  contentType?: string;
  thumbUrl: string;
  fullUrl: string;
  createdAt?: string;
};

export type Booking = {
  id: string;
  publicToken: string;
  serviceTypeId: string;
  serviceTypeName: string;
  date: string;
  time: string;
  endTime?: string;
  priceCents: number;
  depositCents: number;
  /** Total encaissé en ligne (acompte, paiements partiels…). */
  paidCents?: number;
  remainingCents?: number;
  /** Le client règle le reliquat en espèces le jour du RDV. */
  cashOnSiteIntent?: boolean;
  description: string;
  inspirationRequired?: boolean;
  inspirationImages?: InspirationImage[];
  paymentStatus: string;
  clientUserId?: string;
  clientName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  visitStatus?: string;
  visitLabelFR?: string;
  visitPointsAwarded?: boolean;
  balancePaidMethod?: string;
  balancePaidLabelFR?: string;
};

export type BookingSummaryDetail = {
  bookingId: string;
  date: string;
  time: string;
  endTime?: string;
  paymentStatus: string;
  visitLabelFR?: string;
  clientUserId?: string;
  clientName: string;
  priceCents: number;
  depositCents: number;
  paidCents?: number;
  description?: string;
  publicToken: string;
};

export type BookingSummaryService = {
  serviceTypeId: string;
  serviceTypeName: string;
  bookingsCount: number;
  peopleCount: number;
  revenueCents: number;
  depositCents: number;
  details: BookingSummaryDetail[];
};

export type PeriodMode = "day" | "week" | "month";

/** Période analysée : un mode + une date (ISO) contenue dans cette période. */
export type RevenuePeriod = { mode: PeriodMode; anchor: string };

export type RevenueAnalytics = {
  periodLabel: string;
  totalBookings: number;
  totalRevenueCents: number;
  collectedCents: number;
  pendingCents: number;
  depositOnlyCount: number;
  pendingCount: number;
  paidFullOnline: number;
  paidFullCash: number;
  paidFullBank: number;
  /** RDV de la période dont il reste quelque chose à encaisser. */
  pendingBookings: Booking[];
  byWeekday: { label: string; count: number; revenueCents: number }[];
  byHour: { hour: string; count: number }[];
  byService: { name: string; count: number; revenueCents: number }[];
};

export type HoursAnalytics = {
  monthLabel: string;
  totalBookings: number;
  totalMinutes: number;
  avgMinutesPerBooking: number;
  byWeekday: { label: string; count: number; minutes: number }[];
  byHour: { hour: string; count: number; minutes: number }[];
  byService: { name: string; count: number; minutes: number }[];
};

// ====== Utility functions ======

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function formatUserCreatedAt(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function userEffectiveTotalCompleted(u: AdminUser): number {
  const fromField = u.totalCompletedServices ?? 0;
  const progress = u.loyaltyProgressCount ?? 0;
  if (fromField > 0) return fromField;
  if (progress > 0) return progress;
  return 0;
}

export function formatUserLoyaltyDisplay(u: AdminUser): {
  serviceName: string | null;
  totalLabel: string | null;
  progressLabel: string | null;
  pointsLabel: string | null;
} {
  const total = userEffectiveTotalCompleted(u);
  const points = u.loyaltyPoints ?? 0;
  const hasLoyaltyActivity = total > 0 || points > 0;
  if (!hasLoyaltyActivity) {
    return { serviceName: null, totalLabel: null, progressLabel: null, pointsLabel: null };
  }
  return {
    serviceName: u.lastServiceName?.trim() || null,
    totalLabel: total > 0 ? `${total} prestation${total > 1 ? "s" : ""} au total` : null,
    progressLabel: `${points}/${LOYALTY_CYCLE_POINTS} pts`,
    pointsLabel: null,
  };
}

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export const PERIOD_MODE_LABELS: Record<PeriodMode, string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
};

/** Bornes inclusives (ISO) de la période contenant l'ancre. */
export function periodRange(p: RevenuePeriod): { start: string; end: string } {
  if (p.mode === "day") return { start: p.anchor, end: p.anchor };
  const d = new Date(p.anchor + "T00:00:00");
  if (p.mode === "week") {
    const start = shiftDate(p.anchor, -((d.getDay() + 6) % 7));
    return { start, end: shiftDate(start, 6) };
  }
  const year = d.getFullYear();
  const month = d.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const mm = String(month + 1).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

export function shiftPeriod(p: RevenuePeriod, delta: number): RevenuePeriod {
  if (p.mode === "day") return { ...p, anchor: shiftDate(p.anchor, delta) };
  if (p.mode === "week") return { ...p, anchor: shiftDate(p.anchor, delta * 7) };
  const d = new Date(p.anchor + "T00:00:00");
  const m = shiftMonth(d.getFullYear(), d.getMonth(), delta);
  return { ...p, anchor: `${m.year}-${String(m.month + 1).padStart(2, "0")}-01` };
}

export function formatPeriodLabel(p: RevenuePeriod): string {
  const { start, end } = periodRange(p);
  const s = new Date(start + "T00:00:00");
  if (p.mode === "day") {
    return s.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  }
  if (p.mode === "week") {
    const e = new Date(end + "T00:00:00");
    const sameMonth = s.getMonth() === e.getMonth();
    const startLabel = s.toLocaleDateString(
      "fr-FR",
      sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" },
    );
    const endLabel = e.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return `${startLabel} – ${endLabel}`;
  }
  return s.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/**
 * Montant réellement encaissé pour une réservation. `paidCents` couvre les
 * paiements partiels ; on retombe sur le statut pour les anciennes résas.
 */
export function bookingCollectedCents(b: {
  paymentStatus: string;
  priceCents: number;
  depositCents: number;
  paidCents?: number;
}): number {
  if (b.paymentStatus === "paid") return b.priceCents;
  if (b.paymentStatus === "deposit_paid") return b.paidCents || b.depositCents;
  return 0;
}

export function computeRevenueAnalytics(
  bookings: Booking[],
  period: RevenuePeriod,
): RevenueAnalytics {
  const { start, end } = periodRange(period);
  const periodBookings = bookings.filter((b) => b.date >= start && b.date <= end);

  let collectedCents = 0;
  let pendingCents = 0;
  let paidFullOnline = 0;
  let paidFullCash = 0;
  let paidFullBank = 0;
  let depositOnlyCount = 0;
  let pendingCount = 0;

  const weekdayCounts = Array(7).fill(0);
  const weekdayRevenue = Array(7).fill(0);
  const hourCounts = new Map<string, number>();
  const serviceMap = new Map<string, { count: number; revenueCents: number }>();
  /** RDV dont il reste quelque chose à encaisser (rien payé ou acompte seul). */
  const pendingBookings: Booking[] = [];

  for (const b of periodBookings) {
    if (b.paymentStatus === "paid") {
      collectedCents += b.priceCents;
      if (!b.balancePaidMethod) paidFullOnline++;
      else if (b.balancePaidMethod === "cash") paidFullCash++;
      else if (b.balancePaidMethod === "bank_transfer") paidFullBank++;
    } else if (b.paymentStatus === "deposit_paid") {
      const collected = bookingCollectedCents(b);
      collectedCents += collected;
      pendingCents += Math.max(0, b.priceCents - collected);
      depositOnlyCount++;
      pendingBookings.push(b);
    } else {
      pendingCents += b.priceCents;
      pendingCount++;
      pendingBookings.push(b);
    }

    const d = new Date(b.date + "T00:00:00");
    const wd = (d.getDay() + 6) % 7;
    weekdayCounts[wd]++;
    weekdayRevenue[wd] += b.priceCents;

    const hour = b.time.slice(0, 2);
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);

    const svc = serviceMap.get(b.serviceTypeName) || { count: 0, revenueCents: 0 };
    svc.count++;
    svc.revenueCents += b.priceCents;
    serviceMap.set(b.serviceTypeName, svc);
  }

  const totalRevenueCents = periodBookings.reduce((s, b) => s + b.priceCents, 0);

  return {
    periodLabel: formatPeriodLabel(period),
    totalBookings: periodBookings.length,
    totalRevenueCents,
    collectedCents,
    pendingCents,
    depositOnlyCount,
    pendingCount,
    paidFullOnline,
    paidFullCash,
    paidFullBank,
    pendingBookings: pendingBookings
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    byWeekday: WEEKDAY_LABELS.map((label, i) => ({
      label,
      count: weekdayCounts[i],
      revenueCents: weekdayRevenue[i],
    })),
    byHour: Array.from(hourCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, count]) => ({ hour, count })),
    byService: Array.from(serviceMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenueCents - a.revenueCents),
  };
}

export function fmtHoursMinutes(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m === 0) return "0 h";
  if (m === 0) return `${h} h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function computeHoursAnalytics(
  bookings: Booking[],
  year: number,
  month: number,
): HoursAnalytics {
  const monthBookings = bookings.filter((b) => {
    const d = new Date(b.date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const weekdayCounts = Array(7).fill(0);
  const weekdayMinutes = Array(7).fill(0);
  const hourMap = new Map<string, { count: number; minutes: number }>();
  const serviceMap = new Map<string, { count: number; minutes: number }>();
  let totalMinutes = 0;

  for (const b of monthBookings) {
    const minutes = bookingDurationMinutes(b.time, b.endTime);
    totalMinutes += minutes;

    const d = new Date(b.date + "T00:00:00");
    const wd = (d.getDay() + 6) % 7;
    weekdayCounts[wd]++;
    weekdayMinutes[wd] += minutes;

    const hour = b.time.slice(0, 2);
    const hourEntry = hourMap.get(hour) || { count: 0, minutes: 0 };
    hourEntry.count++;
    hourEntry.minutes += minutes;
    hourMap.set(hour, hourEntry);

    const svc = serviceMap.get(b.serviceTypeName) || { count: 0, minutes: 0 };
    svc.count++;
    svc.minutes += minutes;
    serviceMap.set(b.serviceTypeName, svc);
  }

  return {
    monthLabel: new Date(year, month, 1).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    }),
    totalBookings: monthBookings.length,
    totalMinutes,
    avgMinutesPerBooking:
      monthBookings.length > 0 ? Math.round(totalMinutes / monthBookings.length) : 0,
    byWeekday: WEEKDAY_LABELS.map((label, i) => ({
      label,
      count: weekdayCounts[i],
      minutes: weekdayMinutes[i],
    })),
    byHour: Array.from(hourMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, v]) => ({ hour, ...v })),
    byService: Array.from(serviceMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.minutes - a.minutes),
  };
}

export function eurToCents(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function fmtEUR(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function paymentStatusLabel(status: string) {
  switch (status) {
    case "deposit_paid":
      return "Acompte payé";
    case "paid":
      return "Totalité payée";
    case "pending":
      return "En attente de paiement";
    default:
      return status;
  }
}

export function paymentStatusTone(status: string) {
  if (status === "paid") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (status === "deposit_paid") return "bg-amber-500/15 text-amber-200 border-amber-400/30";
  return "bg-white/5 text-white/60 border-white/15";
}

export function visitTone(status?: string) {
  if (status === "completed") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (status === "in_progress") return "bg-pss-pink/15 text-pss-pink border-pss-pink/30";
  return "bg-white/5 text-white/60 border-white/15";
}

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 10);
}

export function shiftDate(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 10);
}

export function formatLongDate(iso: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function canCompleteService(b: Booking) {
  return (
    (b.paymentStatus === "deposit_paid" || b.paymentStatus === "paid") &&
    b.visitStatus !== "completed" &&
    b.visitPointsAwarded !== true
  );
}

// ====== UI Components ======

export function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const paths: Record<string, JSX.Element> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
      </>
    ),
    sparkles: (
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16z" />
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6M15 20c0-2.4 2-4.5 4.5-4.5" />
      </>
    ),
    scissors: (
      <>
        <circle cx="6" cy="7" r="3" />
        <circle cx="6" cy="17" r="3" />
        <path d="M8.5 8.5L20 20M8.5 15.5L20 4M14 12l6 6" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </>
    ),
    chevronLeft: <path d="M15 6l-6 6 6 6" />,
    chevronRight: <path d="M9 6l6 6-6 6" />,
    logout: (
      <>
        <path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4" />
        <path d="M10 17l-5-5 5-5M5 12h12" />
      </>
    ),
    close: <path d="M6 6l12 12M6 18L18 6" />,
    qr: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM21 14v7M14 21h7" />
      </>
    ),
    check: <path d="M5 12l5 5L20 7" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    euro: (
      <>
        <path d="M18 7a7 7 0 100 10M4 10h10M4 14h10" />
      </>
    ),
    edit: (
      <>
        <path d="M4 20h4l10-10-4-4L4 16v4z" />
        <path d="M14 6l4 4" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 012-2h10" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </>
    ),
    external: (
      <>
        <path d="M14 4h6v6M20 4l-8 8" />
        <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useBodyScrollLock(true);
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 px-3 py-4 sm:items-center sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#0c0c10] p-4 shadow-2xl sm:p-6 ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg uppercase tracking-[0.1em] text-white">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-xs text-white/45">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-white/55">
      <span className="mb-1.5 block uppercase tracking-[0.14em]">{label}</span>
      {children}
    </label>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border bg-white/[0.02] p-4 text-left md:p-5 ${
        accent
          ? "border-pss-pink/40 shadow-[0_0_30px_rgba(244,63,155,0.15)]"
          : "border-white/10"
      } ${onClick ? "cursor-pointer transition hover:border-pss-pink/50 hover:bg-white/[0.04]" : ""}`}
    >
      <div
        className={`absolute -right-4 -top-4 flex h-14 w-14 items-center justify-center rounded-full md:-right-6 md:-top-6 md:h-20 md:w-20 ${
          accent ? "bg-pss-pink/10 text-pss-pink" : "bg-white/5 text-white/30"
        }`}
      >
        <Icon name={icon} className="h-5 w-5 md:h-7 md:w-7" />
      </div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/45 md:text-xs">{label}</p>
      <p className="mt-2 font-display text-2xl tracking-tight text-white md:mt-3 md:text-3xl">
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] text-white/50 md:text-xs">{hint}</p>}
    </Tag>
  );
}

export function BarRow({
  label,
  value,
  max,
  display,
  color = "bg-pss-pink",
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  color?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2 text-sm">
        <span className="text-white/75">{label}</span>
        <span className="font-medium text-white">{display}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-white/45">{label}</dt>
      <dd className="text-right font-medium text-white">{value}</dd>
    </div>
  );
}

export function BookingRow({ b, onSelect }: { b: Booking; onSelect: (b: Booking) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(b)}
        className="group flex w-full items-stretch gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-pss-pink/40 hover:bg-white/[0.04] sm:gap-4 sm:p-4"
      >
        <div className="flex min-w-[60px] flex-col items-center justify-center rounded-lg bg-gradient-to-b from-pss-pink/20 to-pss-pink/5 px-2 py-2 ring-1 ring-pss-pink/20 sm:min-w-[72px] sm:px-3">
          <span className="font-display text-base text-white sm:text-xl">{b.time}</span>
          {b.endTime && (
            <span className="text-[9px] uppercase tracking-[0.14em] text-white/55 sm:text-[10px]">
              → {b.endTime}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <p className="truncate text-sm font-medium text-white sm:text-base">
              {b.serviceTypeName}
            </p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${paymentStatusTone(b.paymentStatus)}`}
            >
              {paymentStatusLabel(b.paymentStatus)}
            </span>
            {b.visitLabelFR && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${visitTone(b.visitStatus)}`}
              >
                {b.visitLabelFR}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-white/65 sm:text-sm">
            {b.clientName || (b.clientUserId ? "—" : "Visiteur (pas de compte)")}
          </p>
          <p className="mt-1 font-display text-sm text-white sm:hidden">
            {fmtEUR(b.priceCents)}
          </p>
        </div>
        <div className="hidden flex-col items-end justify-center text-right sm:flex">
          <span className="font-display text-lg text-white">{fmtEUR(b.priceCents)}</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">
            {b.paymentStatus === "deposit_paid"
              ? `Payé ${fmtEUR(bookingCollectedCents(b))} · reste ${fmtEUR(
                  Math.max(0, b.priceCents - bookingCollectedCents(b)),
                )}`
              : `Acompte ${fmtEUR(b.depositCents)}`}
          </span>
        </div>
      </button>
    </li>
  );
}
