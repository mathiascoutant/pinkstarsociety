import { useCallback, useEffect, useRef, useState } from "react";
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
};

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
  /** HH:MM — réservé admin, pas exposé au client */
  endTime?: string;
  priceCents: number;
  depositCents: number;
  description: string;
  paymentStatus: string;
  clientUserId?: string;
  /** Prénom + nom (API admin liste) */
  clientName?: string;
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
      return "En attente de paiement";
    default:
      return status;
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-white/45">{label}</dt>
      <dd className="text-right font-medium text-white">{value}</dd>
    </div>
  );
}

function canScanClientQR(b: Booking) {
  return (
    !!b.clientUserId &&
    (b.paymentStatus === "deposit_paid" || b.paymentStatus === "paid") &&
    b.visitStatus === "pending_validation"
  );
}

function scanBlockedReason(b: Booking): string | null {
  if (canScanClientQR(b)) return null;
  if (!b.clientUserId) {
    return "Aucun client lié : le client doit régler depuis son compte connecté (pas en « visiteur »).";
  }
  if (b.paymentStatus !== "deposit_paid" && b.paymentStatus !== "paid") {
    return "En attente de paiement : l’acompte ou la totalité doit être encaissé.";
  }
  if (b.visitStatus === "completed") {
    return "Prestation terminée — les points fidélité ont été attribués.";
  }
  if (b.visitStatus === "in_progress") {
    if (!b.visitPointsAwarded) {
      return "Présence enregistrée. Utilise « Fin de prestation » pour créditer les points fidélité.";
    }
    return "Les points fidélité ont déjà été crédités pour cette prestation.";
  }
  if (b.visitStatus !== "pending_validation") {
    return "Statut de visite inattendu — impossible de scanner pour l’instant.";
  }
  return "Scan indisponible.";
}

