import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { bookingsOverlap } from "../lib/availability";
import {
  Booking,
  BookingRow,
  DetailRow,
  Field,
  Icon,
  Modal,
  ServiceType,
  canCompleteService,
  eurToCents,
  fmtEUR,
  formatLongDate,
  paymentStatusLabel,
  todayISO,
} from "../lib/adminShared";

export default function AdminBookingsPage() {
  const { openSidebar } = useOutletContext<{ openSidebar: () => void }>();
  const [searchParams] = useSearchParams();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [bookingFilter, setBookingFilter] = useState<"all" | "upcoming" | "past">("upcoming");
  const [bookingSearch, setBookingSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // New booking modal
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [bServiceId, setBServiceId] = useState("");
  const [bDate, setBDate] = useState("");
  const [bTime, setBTime] = useState("");
  const [bEndTime, setBEndTime] = useState("");
  const [bPrice, setBPrice] = useState("");
  const [bDeposit, setBDeposit] = useState("");
  const [bDesc, setBDesc] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  // Detail booking modal
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);

  // Complete service modal
  const [completeModalPhase, setCompleteModalPhase] = useState<
    null | "balance_payment" | "confirm"
  >(null);
  const [completeBalanceMethod, setCompleteBalanceMethod] = useState<
    "cash" | "bank_transfer" | null
  >(null);
  const [completeServiceBusy, setCompleteServiceBusy] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Reschedule modal
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleEndTime, setRescheduleEndTime] = useState("");
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleErr, setRescheduleErr] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    const r = await api<{ bookings: Booking[] }>("/admin/bookings");
    setBookings(r.bookings);
  }, []);

  useEffect(() => {
    setErr(null);
    Promise.all([
      api<{ bookings: Booking[] }>("/admin/bookings").then((r) => setBookings(r.bookings)),
      api<{ serviceTypes: ServiceType[] }>("/admin/service-types").then((r) =>
        setServices(r.serviceTypes),
      ),
    ]).catch((e) => setErr(e instanceof Error ? e.message : "Erreur"));
  }, []);

  // Auto-open detail from URL param (e.g. coming from dashboard)
  useEffect(() => {
    const detailId = searchParams.get("detail");
    if (detailId && bookings.length > 0) {
      const found = bookings.find((b) => b.id === detailId);
      if (found) setDetailBooking(found);
    }
  }, [searchParams, bookings]);

  // Sync detail booking with latest data
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

  const today = todayISO();

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (bookingFilter === "upcoming") list = list.filter((b) => b.date >= today);
    if (bookingFilter === "past") list = list.filter((b) => b.date < today);
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

  const groups = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of filteredBookings) {
      if (!map.has(b.date)) map.set(b.date, []);
      map.get(b.date)!.push(b);
    }
    return Array.from(map.entries());
  }, [filteredBookings]);

  const rescheduleConflict = useMemo<Booking | null>(() => {
    if (!detailBooking || !rescheduleDate || !rescheduleTime) return null;
    const candidate = {
      date: rescheduleDate,
      time: rescheduleTime,
      endTime: rescheduleEndTime || undefined,
    };
    for (const b of bookings) {
      if (b.id === detailBooking.id) continue;
      if (b.paymentStatus !== "deposit_paid" && b.paymentStatus !== "paid") continue;
      if (bookingsOverlap(candidate, { date: b.date, time: b.time, endTime: b.endTime })) {
        return b;
      }
    }
    return null;
  }, [bookings, detailBooking, rescheduleDate, rescheduleTime, rescheduleEndTime]);

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

  function openReschedule(b: Booking) {
    setRescheduleDate(b.date);
    setRescheduleTime(b.time);
    setRescheduleEndTime(b.endTime ?? "");
    setRescheduleErr(null);
    setShowReschedule(true);
  }

  async function submitReschedule() {
    if (!detailBooking) return;
    setRescheduleBusy(true);
    setRescheduleErr(null);
    try {
      await api(`/admin/bookings/${detailBooking.id}/reschedule`, {
        method: "POST",
        body: JSON.stringify({
          date: rescheduleDate,
          time: rescheduleTime,
          endTime: rescheduleEndTime,
        }),
      });
      setShowReschedule(false);
      setDetailBooking({
        ...detailBooking,
        date: rescheduleDate,
        time: rescheduleTime,
        endTime: rescheduleEndTime || undefined,
      });
      void loadBookings();
    } catch (e) {
      setRescheduleErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRescheduleBusy(false);
    }
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
            Réservations
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowNewBooking(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-[#ffb6dd] via-pss-pink to-pss-hot px-3 py-2 text-xs font-medium text-white shadow-[0_0_24px_rgba(244,63,155,0.4)] transition hover:brightness-110 sm:px-4 sm:text-sm"
        >
          <Icon name="plus" className="h-4 w-4" />
          <span className="hidden sm:inline">Nouveau RDV</span>
          <span className="sm:hidden">RDV</span>
        </button>
      </header>

      <main className="px-3 py-6 sm:px-4 md:px-8 md:py-8">
        {err && (
          <div className="mb-6 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <div className="space-y-5">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative flex-1 sm:min-w-[220px]">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
              />
              <input
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-pss-pink/40 focus:outline-none"
              />
            </div>
            <div className="inline-flex w-full rounded-xl border border-white/10 bg-white/[0.02] p-1 sm:w-auto">
              {(["upcoming", "past", "all"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setBookingFilter(f)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition sm:flex-none ${
                    bookingFilter === f
                      ? "bg-pss-pink/15 text-pss-pink"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {f === "upcoming" ? "À venir" : f === "past" ? "Passés" : "Tous"}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
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
                        <BookingRow b={b} onSelect={setDetailBooking} />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteBooking(b.id);
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
      </main>

      {/* New booking modal */}
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
              <p className="mt-1 text-[11px] text-white/45">
                Utilisée pour les conflits de créneaux (ex. 13h–15h puis 15h–17h).
              </p>
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

      {/* Booking detail modal */}
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
                <DetailRow label="Heure fin" value={detailBooking.endTime?.trim() || "—"} />
                <DetailRow label="Montant total" value={fmtEUR(detailBooking.priceCents)} />
                <DetailRow label="Acompte" value={fmtEUR(detailBooking.depositCents)} />
                <DetailRow label="Paiement" value={paymentStatusLabel(detailBooking.paymentStatus)} />
                <DetailRow label="Visite" value={detailBooking.visitLabelFR || "—"} />
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
                  <DetailRow label="Solde réglé" value={detailBooking.balancePaidLabelFR} />
                )}
              </dl>
              {detailBooking.description && (
                <div className="mt-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Description</p>
                  <p className="mt-1 text-sm text-white/75">{detailBooking.description}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Lien public client</p>
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
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Factures PDF</p>
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
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Actions</p>
                <div className="mt-3 flex flex-col gap-2">
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
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ffb6dd] via-pss-pink to-pss-hot px-4 py-2 text-sm font-medium text-white shadow-[0_0_24px_rgba(244,63,155,0.35)] transition hover:brightness-110"
                    >
                      <Icon name="check" className="h-4 w-4" /> Terminé le RDV
                    </button>
                  )}
                  {detailBooking.visitStatus === "completed" && (
                    <p className="text-xs text-emerald-300/70">Prestation clôturée.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => openReschedule(detailBooking)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 transition hover:bg-sky-500/20"
                  >
                    <Icon name="calendar" className="h-4 w-4" /> Déplacer le RDV
                  </button>
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

      {/* Reschedule modal */}
      {showReschedule && detailBooking && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/85 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0c10] p-6 shadow-xl">
            <h2 className="font-display text-lg uppercase tracking-[0.1em] text-white">
              Déplacer le rendez-vous
            </h2>
            <p className="mt-2 text-xs text-white/50">
              {detailBooking.serviceTypeName} — actuellement le {detailBooking.date} à{" "}
              {detailBooking.time}
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="rs-date"
                  className="block text-xs uppercase tracking-[0.15em] text-white/50"
                >
                  Nouvelle date
                </label>
                <input
                  id="rs-date"
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-pss-pink/50 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="rs-time"
                    className="block text-xs uppercase tracking-[0.15em] text-white/50"
                  >
                    Heure début
                  </label>
                  <input
                    id="rs-time"
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-pss-pink/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="rs-endtime"
                    className="block text-xs uppercase tracking-[0.15em] text-white/50"
                  >
                    Heure fin
                  </label>
                  <input
                    id="rs-endtime"
                    type="time"
                    value={rescheduleEndTime}
                    onChange={(e) => setRescheduleEndTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-pss-pink/50 focus:outline-none"
                  />
                </div>
              </div>
              {rescheduleConflict && (
                <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2">
                  <span className="mt-0.5 text-red-400">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                      <path
                        d="M12 8v4M12 16h.01"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <p className="text-xs text-red-300">
                    Créneau déjà pris —{" "}
                    <strong className="text-red-200">
                      {rescheduleConflict.serviceTypeName}
                    </strong>{" "}
                    le {rescheduleConflict.date} de {rescheduleConflict.time}
                    {rescheduleConflict.endTime ? ` à ${rescheduleConflict.endTime}` : ""}
                    {rescheduleConflict.clientName ? ` (${rescheduleConflict.clientName})` : ""}
                  </p>
                </div>
              )}
              {rescheduleErr && <p className="text-xs text-red-400">{rescheduleErr}</p>}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowReschedule(false)}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/75 hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={
                  rescheduleBusy ||
                  !rescheduleDate ||
                  !rescheduleTime ||
                  !!rescheduleConflict
                }
                onClick={() => void submitReschedule()}
                className="btn-pink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {rescheduleBusy ? "…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete service modal */}
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
                  Le paiement total n&apos;a pas été réglé en ligne. Comment le solde a-t-il été
                  payé <strong className="text-white">sur place</strong> ?
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
                              ? JSON.stringify({ balancePaidMethod: completeBalanceMethod })
                              : "{}";
                          const r = await api<{ pointsAdded: number; totalPoints: number }>(
                            `/admin/bookings/${id}/complete-service`,
                            { method: "POST", body },
                          );
                          setCompleteModalPhase(null);
                          setCompleteBalanceMethod(null);
                          setScanMessage(
                            r.pointsAdded > 0
                              ? `RDV terminé — +${r.pointsAdded} pts (total : ${r.totalPoints}).`
                              : "RDV terminé.",
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

      {/* Toast */}
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
    </>
  );
}
