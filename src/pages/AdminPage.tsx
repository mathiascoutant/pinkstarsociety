import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { QrScannerModal } from "../components/QrScannerModal";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type AdminUser = {
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

function formatUserCreatedAt(iso?: string) {
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

function formatUserLoyaltyDisplay(u: AdminUser): {
  serviceName: string | null;
  totalLabel: string | null;
  progressLabel: string | null;
  pointsLabel: string | null;
} {
  const totalFromBookings = u.totalCompletedServices ?? 0;
  const progress = u.loyaltyProgressCount ?? 0;
  const points = u.loyaltyPoints ?? 0;

  const hasLoyaltyActivity =
    totalFromBookings > 0 || progress > 0 || points > 0;

  if (!hasLoyaltyActivity) {
    return {
      serviceName: null,
      totalLabel: null,
      progressLabel: null,
      pointsLabel: null,
    };
  }

  const total =
    totalFromBookings > 0
      ? totalFromBookings
      : progress > 0
        ? progress
        : 0;

  const cycleProgress =
    progress === 0 && total > 0 && total % 10 === 0 ? 10 : progress;

  return {
    serviceName: u.lastServiceName?.trim() || null,
    totalLabel:
      total > 0
        ? `${total} prestation${total > 1 ? "s" : ""} au total`
        : null,
    progressLabel: `Fidélité ${cycleProgress}/10`,
    pointsLabel: points > 0 ? `${points} pts` : null,
  };
}

type ServiceType = { id: string; name: string };
type LoyaltyCode = {
  id: string;
  code: string;
  points: number;
  maxUses: number;
  usageCount: number;
  isActive: boolean;
};

type Booking = {
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

type BookingSummaryDetail = {
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

type BookingSummaryService = {
  serviceTypeId: string;
  serviceTypeName: string;
  bookingsCount: number;
  peopleCount: number;
  revenueCents: number;
  depositCents: number;
  details: BookingSummaryDetail[];
};

type Section =
  | "dashboard"
  | "bookings"
  | "services"
  | "loyalty"
  | "users"
  | "stats";

function eurToCents(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

function fmtEUR(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function paymentStatusLabel(status: string) {
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

function paymentStatusTone(status: string) {
  if (status === "paid") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (status === "deposit_paid") return "bg-amber-500/15 text-amber-200 border-amber-400/30";
  return "bg-white/5 text-white/60 border-white/15";
}

function visitTone(status?: string) {
  if (status === "completed") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (status === "in_progress") return "bg-pss-pink/15 text-pss-pink border-pss-pink/30";
  return "bg-white/5 text-white/60 border-white/15";
}

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 10);
}

function formatLongDate(iso: string) {
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

function canScanClientQR(b: Booking) {
  return (
    (b.paymentStatus === "deposit_paid" || b.paymentStatus === "paid") &&
    b.visitStatus === "pending_validation"
  );
}

function scanBlockedReason(b: Booking): string | null {
  if (canScanClientQR(b)) return null;
  if (b.paymentStatus !== "deposit_paid" && b.paymentStatus !== "paid") {
    return "En attente de paiement : l’acompte ou la totalité doit être encaissé.";
  }
  if (b.visitStatus === "completed") {
    return "Prestation terminée — points fidélité attribués.";
  }
  if (b.visitStatus === "in_progress") {
    if (!b.visitPointsAwarded) {
      return "Présence enregistrée. Utilise « Fin de prestation » pour créditer les points.";
    }
    return "Les points fidélité ont déjà été crédités.";
  }
  return "Scan indisponible.";
}

function canCompleteService(b: Booking) {
  return (
    b.visitStatus === "in_progress" &&
    b.visitPointsAwarded !== true
  );
}

function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-white/45">{label}</dt>
      <dd className="text-right font-medium text-white">{value}</dd>
    </div>
  );
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [section, setSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loyaltyCodes, setLoyaltyCodes] = useState<LoyaltyCode[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [summaryServices, setSummaryServices] = useState<BookingSummaryService[]>([]);
  const [summaryPeriod, setSummaryPeriod] = useState<"all" | "month" | "last_30_days">(
    "month",
  );
  const [expandedSummaryServiceId, setExpandedSummaryServiceId] = useState<string | null>(
    null,
  );
  const [bookingFilter, setBookingFilter] = useState<"all" | "upcoming" | "past">("upcoming");
  const [bookingSearch, setBookingSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [err, setErr] = useState<string | null>(null);

  const [showNewBooking, setShowNewBooking] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [editService, setEditService] = useState<ServiceType | null>(null);
  const [newLoyaltyCode, setNewLoyaltyCode] = useState("");
  const [newLoyaltyPoints, setNewLoyaltyPoints] = useState("");
  const [newLoyaltyMaxUses, setNewLoyaltyMaxUses] = useState("");
  const [editLoyaltyCode, setEditLoyaltyCode] = useState<LoyaltyCode | null>(null);

  const [bServiceId, setBServiceId] = useState("");
  const [bDate, setBDate] = useState("");
  const [bTime, setBTime] = useState("");
  const [bEndTime, setBEndTime] = useState("");
  const [bPrice, setBPrice] = useState("");
  const [bDeposit, setBDeposit] = useState("");
  const [bDesc, setBDesc] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [scanBookingId, setScanBookingId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const scanTargetRef = useRef<string | null>(null);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [completeModalPhase, setCompleteModalPhase] = useState<
    null | "balance_payment" | "confirm"
  >(null);
  const [completeBalanceMethod, setCompleteBalanceMethod] = useState<
    "cash" | "bank_transfer" | null
  >(null);
  const [completeServiceBusy, setCompleteServiceBusy] = useState(false);

  const loadBookings = useCallback(async () => {
    const r = await api<{ bookings: Booking[] }>("/admin/bookings");
    setBookings(r.bookings);
  }, []);

  const loadServices = useCallback(async () => {
    const r = await api<{ serviceTypes: ServiceType[] }>("/admin/service-types");
    setServices(r.serviceTypes);
  }, []);

  const loadAll = useCallback(async () => {
    setErr(null);
    try {
      await Promise.all([
        loadBookings(),
        loadServices(),
        api<{ users: AdminUser[] }>("/admin/users").then((r) => setUsers(r.users)),
        api<{ loyaltyCodes: LoyaltyCode[] }>("/admin/loyalty-codes").then((r) =>
          setLoyaltyCodes(r.loyaltyCodes),
        ),
      ]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }, [loadBookings, loadServices]);

  const loadSummary = useCallback(async () => {
    try {
      const r = await api<{ services: BookingSummaryService[] }>(
        `/admin/bookings/summary?period=${summaryPeriod}`,
      );
      setSummaryServices(r.services);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }, [summaryPeriod]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const detailId = detailBooking?.id;
  useEffect(() => {
    if (!detailId) return;
    const next = bookings.find((x) => x.id === detailId);
    if (!next) setDetailBooking(null);
    else setDetailBooking(next);
  }, [bookings, detailId]);

  useEffect(() => {
    if (!detailBooking) {
      setCompleteModalPhase(null);
      setCompleteBalanceMethod(null);
    }
  }, [detailBooking]);

  // ====== Dérivés ======
  const today = todayISO();

  const dayBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.date === selectedDate)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [bookings, selectedDate],
  );

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
    const monthRevenue = bookings
      .filter((b) => {
        const d = new Date(b.date + "T00:00:00");
        return (
          d.getMonth() === start.getMonth() && d.getFullYear() === start.getFullYear()
        );
      })
      .reduce((s, b) => s + b.priceCents, 0);
    const pendingCount = bookings.filter((b) => b.paymentStatus === "pending").length;
    return { todayCount, weekCount, monthRevenue, pendingCount };
  }, [bookings, today]);

  const filteredBookings = useMemo(() => {
    const now = today;
    let list = bookings;
    if (bookingFilter === "upcoming") list = list.filter((b) => b.date >= now);
    if (bookingFilter === "past") list = list.filter((b) => b.date < now);
    if (bookingSearch.trim()) {
      const q = bookingSearch.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.serviceTypeName.toLowerCase().includes(q) ||
          (b.clientName || "").toLowerCase().includes(q) ||
          b.date.includes(q),
      );
    }
    return list
      .slice()
      .sort((a, b) =>
        bookingFilter === "past"
          ? b.date.localeCompare(a.date) || b.time.localeCompare(a.time)
          : a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
      );
  }, [bookings, bookingFilter, bookingSearch, today]);

  // ====== Actions ======
  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    setCreatedUrl(null);
    setErr(null);
    try {
      const r = await api<{ publicUrl: string }>("/admin/bookings", {
        method: "POST",
        body: JSON.stringify({
          serviceTypeId: bServiceId,
          date: bDate,
          time: bTime,
          endTime: bEndTime.trim() || undefined,
          priceCents: eurToCents(bPrice),
          depositCents: eurToCents(bDeposit),
          description: bDesc,
        }),
      });
      setCreatedUrl(r.publicUrl);
      setBDesc("");
      setBPrice("");
      setBDeposit("");
      setBTime("");
      setBEndTime("");
      void loadBookings();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erreur");
    }
  }

  async function deleteBooking(id: string) {
    if (!confirm("Supprimer cette réservation ?")) return;
    await api(`/admin/bookings/${id}`, { method: "DELETE" });
    void loadBookings();
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    await api("/admin/service-types", {
      method: "POST",
      body: JSON.stringify({ name: newServiceName }),
    });
    setNewServiceName("");
    void loadServices();
  }

  async function saveService() {
    if (!editService) return;
    await api(`/admin/service-types/${editService.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editService.name }),
    });
    setEditService(null);
    void loadServices();
  }

  async function deleteService(id: string) {
    if (!confirm("Supprimer ce type de prestation ?")) return;
    await api(`/admin/service-types/${id}`, { method: "DELETE" });
    void loadServices();
  }

  async function addLoyaltyCode(e: React.FormEvent) {
    e.preventDefault();
    await api("/admin/loyalty-codes", {
      method: "POST",
      body: JSON.stringify({
        code: newLoyaltyCode,
        points: Number(newLoyaltyPoints),
        maxUses: Number(newLoyaltyMaxUses),
      }),
    });
    setNewLoyaltyCode("");
    setNewLoyaltyPoints("");
    setNewLoyaltyMaxUses("");
    const r = await api<{ loyaltyCodes: LoyaltyCode[] }>("/admin/loyalty-codes");
    setLoyaltyCodes(r.loyaltyCodes);
  }

  async function saveLoyaltyCode() {
    if (!editLoyaltyCode) return;
    await api(`/admin/loyalty-codes/${editLoyaltyCode.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        code: editLoyaltyCode.code,
        points: editLoyaltyCode.points,
        maxUses: editLoyaltyCode.maxUses,
        isActive: editLoyaltyCode.isActive,
      }),
    });
    setEditLoyaltyCode(null);
    const r = await api<{ loyaltyCodes: LoyaltyCode[] }>("/admin/loyalty-codes");
    setLoyaltyCodes(r.loyaltyCodes);
  }

  async function deleteLoyaltyCode(id: string) {
    if (!confirm("Supprimer ce code fidélité ?")) return;
    await api(`/admin/loyalty-codes/${id}`, { method: "DELETE" });
    const r = await api<{ loyaltyCodes: LoyaltyCode[] }>("/admin/loyalty-codes");
    setLoyaltyCodes(r.loyaltyCodes);
  }

  async function deleteUser(id: string) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    await api(`/admin/users/${id}`, { method: "DELETE" });
    const r = await api<{ users: AdminUser[] }>("/admin/users");
    setUsers(r.users);
  }

  async function saveUser() {
    if (!editUser) return;
    await api(`/admin/users/${editUser.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        firstName: editUser.firstName,
        lastName: editUser.lastName,
        email: editUser.email,
        role: editUser.role,
      }),
    });
    setEditUser(null);
    const r = await api<{ users: AdminUser[] }>("/admin/users");
    setUsers(r.users);
  }

  // ====== Layout ======
  const navItems: { key: Section; label: string; icon: string }[] = [
    { key: "dashboard", label: "Tableau de bord", icon: "dashboard" },
    { key: "bookings", label: "Réservations", icon: "calendar" },
    { key: "stats", label: "Statistiques", icon: "chart" },
    { key: "services", label: "Prestations", icon: "scissors" },
    { key: "loyalty", label: "Fidélité", icon: "sparkles" },
    { key: "users", label: "Utilisateurs", icon: "users" },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050507] text-white">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col transform border-r border-white/10 bg-[#0a0a0d]/95 backdrop-blur-xl transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link to="/" className="font-display text-lg uppercase tracking-[0.16em]">
            Pink<span className="text-pss-pink">Star</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/60 hover:text-white"
          >
            <Icon name="close" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setSection(item.key);
                setSidebarOpen(false);
              }}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                section === item.key
                  ? "bg-pss-pink/15 text-white shadow-[inset_0_0_0_1px_rgba(244,63,155,0.3)]"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon name={item.icon} className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
          <Link
            to="/admin/disponibilites"
            className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/70 transition hover:border-pss-pink/40 hover:text-white"
          >
            <Icon name="clock" className="h-4 w-4 shrink-0" />
            <span>Disponibilités</span>
          </Link>
        </nav>
        <div className="m-3 shrink-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-white/50">Connecté</p>
          <p className="mt-0.5 truncate text-sm text-white">{user?.email}</p>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/70 transition hover:border-pss-pink/40 hover:text-white"
          >
            <Icon name="logout" className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="min-w-0 lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#050507]/90 px-4 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-white/70 shrink-0"
            >
              <Icon name="menu" />
            </button>
            <h1 className="truncate font-display text-base uppercase tracking-[0.14em] sm:text-lg">
              {navItems.find((n) => n.key === section)?.label || "Admin"}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {section === "bookings" && (
              <button
                type="button"
                onClick={() => setShowNewBooking(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-[#ffb6dd] via-pss-pink to-pss-hot px-3 py-2 text-xs font-medium text-white shadow-[0_0_24px_rgba(244,63,155,0.4)] transition hover:brightness-110 sm:px-4 sm:text-sm"
              >
                <Icon name="plus" className="h-4 w-4" />
                <span className="hidden sm:inline">Nouveau RDV</span>
                <span className="sm:hidden">RDV</span>
              </button>
            )}
          </div>
        </header>

        <main className="px-3 py-6 sm:px-4 md:px-8 md:py-8">
          {err && (
            <div className="mb-6 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {err}
            </div>
          )}

          {section === "dashboard" && (
            <Dashboard
              stats={stats}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              dayBookings={dayBookings}
              onSelect={(b) => setDetailBooking(b)}
              today={today}
            />
          )}

          {section === "bookings" && (
            <BookingsList
              bookings={filteredBookings}
              filter={bookingFilter}
              setFilter={setBookingFilter}
              search={bookingSearch}
              setSearch={setBookingSearch}
              onSelect={(b) => setDetailBooking(b)}
              onDelete={deleteBooking}
            />
          )}

          {section === "stats" && (
            <StatsView
              services={summaryServices}
              period={summaryPeriod}
              setPeriod={setSummaryPeriod}
              expandedId={expandedSummaryServiceId}
              setExpandedId={setExpandedSummaryServiceId}
            />
          )}

          {section === "services" && (
            <ServicesView
              services={services}
              newName={newServiceName}
              setNewName={setNewServiceName}
              onAdd={addService}
              onEdit={(s) => setEditService({ ...s })}
              onDelete={deleteService}
            />
          )}

          {section === "loyalty" && (
            <LoyaltyView
              codes={loyaltyCodes}
              code={newLoyaltyCode}
              setCode={setNewLoyaltyCode}
              points={newLoyaltyPoints}
              setPoints={setNewLoyaltyPoints}
              maxUses={newLoyaltyMaxUses}
              setMaxUses={setNewLoyaltyMaxUses}
              onAdd={addLoyaltyCode}
              onEdit={(lc) => setEditLoyaltyCode({ ...lc })}
              onDelete={deleteLoyaltyCode}
            />
          )}

          {section === "users" && (
            <UsersView
              users={users}
              currentUserId={user?.id || ""}
              onEdit={(u) => setEditUser({ ...u })}
              onDelete={deleteUser}
            />
          )}
        </main>
      </div>

      {/* New Booking Modal */}
      {showNewBooking && (
        <Modal
          title="Nouveau rendez-vous"
          onClose={() => {
            setShowNewBooking(false);
            setCreatedUrl(null);
          }}
        >
          <form onSubmit={createBooking} className="space-y-4">
            <Field label="Type de prestation">
              <select
                required
                value={bServiceId}
                onChange={(e) => setBServiceId(e.target.value)}
                className="input"
              >
                <option value="">— Choisir —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input
                  type="date"
                  required
                  value={bDate}
                  onChange={(e) => setBDate(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Heure début">
                <input
                  type="time"
                  required
                  value={bTime}
                  onChange={(e) => setBTime(e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Heure de fin (interne)">
              <input
                type="time"
                value={bEndTime}
                onChange={(e) => setBEndTime(e.target.value)}
                className="input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prix (€)">
                <input
                  required
                  value={bPrice}
                  onChange={(e) => setBPrice(e.target.value)}
                  placeholder="120"
                  className="input"
                />
              </Field>
              <Field label="Acompte (€)">
                <input
                  required
                  value={bDeposit}
                  onChange={(e) => setBDeposit(e.target.value)}
                  placeholder="40"
                  className="input"
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                value={bDesc}
                onChange={(e) => setBDesc(e.target.value)}
                rows={3}
                className="input"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewBooking(false)}
                className="rounded-lg px-4 py-2 text-sm text-white/70 hover:bg-white/5"
              >
                Annuler
              </button>
              <button type="submit" className="btn-pink">
                Créer
              </button>
            </div>
            {createdUrl && (
              <div className="rounded-xl border border-pss-pink/30 bg-pss-pink/10 p-3 text-sm">
                <p className="text-white/70">Lien public à partager :</p>
                <div className="mt-2 flex gap-2">
                  <input
                    readOnly
                    value={createdUrl}
                    className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-white/20 px-3 py-1 text-xs uppercase"
                    onClick={() => void navigator.clipboard.writeText(createdUrl)}
                  >
                    Copier
                  </button>
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* Edit service */}
      {editService && (
        <Modal title="Modifier prestation" onClose={() => setEditService(null)}>
          <input
            value={editService.name}
            onChange={(e) =>
              setEditService({ ...editService, name: e.target.value })
            }
            className="input"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditService(null)}
              className="rounded-lg px-3 py-2 text-sm text-white/60"
            >
              Annuler
            </button>
            <button type="button" onClick={() => void saveService()} className="btn-pink">
              Enregistrer
            </button>
          </div>
        </Modal>
      )}

      {/* Edit loyalty */}
      {editLoyaltyCode && (
        <Modal title="Modifier code fidélité" onClose={() => setEditLoyaltyCode(null)}>
          <div className="space-y-3">
            <input
              value={editLoyaltyCode.code}
              onChange={(e) =>
                setEditLoyaltyCode({
                  ...editLoyaltyCode,
                  code: e.target.value.toUpperCase(),
                })
              }
              className="input"
              placeholder="Code"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                value={editLoyaltyCode.points}
                onChange={(e) =>
                  setEditLoyaltyCode({
                    ...editLoyaltyCode,
                    points: Number(e.target.value),
                  })
                }
                className="input"
                placeholder="Points"
              />
              <input
                type="number"
                min={1}
                value={editLoyaltyCode.maxUses}
                onChange={(e) =>
                  setEditLoyaltyCode({
                    ...editLoyaltyCode,
                    maxUses: Number(e.target.value),
                  })
                }
                className="input"
                placeholder="Utilisations max"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={editLoyaltyCode.isActive}
                onChange={(e) =>
                  setEditLoyaltyCode({
                    ...editLoyaltyCode,
                    isActive: e.target.checked,
                  })
                }
              />
              Code actif
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditLoyaltyCode(null)}
              className="rounded-lg px-3 py-2 text-sm text-white/60"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void saveLoyaltyCode()}
              className="btn-pink"
            >
              Enregistrer
            </button>
          </div>
        </Modal>
      )}

      {/* Edit user */}
      {editUser && (
        <Modal title="Modifier utilisateur" onClose={() => setEditUser(null)}>
          <div className="space-y-3">
            <input
              value={editUser.firstName}
              onChange={(e) =>
                setEditUser({ ...editUser, firstName: e.target.value })
              }
              className="input"
              placeholder="Prénom"
            />
            <input
              value={editUser.lastName}
              onChange={(e) =>
                setEditUser({ ...editUser, lastName: e.target.value })
              }
              className="input"
              placeholder="Nom"
            />
            <input
              value={editUser.email}
              onChange={(e) =>
                setEditUser({ ...editUser, email: e.target.value })
              }
              className="input"
              placeholder="Email"
            />
            <select
              value={editUser.role}
              onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
              className="input"
            >
              <option value="client">client</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditUser(null)}
              className="rounded-lg px-3 py-2 text-sm text-white/60"
            >
              Annuler
            </button>
            <button type="button" onClick={() => void saveUser()} className="btn-pink">
              Enregistrer
            </button>
          </div>
        </Modal>
      )}

      {/* Detail booking */}
      {detailBooking && (
        <Modal
          title={detailBooking.serviceTypeName}
          subtitle="Détail du rendez-vous"
          onClose={() => setDetailBooking(null)}
          wide
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <dl className="space-y-3 text-sm">
                <DetailRow label="Date" value={detailBooking.date} />
                <DetailRow label="Heure début" value={detailBooking.time} />
                <DetailRow
                  label="Heure fin"
                  value={detailBooking.endTime?.trim() || "—"}
                />
                <DetailRow
                  label="Montant total"
                  value={fmtEUR(detailBooking.priceCents)}
                />
                <DetailRow
                  label="Acompte"
                  value={fmtEUR(detailBooking.depositCents)}
                />
                <DetailRow
                  label="Paiement"
                  value={paymentStatusLabel(detailBooking.paymentStatus)}
                />
                <DetailRow
                  label="Visite"
                  value={detailBooking.visitLabelFR || "—"}
                />
                <DetailRow
                  label="Client lié"
                  value={
                    detailBooking.clientUserId
                      ? detailBooking.clientName?.trim() || "—"
                      : "Non"
                  }
                />
                {!detailBooking.clientUserId &&
                  (detailBooking.guestFirstName ||
                    detailBooking.guestLastName ||
                    detailBooking.guestEmail) && (
                    <>
                      <DetailRow
                        label="Prénom (visiteur)"
                        value={detailBooking.guestFirstName?.trim() || "—"}
                      />
                      <DetailRow
                        label="Nom (visiteur)"
                        value={detailBooking.guestLastName?.trim() || "—"}
                      />
                      <DetailRow
                        label="E-mail (visiteur)"
                        value={detailBooking.guestEmail?.trim() || "—"}
                      />
                    </>
                  )}
                {detailBooking.balancePaidLabelFR && (
                  <DetailRow
                    label="Solde réglé"
                    value={detailBooking.balancePaidLabelFR}
                  />
                )}
              </dl>
              {detailBooking.description && (
                <div className="mt-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                    Description
                  </p>
                  <p className="mt-1 text-sm text-white/75">
                    {detailBooking.description}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Lien public client
                </p>
                <a
                  href={`${window.location.origin}/reservation/${detailBooking.publicToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block break-all text-sm text-pss-pink hover:underline"
                >
                  {`${window.location.origin}/reservation/${detailBooking.publicToken}`}
                </a>
              </div>

              {(detailBooking.paymentStatus === "deposit_paid" ||
                detailBooking.paymentStatus === "paid") && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                    Factures PDF
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {detailBooking.paymentStatus === "deposit_paid" && (
                      <a
                        className="block rounded-lg border border-white/15 px-3 py-2 text-center text-sm text-white/85 transition hover:border-pss-pink/50"
                        href={`/api/public/bookings/${detailBooking.publicToken}/facture.pdf`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Facture (acompte)
                      </a>
                    )}
                    {detailBooking.paymentStatus === "paid" && (
                      <>
                        <a
                          className="block rounded-lg border border-white/15 px-3 py-2 text-center text-sm text-white/85 transition hover:border-pss-pink/50"
                          href={`/api/public/bookings/${detailBooking.publicToken}/facture.pdf?variant=deposit`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Facture — acompte
                        </a>
                        <a
                          className="block rounded-lg border border-pss-pink/35 bg-pss-pink/10 px-3 py-2 text-center text-sm text-pss-pink transition hover:bg-pss-pink/15"
                          href={`/api/public/bookings/${detailBooking.publicToken}/facture.pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Facture — totalité
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Actions
                </p>
                {scanBlockedReason(detailBooking) && (
                  <p className="mt-2 text-xs text-amber-200/90">
                    {scanBlockedReason(detailBooking)}
                  </p>
                )}
                <div className="mt-3 flex flex-col gap-2">
                  {detailBooking.visitStatus !== "in_progress" &&
                    detailBooking.visitStatus !== "completed" && (
                      <button
                        type="button"
                        disabled={!canScanClientQR(detailBooking)}
                        onClick={() => {
                          if (!canScanClientQR(detailBooking)) return;
                          setScanMessage(null);
                          scanTargetRef.current = detailBooking.id;
                          setScanBookingId(detailBooking.id);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ffb6dd] via-pss-pink to-pss-hot px-4 py-2 text-sm font-medium text-white shadow-[0_0_24px_rgba(244,63,155,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                      >
                        <Icon name="qr" className="h-4 w-4" /> Scanner le QR
                      </button>
                    )}
                  {canCompleteService(detailBooking) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompleteBalanceMethod(null);
                        if (detailBooking.paymentStatus === "paid") {
                          setCompleteModalPhase("confirm");
                        } else {
                          setCompleteModalPhase("balance_payment");
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/25"
                    >
                      <Icon name="check" className="h-4 w-4" /> Fin de prestation
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteBooking(detailBooking.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/20"
                  >
                    <Icon name="trash" className="h-4 w-4" /> Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {completeModalPhase && detailBooking && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/85 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c10] p-6 shadow-xl">
            {completeModalPhase === "balance_payment" ? (
              <>
                <h2 className="font-display text-lg uppercase tracking-[0.1em] text-white">
                  Règlement du solde
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-white/75">
                  Le paiement total n&apos;a pas été réglé en ligne. Comment le solde a-t-il
                  été payé <strong className="text-white">sur place</strong> ?
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setCompleteBalanceMethod("cash")}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium uppercase tracking-[0.1em] transition ${
                      completeBalanceMethod === "cash"
                        ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                        : "border-white/15 text-white/80 hover:border-white/30"
                    }`}
                  >
                    Espèces
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompleteBalanceMethod("bank_transfer")}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium uppercase tracking-[0.1em] transition ${
                      completeBalanceMethod === "bank_transfer"
                        ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                        : "border-white/15 text-white/80 hover:border-white/30"
                    }`}
                  >
                    Virement
                  </button>
                </div>
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCompleteModalPhase(null);
                      setCompleteBalanceMethod(null);
                    }}
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/75 hover:bg-white/5"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={!completeBalanceMethod}
                    className="btn-pink disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => setCompleteModalPhase("confirm")}
                  >
                    Continuer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-lg uppercase tracking-[0.1em] text-white">
                  Clôturer la prestation
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-white/75">
                  Confirmer la fin de prestation ? Les points fidélité seront crédités.
                </p>
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  {detailBooking.paymentStatus !== "paid" && (
                    <button
                      type="button"
                      onClick={() => setCompleteModalPhase("balance_payment")}
                      className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/75 hover:bg-white/5"
                    >
                      Retour
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCompleteModalPhase(null);
                      setCompleteBalanceMethod(null);
                    }}
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/75 hover:bg-white/5"
                  >
                    Non
                  </button>
                  <button
                    type="button"
                    disabled={completeServiceBusy}
                    className="btn-pink disabled:opacity-50"
                    onClick={() => {
                      const id = detailBooking.id;
                      const needsMethod = detailBooking.paymentStatus !== "paid";
                      if (needsMethod && !completeBalanceMethod) return;
                      setCompleteServiceBusy(true);
                      void (async () => {
                        try {
                          const body =
                            needsMethod && completeBalanceMethod
                              ? JSON.stringify({
                                  balancePaidMethod: completeBalanceMethod,
                                })
                              : "{}";
                          const r = await api<{
                            pointsAdded: number;
                            totalPoints: number;
                          }>(`/admin/bookings/${id}/complete-service`, {
                            method: "POST",
                            body,
                          });
                          setCompleteModalPhase(null);
                          setCompleteBalanceMethod(null);
                          setScanMessage(
                            `Prestation clôturée — +${r.pointsAdded} pts (solde : ${r.totalPoints}).`,
                          );
                          void loadBookings();
                        } catch (e) {
                          setScanMessage(
                            e instanceof Error ? e.message : "Clôture impossible",
                          );
                        } finally {
                          setCompleteServiceBusy(false);
                        }
                      })();
                    }}
                  >
                    {completeServiceBusy ? "En cours…" : "Oui, terminer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <QrScannerModal
        open={scanBookingId !== null}
        onClose={() => {
          scanTargetRef.current = null;
          setScanBookingId(null);
        }}
        onResult={(text) => {
          const id = scanTargetRef.current;
          scanTargetRef.current = null;
          setScanBookingId(null);
          if (!id) return;
          void (async () => {
            try {
              const r = await api<{
                clientName: string;
                pointsPending: number;
                totalPoints: number;
              }>(`/admin/bookings/${id}/verify-arrival`, {
                method: "POST",
                body: JSON.stringify({ scanned: text }),
              });
              setScanMessage(
                `Présence enregistrée — ${r.clientName}. ${r.pointsPending} pts crédités après « Fin de prestation ».`,
              );
              void loadBookings();
            } catch (e) {
              setScanMessage(
                e instanceof Error ? e.message : "Erreur de vérification",
              );
            }
          })();
        }}
      />

      {scanMessage && (
        <div className="fixed bottom-6 left-1/2 z-[160] max-w-md -translate-x-1/2 rounded-xl border border-white/15 bg-[#0c0c10] px-4 py-3 text-center text-sm text-white shadow-xl">
          {scanMessage}
          <button
            type="button"
            className="ml-3 text-xs text-pss-pink hover:underline"
            onClick={() => setScanMessage(null)}
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}

// ====== Sub-components ======

function Modal({
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-white/55">
      <span className="mb-1.5 block uppercase tracking-[0.14em]">{label}</span>
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white/[0.02] p-4 md:p-5 ${
        accent
          ? "border-pss-pink/40 shadow-[0_0_30px_rgba(244,63,155,0.15)]"
          : "border-white/10"
      }`}
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
    </div>
  );
}

function Dashboard({
  stats,
  selectedDate,
  setSelectedDate,
  dayBookings,
  onSelect,
  today,
}: {
  stats: { todayCount: number; weekCount: number; monthRevenue: number; pendingCount: number };
  selectedDate: string;
  setSelectedDate: (s: string) => void;
  dayBookings: Booking[];
  onSelect: (b: Booking) => void;
  today: string;
}) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
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
          icon="clock"
        />
        <StatCard
          label="CA du mois"
          value={fmtEUR(stats.monthRevenue)}
          hint="encaissable"
          icon="euro"
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
            </div>
          ) : (
            <ul className="space-y-3">
              {dayBookings.map((b) => (
                <BookingRow key={b.id} b={b} onSelect={onSelect} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function BookingRow({ b, onSelect }: { b: Booking; onSelect: (b: Booking) => void }) {
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
          <span className="font-display text-lg text-white">
            {fmtEUR(b.priceCents)}
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">
            Acompte {fmtEUR(b.depositCents)}
          </span>
        </div>
      </button>
    </li>
  );
}

function BookingsList({
  bookings,
  filter,
  setFilter,
  search,
  setSearch,
  onSelect,
  onDelete,
}: {
  bookings: Booking[];
  filter: "all" | "upcoming" | "past";
  setFilter: (f: "all" | "upcoming" | "past") => void;
  search: string;
  setSearch: (s: string) => void;
  onSelect: (b: Booking) => void;
  onDelete: (id: string) => void;
}) {
  // Group by date
  const groups = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (!map.has(b.date)) map.set(b.date, []);
      map.get(b.date)!.push(b);
    }
    return Array.from(map.entries());
  }, [bookings]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px]">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-pss-pink/40 focus:outline-none"
          />
        </div>
        <div className="inline-flex w-full rounded-xl border border-white/10 bg-white/[0.02] p-1 sm:w-auto">
          {(["upcoming", "past", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition sm:flex-none ${
                filter === f
                  ? "bg-pss-pink/15 text-pss-pink"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {f === "upcoming" ? "À venir" : f === "past" ? "Passés" : "Tous"}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/55">
          Aucune réservation.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, list]) => (
            <div key={date}>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">
                {formatLongDate(date)}
              </p>
              <ul className="space-y-2">
                {list.map((b) => (
                  <li key={b.id} className="group relative">
                    <BookingRow b={b} onSelect={onSelect} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(b.id);
                      }}
                      className="absolute right-3 top-3 rounded-lg p-1.5 text-white/40 transition hover:bg-red-500/15 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100"
                      title="Supprimer"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsView({
  services,
  period,
  setPeriod,
  expandedId,
  setExpandedId,
}: {
  services: BookingSummaryService[];
  period: "all" | "month" | "last_30_days";
  setPeriod: (p: "all" | "month" | "last_30_days") => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  const total = services.reduce((s, x) => s + x.revenueCents, 0);
  const totalCount = services.reduce((s, x) => s + x.bookingsCount, 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/55">
          {totalCount} prestation(s) · {fmtEUR(total)}
        </p>
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.02] p-1">
          {(["month", "last_30_days", "all"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${
                period === p
                  ? "bg-pss-pink/15 text-pss-pink"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {p === "month" ? "Ce mois" : p === "last_30_days" ? "30 jours" : "Tout"}
            </button>
          ))}
        </div>
      </div>
      {services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/55">
          Aucune donnée sur cette période.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {services
            .slice()
            .sort((a, b) => b.bookingsCount - a.bookingsCount)
            .map((s) => {
              const expanded = expandedId === s.serviceTypeId;
              return (
                <li
                  key={s.serviceTypeId}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expanded ? null : s.serviceTypeId)
                    }
                    className="w-full p-5 text-left transition hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{s.serviceTypeName}</p>
                      <span className="font-display text-xl text-pss-pink">
                        {fmtEUR(s.revenueCents)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-white/55">
                      {s.peopleCount} pers. · {s.bookingsCount} prestation(s)
                    </p>
                  </button>
                  {expanded && (
                    <ul className="border-t border-white/10 bg-black/20 p-3">
                      {s.details.map((d) => (
                        <li
                          key={d.bookingId}
                          className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-white/75"
                        >
                          <p>
                            {d.date} · {d.time}
                            {d.endTime ? ` → ${d.endTime}` : ""} ·{" "}
                            {fmtEUR(d.priceCents)}
                          </p>
                          <p className="mt-0.5 text-white/50">
                            {d.clientName} · {paymentStatusLabel(d.paymentStatus)} ·{" "}
                            {d.visitLabelFR || "—"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}

function ServicesView({
  services,
  newName,
  setNewName,
  onAdd,
  onEdit,
  onDelete,
}: {
  services: ServiceType[];
  newName: string;
  setNewName: (s: string) => void;
  onAdd: (e: React.FormEvent) => void;
  onEdit: (s: ServiceType) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="max-w-2xl space-y-5">
      <form
        onSubmit={onAdd}
        className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom de la prestation"
          className="flex-1 rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm focus:outline-none"
          required
        />
        <button type="submit" className="btn-pink">
          <Icon name="plus" className="h-4 w-4" /> Ajouter
        </button>
      </form>
      {services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/55">
          Aucune prestation.
        </div>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
            >
              <span className="text-white">{s.name}</span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-pss-pink"
                  onClick={() => onEdit(s)}
                >
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-white/60 hover:bg-red-500/10 hover:text-red-300"
                  onClick={() => onDelete(s.id)}
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LoyaltyView({
  codes,
  code,
  setCode,
  points,
  setPoints,
  maxUses,
  setMaxUses,
  onAdd,
  onEdit,
  onDelete,
}: {
  codes: LoyaltyCode[];
  code: string;
  setCode: (s: string) => void;
  points: string;
  setPoints: (s: string) => void;
  maxUses: string;
  setMaxUses: (s: string) => void;
  onAdd: (e: React.FormEvent) => void;
  onEdit: (lc: LoyaltyCode) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="max-w-3xl space-y-5">
      <form
        onSubmit={onAdd}
        className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 md:grid-cols-[1fr_auto_auto_auto]"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          className="input"
          required
        />
        <input
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder="Points"
          className="input md:w-32"
          required
        />
        <input
          type="number"
          min={1}
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          placeholder="Max usages"
          className="input md:w-32"
          required
        />
        <button type="submit" className="btn-pink">
          Créer
        </button>
      </form>
      {codes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/55">
          Aucun code fidélité.
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {codes.map((lc) => (
            <li
              key={lc.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
            >
              <div>
                <p className="font-display text-base tracking-[0.1em] text-pss-pink">
                  {lc.code}
                </p>
                <p className="mt-1 text-xs text-white/55">
                  {lc.points} pts · {lc.usageCount}/{lc.maxUses} ·{" "}
                  <span
                    className={lc.isActive ? "text-emerald-300" : "text-white/40"}
                  >
                    {lc.isActive ? "Actif" : "Inactif"}
                  </span>
                </p>
              </div>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-pss-pink"
                  onClick={() => onEdit(lc)}
                >
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-white/60 hover:bg-red-500/10 hover:text-red-300"
                  onClick={() => onDelete(lc.id)}
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UsersView({
  users,
  currentUserId,
  onEdit,
  onDelete,
}: {
  users: AdminUser[];
  currentUserId: string;
  onEdit: (u: AdminUser) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.14em] text-white/45">
          <tr>
            <th className="px-4 py-3 font-normal">Nom</th>
            <th className="px-4 py-3 font-normal">Email</th>
            <th className="px-4 py-3 font-normal">Rôle</th>
            <th className="px-4 py-3 font-normal">Création</th>
            <th className="px-4 py-3 font-normal">Fidélité</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const loyalty = formatUserLoyaltyDisplay(u);
            return (
            <tr
              key={u.id}
              className="border-t border-white/5 transition hover:bg-white/[0.02]"
            >
              <td className="px-4 py-3 text-white">
                {u.firstName} {u.lastName}
              </td>
              <td className="px-4 py-3 text-white/70">{u.email}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                    u.role === "admin"
                      ? "border-pss-pink/40 bg-pss-pink/10 text-pss-pink"
                      : "border-white/15 bg-white/5 text-white/70"
                  }`}
                >
                  {u.role}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-white/60">
                {formatUserCreatedAt(u.createdAt)}
              </td>
              <td className="px-4 py-3">
                {loyalty.progressLabel ? (
                  <div className="space-y-0.5">
                    {loyalty.serviceName && (
                      <p className="font-medium text-white">{loyalty.serviceName}</p>
                    )}
                    {loyalty.totalLabel && (
                      <p className="text-xs text-white/50">{loyalty.totalLabel}</p>
                    )}
                    <p className="text-xs font-medium text-pss-pink">
                      {loyalty.progressLabel}
                    </p>
                    {loyalty.pointsLabel && (
                      <p className="text-xs text-white/40">{loyalty.pointsLabel}</p>
                    )}
                  </div>
                ) : (
                  <span className="text-white/30">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-pss-pink"
                  onClick={() => onEdit(u)}
                >
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                {u.id !== currentUserId && (
                  <button
                    type="button"
                    className="ml-1 rounded-lg p-2 text-white/60 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => onDelete(u.id)}
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                )}
              </td>
            </tr>
          );
          })}
        </tbody>
      </table>
    </div>
  );
}