function canCompleteService(b: Booking) {
  return (
    b.visitStatus === "in_progress" &&
    b.visitPointsAwarded !== true &&
    !!b.clientUserId
  );
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<"users" | "services" | "bookings" | "loyalty">("bookings");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loyaltyCodes, setLoyaltyCodes] = useState<LoyaltyCode[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingFilter, setBookingFilter] = useState<"all" | "upcoming" | "past">("all");
  const [summaryPeriod, setSummaryPeriod] = useState<"all" | "month" | "last_30_days">("all");
  const [summaryServices, setSummaryServices] = useState<BookingSummaryService[]>([]);
  const [expandedSummaryServiceId, setExpandedSummaryServiceId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  const load = useCallback(async () => {
    setErr(null);
    try {
      if (tab === "users") {
        const r = await api<{ users: AdminUser[] }>("/admin/users");
        setUsers(r.users);
      }
      if (tab === "services") {
        const r = await api<{ serviceTypes: ServiceType[] }>(
          "/admin/service-types",
        );
        setServices(r.serviceTypes);
      }
      if (tab === "loyalty") {
        const r = await api<{ loyaltyCodes: LoyaltyCode[] }>("/admin/loyalty-codes");
        setLoyaltyCodes(r.loyaltyCodes);
      }
      if (tab === "bookings") {
        const q =
          bookingFilter === "all" ? "" : `?when=${bookingFilter}`;
        const r = await api<{ bookings: Booking[] }>(`/admin/bookings${q}`);
        setBookings(r.bookings);
        const summary = await api<{ services: BookingSummaryService[] }>(
          `/admin/bookings/summary?period=${summaryPeriod}`,
        );
        setSummaryServices(summary.services);
        const st = await api<{ serviceTypes: ServiceType[] }>(
          "/admin/service-types",
        );
        setServices(st.serviceTypes);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }, [tab, bookingFilter, summaryPeriod]);

  useEffect(() => {
    void load();
  }, [load]);

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
      void load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erreur");
    }
  }

  async function deleteBooking(id: string) {
    if (!confirm("Supprimer cette réservation ?")) return;
    await api(`/admin/bookings/${id}`, { method: "DELETE" });
    void load();
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    await api("/admin/service-types", {
      method: "POST",
      body: JSON.stringify({ name: newServiceName }),
    });
    setNewServiceName("");
    void load();
  }

  async function saveService() {
    if (!editService) return;
    await api(`/admin/service-types/${editService.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editService.name }),
    });
    setEditService(null);
    void load();
  }

  async function deleteService(id: string) {
    if (!confirm("Supprimer ce type de prestation ?")) return;
    await api(`/admin/service-types/${id}`, { method: "DELETE" });
    void load();
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
    void load();
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
    void load();
  }

  async function deleteLoyaltyCode(id: string) {
    if (!confirm("Supprimer ce code fidélité ?")) return;
    await api(`/admin/loyalty-codes/${id}`, { method: "DELETE" });
    void load();
  }

  async function deleteUser(id: string) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    await api(`/admin/users/${id}`, { method: "DELETE" });
    void load();
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
    void load();
  }

  return (
    <div className="min-h-screen bg-[#050507] px-4 py-10 text-white md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-[0.14em]">
              Administration
            </h1>
            <p className="text-sm text-white/55">
              {user?.email} ·{" "}
              <button
                type="button"
                onClick={() => logout()}
                className="text-pss-pink hover:underline"
              >
                Déconnexion
              </button>
            </p>
          </div>
          <Link
            to="/"
            className="text-sm uppercase tracking-[0.18em] text-white/45 hover:text-white"
          >
            Site
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-2 border-b border-white/10 pb-4">
          {(
            [
              ["bookings", "Réservations"],
              ["services", "Prestations"],
              ["loyalty", "Codes fidélité"],
              ["users", "Utilisateurs"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.16em] ${
                tab === k
                  ? "bg-pss-pink text-[#050507]"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
          <Link
            to="/admin/disponibilites"
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-pss-pink/40 bg-pss-pink/15 px-4 py-2 text-xs uppercase tracking-[0.16em] text-pss-pink transition hover:bg-pss-pink/25"
          >
            Disponibilités
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h14M13 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>

        {err && (
          <p className="mt-6 text-sm text-red-400" role="alert">
            {err}
          </p>
        )}

        {tab === "bookings" && (
          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-sm uppercase tracking-[0.2em] text-white/45">
                Nouvelle réservation
              </h2>
              <form onSubmit={createBooking} className="mt-4 space-y-3">
                <label className="block text-xs text-white/50">
                  Type de prestation
                  <select
                    required
                    value={bServiceId}
                    onChange={(e) => setBServiceId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <option value="">—</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-white/50">
                    Date
                    <input
                      type="date"
                      required
                      value={bDate}
                      onChange={(e) => setBDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                    />
                  </label>
                  <label className="text-xs text-white/50">
                    Heure début
                    <input
                      type="time"
                      required
                      value={bTime}
                      onChange={(e) => setBTime(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                    />
                  </label>
                </div>
                <label className="block text-xs text-white/50">
                  Heure de fin (optionnel — visible uniquement ici, pas pour le client)
                  <input
                    type="time"
                    value={bEndTime}
                    onChange={(e) => setBEndTime(e.target.value)}
                    className="mt-1 w-full max-w-[200px] rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-white/50">
                    Prix (€)
                    <input
                      required
                      value={bPrice}
                      onChange={(e) => setBPrice(e.target.value)}
                      placeholder="120"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                    />
                  </label>
                  <label className="text-xs text-white/50">
                    Acompte (€)
                    <input
                      required
                      value={bDeposit}
                      onChange={(e) => setBDeposit(e.target.value)}
                      placeholder="40"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                    />
                  </label>
                </div>
                <label className="text-xs text-white/50">
                  Description
                  <textarea
                    value={bDesc}
                    onChange={(e) => setBDesc(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  />
                </label>
                <button type="submit" className="btn-pink">
                  Valider
                </button>
              </form>
              {createdUrl && (
                <div className="mt-4 rounded-xl border border-pss-pink/30 bg-pss-pink/5 p-4 text-sm">
                  <p className="text-white/70">Lien public (copier) :</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      readOnly
                      value={createdUrl}
                      className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-white/20 px-3 py-1 text-xs uppercase"
                      onClick={() =>
                        void navigator.clipboard.writeText(createdUrl)
                      }
                    >
                      Copier
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm uppercase tracking-[0.2em] text-white/45">
                    Statistiques prestations
                  </h2>
                  <select
                    value={summaryPeriod}
                    onChange={(e) =>
                      setSummaryPeriod(e.target.value as typeof summaryPeriod)
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                  >
                    <option value="all">Toutes périodes</option>
                    <option value="month">Ce mois</option>
                    <option value="last_30_days">30 derniers jours</option>
                  </select>
                </div>
                <ul className="mt-4 space-y-3">
                  {summaryServices.length === 0 && (
                    <li className="rounded-lg border border-white/5 px-3 py-2 text-xs text-white/45">
                      Aucune réservation sur cette période.
                    </li>
                  )}
                  {summaryServices
                    .slice()
                    .sort((a, b) => b.bookingsCount - a.bookingsCount)
                    .map((s) => {
                      const expanded = expandedSummaryServiceId === s.serviceTypeId;
                      return (
                        <li
                          key={s.serviceTypeId}
                          className="rounded-lg border border-white/10 bg-black/20"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSummaryServiceId(expanded ? null : s.serviceTypeId)
                            }
                            className="w-full px-3 py-3 text-left"
                          >
                            <p className="font-medium text-white">{s.serviceTypeName}</p>
                            <p className="mt-1 text-xs text-white/60">
                              {s.peopleCount} personne(s) · {s.bookingsCount} prestation(s)
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              Total encaissable : {fmtEUR(s.revenueCents)}
                            </p>
                          </button>
                          {expanded && (
                            <ul className="border-t border-white/10 px-3 py-2 text-xs">
                              {s.details.map((d) => (
                                <li
                                  key={d.bookingId}
                                  className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-2 text-white/80"
                                >
                                  <p>
                                    {d.date} · {d.time}
                                    {d.endTime ? ` → ${d.endTime}` : ""} · {fmtEUR(d.priceCents)}
                                  </p>
                                  <p className="mt-1 text-white/55">
                                    Client: {d.clientName} · {paymentStatusLabel(d.paymentStatus)} ·{" "}
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
              </div>

              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm uppercase tracking-[0.2em] text-white/45">
                  Liste
                </h2>
                <select
                  value={bookingFilter}
                  onChange={(e) =>
                    setBookingFilter(e.target.value as typeof bookingFilter)
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                >
                  <option value="all">Toutes</option>
                  <option value="upcoming">À venir</option>
                  <option value="past">Passées</option>
                </select>
              </div>
              <ul className="mt-4 space-y-3">
                {bookings.map((b) => {
                  const publicUrl = `${window.location.origin}/reservation/${b.publicToken}`;
                  return (
                    <li
                      key={b.id}
                      className="rounded-xl border border-white/10 bg-white/[0.03] text-sm transition hover:border-pss-pink/35"
                    >
                      <button
                        type="button"
                        onClick={() => setDetailBooking(b)}
                        className="w-full p-4 text-left"
                      >
                        <p className="font-medium text-white underline-offset-4 hover:underline">
                          {b.serviceTypeName}
                        </p>
                        <p className="mt-1 text-xs text-white/35">
                          Cliquer pour le détail et le scan QR
                        </p>
                        <p className="mt-2 text-white/60">
                          {b.date} · {b.time}
                          {b.endTime ? ` → ${b.endTime}` : ""} · {fmtEUR(b.priceCents)}{" "}
                          · {paymentStatusLabel(b.paymentStatus)}
                        </p>
                        <p className="mt-1 text-xs text-pss-pink/90">
                          Visite : {b.visitLabelFR || "—"}
                          {b.clientUserId
                            ? b.clientName
                              ? ` · ${b.clientName}`
                              : ""
                            : " · (pas de client lié)"}
                        </p>
                      </button>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-4 py-2">
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-pss-pink/80 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Ouvrir le lien client
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteBooking(b.id);
                          }}
                          className="text-xs text-red-400 hover:underline"
                        >
                          Supprimer
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {tab === "services" && (
          <div className="mt-8 max-w-xl">
            <form onSubmit={addService} className="flex gap-2">
              <input
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="Nom de la prestation"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                required
              />
              <button type="submit" className="btn-pink">
                Ajouter
              </button>
            </form>
            <ul className="mt-6 space-y-2">
              {services.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
                >
                  <span>{s.name}</span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-pss-pink"
                      onClick={() => setEditService({ ...s })}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-400"
                      onClick={() => void deleteService(s.id)}
                    >
                      Supprimer
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "loyalty" && (
          <div className="mt-8 max-w-3xl">
            <form onSubmit={addLoyaltyCode} className="grid gap-2 md:grid-cols-4">
              <input
                value={newLoyaltyCode}
                onChange={(e) => setNewLoyaltyCode(e.target.value.toUpperCase())}
                placeholder="Code"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                required
              />
              <input
                type="number"
                min={1}
                value={newLoyaltyPoints}
                onChange={(e) => setNewLoyaltyPoints(e.target.value)}
                placeholder="Points"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                required
              />
              <input
                type="number"
                min={1}
                value={newLoyaltyMaxUses}
                onChange={(e) => setNewLoyaltyMaxUses(e.target.value)}
                placeholder="Utilisations max"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                required
              />
              <button type="submit" className="btn-pink md:col-span-3 md:w-fit">
                Créer le code
              </button>
            </form>
            <ul className="mt-6 space-y-2">
              {loyaltyCodes.map((lc) => (
                <li
                  key={lc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2"
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      <span className="text-pss-pink">{lc.code}</span>
                    </p>
                    <p className="text-white/60">
                      {lc.points} pts · {lc.usageCount}/{lc.maxUses} usages ·{" "}
                      {lc.isActive ? "Actif" : "Inactif"}
                    </p>
                  </div>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-pss-pink"
                      onClick={() => setEditLoyaltyCode({ ...lc })}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-400"
                      onClick={() => void deleteLoyaltyCode(lc.id)}
                    >
                      Supprimer
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "users" && (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-white/45">
                  <th className="pb-2">Nom</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Rôle</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-white/10">
                    <td className="py-2">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{u.role}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="text-pss-pink"
                        onClick={() => setEditUser({ ...u })}
                      >
                        Modifier
                      </button>
                      {u.id !== user?.id && (
                        <button
                          type="button"
                          className="ml-3 text-red-400"
                          onClick={() => void deleteUser(u.id)}
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0c10] p-6">
            <h3 className="font-medium">Modifier prestation</h3>
            <input
              value={editService.name}
              onChange={(e) =>
                setEditService({ ...editService, name: e.target.value })
              }
              className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
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
          </div>
        </div>
      )}

      {editLoyaltyCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0c10] p-6 space-y-3">
            <h3 className="font-medium">Modifier code fidélité</h3>
            <input
              value={editLoyaltyCode.code}
              onChange={(e) =>
                setEditLoyaltyCode({
                  ...editLoyaltyCode,
                  code: e.target.value.toUpperCase(),
                })
              }
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
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
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
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
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
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
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditLoyaltyCode(null)}
                className="rounded-lg px-3 py-2 text-sm text-white/60"
              >
                Annuler
              </button>
              <button type="button" onClick={() => void saveLoyaltyCode()} className="btn-pink">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {detailBooking && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-booking-detail-title"
          onClick={() => setDetailBooking(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0c0c10] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="admin-booking-detail-title"
              className="font-display text-lg uppercase tracking-[0.1em] text-white"
            >
              {detailBooking.serviceTypeName}
            </h2>
            <p className="mt-1 text-xs text-white/45">Détail du rendez-vous</p>

            <dl className="mt-6 space-y-3 text-sm">
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
                value={
                  detailBooking.visitLabelFR ||
                  "—"
                }
              />
              <DetailRow
                label="Client lié"
                value={
                  detailBooking.clientUserId
                    ? (detailBooking.clientName?.trim() || "—")
                    : "Non"
                }
              />
              {detailBooking.balancePaidLabelFR && (
                <DetailRow
                  label="Solde réglé"
                  value={detailBooking.balancePaidLabelFR}
                />
              )}
            </dl>

            {detailBooking.description && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Description
                </p>
                <p className="mt-1 text-sm text-white/75">
                  {detailBooking.description}
                </p>
              </div>
            )}

            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                Lien public (client)
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
              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-3">
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
                      Télécharger la facture (acompte)
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
                        Facture — totalité réglée
                      </a>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-white/10 pt-6">
              <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                Scanner le QR du client
              </p>
              {scanBlockedReason(detailBooking) && (
                <p className="mt-2 text-sm text-amber-200/90">
                  {scanBlockedReason(detailBooking)}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!canScanClientQR(detailBooking)}
                  onClick={() => {
                    if (!canScanClientQR(detailBooking)) return;
                    setScanMessage(null);
                    scanTargetRef.current = detailBooking.id;
                    setScanBookingId(detailBooking.id);
                  }}
                  className="btn-pink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Scanner le QR code
                </button>
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
                    className="rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-4 py-2 text-sm font-medium uppercase tracking-[0.12em] text-emerald-200 transition hover:bg-emerald-500/25"
                  >
                    Fin de prestation
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailBooking(null)}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {completeModalPhase && detailBooking && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/85 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={
            completeModalPhase === "balance_payment"
              ? "complete-balance-title"
              : "complete-service-title"
          }
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c10] p-6 shadow-xl">
            {completeModalPhase === "balance_payment" ? (
              <>
                <h2
                  id="complete-balance-title"
                  className="font-display text-lg uppercase tracking-[0.1em] text-white"
                >
                  Règlement du solde
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-white/75">
                  Le paiement total n&apos;a pas été réglé en ligne. Comment le client a-t-il payé le
                  solde <strong className="text-white">sur place</strong> ?
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
                    Virement bancaire
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
                <h2
                  id="complete-service-title"
                  className="font-display text-lg uppercase tracking-[0.1em] text-white"
                >
                  Clôturer la prestation
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-white/75">
                  Es-tu sûr de vouloir <strong className="text-white">mettre fin à la prestation</strong> ?
                  Les points fidélité seront alors{" "}
                  <strong className="text-white">crédités sur le compte client</strong>.
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
                            `Prestation clôturée — +${r.pointsAdded} points fidélité crédités (solde client : ${r.totalPoints}).`,
                          );
                          if (tab === "bookings") void load();
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
                `Présence enregistrée — ${r.clientName}. Les points (${r.pointsPending}) seront crédités après « Fin de prestation ».`,
              );
              if (tab === "bookings") void load();
            } catch (e) {
              setScanMessage(
                e instanceof Error ? e.message : "Erreur de vérification",
              );
            }
          })();
        }}
      />
      {scanMessage && (
        <div className="fixed bottom-6 left-1/2 z-[160] max-w-md -translate-x-1/2 rounded-xl border border-white/15 bg-[#0c0c10] px-4 py-3 text-center text-sm text-white shadow-lg">
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

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0c10] p-6 space-y-3">
            <h3 className="font-medium">Modifier utilisateur</h3>
            <input
              value={editUser.firstName}
              onChange={(e) =>
                setEditUser({ ...editUser, firstName: e.target.value })
              }
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              placeholder="Prénom"
            />
            <input
              value={editUser.lastName}
              onChange={(e) =>
                setEditUser({ ...editUser, lastName: e.target.value })
              }
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              placeholder="Nom"
            />
            <input
              value={editUser.email}
              onChange={(e) =>
                setEditUser({ ...editUser, email: e.target.value })
              }
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              placeholder="Email"
            />
            <select
              value={editUser.role}
              onChange={(e) =>
                setEditUser({ ...editUser, role: e.target.value })
              }
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            >
              <option value="client">client</option>
              <option value="admin">admin</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
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
          </div>
        </div>
      )}
    </div>
  );
}
