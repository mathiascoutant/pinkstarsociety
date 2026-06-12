// Shared types, utility functions, and UI components for admin pages

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

export type EditUserState = AdminUser & { loyaltyCycleProgress: number };

export type ServiceType = { id: string; name: string };

export type LoyaltyCode = {
  id: string;
  code: string;
  points: number;
  maxUses: number;
  usageCount: number;
  isActive: boolean;
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
  description: string;
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

export type RevenueAnalytics = {
  monthLabel: string;
  totalBookings: number;
  totalRevenueCents: number;
  collectedCents: number;
  pendingCents: number;
  depositOnlyCount: number;
  pendingCount: number;
  paidFullOnline: number;
  paidFullCash: number;
  paidFullBank: number;
  byWeekday: { label: string; count: number; revenueCents: number }[];
  byHour: { hour: string; count: number }[];
  byService: { name: string; count: number; revenueCents: number }[];
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

export function userLoyaltyCycleProgress(u: AdminUser): number {
  const total = userEffectiveTotalCompleted(u);
  const progress = u.loyaltyProgressCount ?? 0;
  if (progress === 0 && total > 0 && total % 10 === 0) return 10;
  return progress;
}

export function formatUserLoyaltyDisplay(u: AdminUser): {
  serviceName: string | null;
  totalLabel: string | null;
  progressLabel: string | null;
  pointsLabel: string | null;
} {
  const total = userEffectiveTotalCompleted(u);
  const progress = u.loyaltyProgressCount ?? 0;
  const points = u.loyaltyPoints ?? 0;
  const hasLoyaltyActivity = total > 0 || progress > 0 || points > 0;
  if (!hasLoyaltyActivity) {
    return { serviceName: null, totalLabel: null, progressLabel: null, pointsLabel: null };
  }
  const cycleProgress = userLoyaltyCycleProgress(u);
  return {
    serviceName: u.lastServiceName?.trim() || null,
    totalLabel: total > 0 ? `${total} prestation${total > 1 ? "s" : ""} au total` : null,
    progressLabel: `Fidélité ${cycleProgress}/10`,
    pointsLabel: points > 0 ? `${points} pts` : null,
  };
}

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function computeRevenueAnalytics(
  bookings: Booking[],
  year: number,
  month: number,
): RevenueAnalytics {
  const monthBookings = bookings.filter((b) => {
    const d = new Date(b.date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() === month;
  });

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

  for (const b of monthBookings) {
    if (b.paymentStatus === "paid") {
      collectedCents += b.priceCents;
      if (!b.balancePaidMethod) paidFullOnline++;
      else if (b.balancePaidMethod === "cash") paidFullCash++;
      else if (b.balancePaidMethod === "bank_transfer") paidFullBank++;
    } else if (b.paymentStatus === "deposit_paid") {
      collectedCents += b.depositCents;
      pendingCents += b.priceCents - b.depositCents;
      depositOnlyCount++;
    } else {
      pendingCents += b.priceCents;
      pendingCount++;
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

  const totalRevenueCents = monthBookings.reduce((s, b) => s + b.priceCents, 0);

  return {
    monthLabel: new Date(year, month, 1).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    }),
    totalBookings: monthBookings.length,
    totalRevenueCents,
    collectedCents,
    pendingCents,
    depositOnlyCount,
    pendingCount,
    paidFullOnline,
    paidFullCash,
    paidFullBank,
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
      return "En attente";
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
            Acompte {fmtEUR(b.depositCents)}
          </span>
        </div>
      </button>
    </li>
  );
}
