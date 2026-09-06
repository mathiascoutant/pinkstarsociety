import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { bookingsOverlap } from "../lib/availability";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import {
  Booking,
  BookingRow,
  Field,
  Icon,
  Modal,
  ServiceType,
  bookingCollectedCents,
  canCompleteService,
  eurToCents,
  fmtEUR,
  formatLongDate,
  paymentStatusLabel,
  paymentStatusTone,
  todayISO,
  visitTone,
} from "../lib/adminShared";

export default function AdminBookingsPage() {
  const { openSidebar } = useOutletContext<{ openSidebar: () => void }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [bookingFilter, setBookingFilter] = useState<"all" | "upcoming" | "past">("upcoming");
  const [bookingSearch, setBookingSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // New booking modal
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [bServiceId, setBServiceId] = useState("");
  const [bDate, setBDate] = useState("");
  const [bTime, setBTime] = useState("");
  const [bEndTime, setBEndTime] = useState("");
  const [bPrice, setBPrice] = useState("");
  const [bDeposit, setBDeposit] = useState("");
  const [bDesc, setBDesc] = useState("");
  const [bInspiration, setBInspiration] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [inspIndex, setInspIndex] = useState<number | null>(null);
  const [detailLinkCopied, setDetailLinkCopied] = useState(false);
  const inspTouchStart = useRef<{ x: number; y: number } | null>(null);
  const inspSwiped = useRef(false);

  async function copyReservationLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
    } catch {
      setLinkCopied(false);
    }
  }

  function clearBookingQueryParams(...keys: string[]) {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    for (const key of keys) {
      if (next.has(key)) {
        next.delete(key);
        changed = true;
      }
    }
    if (changed) setSearchParams(next, { replace: true });
  }

  function closeNewBooking() {
    seededSearchRef.current = null;
    setShowNewBooking(false);
    setCreatedUrl(null);
    setLinkCopied(false);
    clearBookingQueryParams("new", "date", "time");
  }

  function closeDetailBooking() {
    setDetailBooking(null);
    clearBookingQueryParams("detail");
  }

  function openNewBooking(prefill?: { date?: string; time?: string }) {
    setDetailBooking(null);
    setCreatedUrl(null);
    setLinkCopied(false);
    setBServiceId("");
    setBDate(prefill?.date || todayISO());
    setBTime(prefill?.time || "");
    setBEndTime("");
    setBPrice("");
    setBDeposit("");
    setBDesc("");
    setBInspiration(false);
    setShowNewBooking(true);
    clearBookingQueryParams("detail");
  }

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

  // Edit booking modal
  const [showEdit, setShowEdit] = useState(false);
  const [eServiceId, setEServiceId] = useState("");
  const [eDate, setEDate] = useState("");
  const [eTime, setETime] = useState("");
  const [eEndTime, setEEndTime] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eDeposit, setEDeposit] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eInspiration, setEInspiration] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

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
    ])
      .catch((e) => setErr(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  }, []);

  // Auto-open detail from URL param (e.g. coming from dashboard)
  useEffect(() => {
    const detailId = searchParams.get("detail");
    if (!detailId || searchParams.get("new") === "1") return;
    if (bookings.length === 0) return;
    const found = bookings.find((b) => b.id === detailId);
    if (found) {
      setShowNewBooking(false);
      setDetailBooking(found);
    }
  }, [searchParams, bookings]);

  /**
   * Pré-remplissage depuis l'agenda — une seule fois par URL.
   *
   * Sans garde-fou, cet effet rejouait le `date`/`time` du créneau cliqué par
   * dessus la saisie en cours : au moindre remontage (rechargement, onglet
   * restauré par iOS après un passage dans une autre app, retour arrière),
   * l'heure saisie repassait à celle du créneau et le RDV partait à la
   * mauvaise date/heure. On sème donc une fois, puis on retire aussitôt les
   * paramètres de l'URL : la modale n'est plus rattachée à ces valeurs.
   */
  const seededSearchRef = useRef<string | null>(null);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const signature = searchParams.toString();
    if (seededSearchRef.current === signature) return;
    seededSearchRef.current = signature;

    setDetailBooking(null);
    setCreatedUrl(null);
    setLinkCopied(false);
    setBServiceId("");
    setBDate(searchParams.get("date") || todayISO());
    setBTime(searchParams.get("time") || "");
    setBEndTime("");
    setBPrice("");
    setBDeposit("");
    setBDesc("");
    setBInspiration(false);
    setShowNewBooking(true);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of ["new", "date", "time", "detail"]) next.delete(key);
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  // Sync open detail with latest booking data (without reopening a closed one)
  useEffect(() => {
    setDetailBooking((current) => {
      if (!current) return null;
      const next = bookings.find((x) => x.id === current.id);
      return next ?? null;
    });
  }, [bookings]);

  useEffect(() => {
    if (!detailBooking) {
      setCompleteModalPhase(null);
      setCompleteBalanceMethod(null);
    }
    setDetailLinkCopied(false);
    setInspIndex(null);
  }, [detailBooking?.id]);

  // Lightbox images d'inspiration : navigation clavier + swipe tactile.
  const inspImages = detailBooking?.inspirationImages ?? [];

  function stepInsp(delta: number) {
    setInspIndex((i) =>
      i === null || inspImages.length === 0
        ? i
        : (i + delta + inspImages.length) % inspImages.length,
    );
  }

  useEffect(() => {
    if (inspIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInspIndex(null);
      if (e.key === "ArrowRight") stepInsp(1);
      if (e.key === "ArrowLeft") stepInsp(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspIndex, inspImages.length]);

  function onInspTouchStart(e: React.TouchEvent) {
    const t = e.changedTouches[0];
    inspTouchStart.current = { x: t.clientX, y: t.clientY };
    inspSwiped.current = false;
  }

  function onInspTouchEnd(e: React.TouchEvent) {
    const start = inspTouchStart.current;
    inspTouchStart.current = null;
    if (!start || inspImages.length < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    inspSwiped.current = true;
    stepInsp(dx < 0 ? 1 : -1);
  }

  // Surcouches hors <Modal> (qui gère déjà son propre verrou de scroll).
  useBodyScrollLock(
    showReschedule || showEdit || completeModalPhase !== null || inspIndex !== null,
  );

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

  const editConflict = useMemo<Booking | null>(() => {
    if (!detailBooking || !eDate || !eTime) return null;
    const candidate = { date: eDate, time: eTime, endTime: eEndTime || undefined };
    for (const b of bookings) {
      if (b.id === detailBooking.id) continue;
      if (b.paymentStatus !== "deposit_paid" && b.paymentStatus !== "paid") continue;
      if (bookingsOverlap(candidate, { date: b.date, time: b.time, endTime: b.endTime })) {
        return b;
      }
    }
    return null;
  }, [bookings, detailBooking, eDate, eTime, eEndTime]);

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    setCreatedUrl(null);
    setLinkCopied(false);
    setErr(null);
    try {
      const r = await api<{ id: string; publicUrl: string }>("/admin/bookings", {
        method: "POST",
        body: JSON.stringify({
          serviceTypeId: bServiceId,
          date: bDate,
          time: bTime,
          endTime: bEndTime.trim() || undefined,
          priceCents: eurToCents(bPrice),
          depositCents: eurToCents(bDeposit),
          description: bDesc,
          inspirationRequired: bInspiration,
        }),
      });
      setCreatedUrl(r.publicUrl);
      await copyReservationLink(r.publicUrl);
      clearBookingQueryParams("new", "date", "time", "detail");
      await loadBookings();
      // Keep create modal open to show the public link for THIS booking
      setDetailBooking(null);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erreur");
    }
  }

  async function deleteBooking(id: string) {
    if (!confirm("Supprimer cette réservation ?")) return;
    await api(`/admin/bookings/${id}`, { method: "DELETE" });
    void loadBookings();
  }

  function openEdit(b: Booking) {
    setEServiceId(b.serviceTypeId);
    setEDate(b.date);
    setETime(b.time);
    setEEndTime(b.endTime ?? "");
    setEPrice((b.priceCents / 100).toString());
    setEDeposit((b.depositCents / 100).toString());
    setEDesc(b.description ?? "");
    setEInspiration(!!b.inspirationRequired);
    setEditErr(null);
    setShowEdit(true);
  }

  async function submitEdit() {
    if (!detailBooking) return;
    setEditBusy(true);
    setEditErr(null);
    try {
      const r = await api<{ changes: number; clientNotified: boolean }>(
        `/admin/bookings/${detailBooking.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            serviceTypeId: eServiceId,
            date: eDate,
            time: eTime,
            endTime: eEndTime.trim(),
            priceCents: eurToCents(ePrice),
            depositCents: eurToCents(eDeposit),
            description: eDesc,
            inspirationRequired: eInspiration,
          }),
        },
      );
      setShowEdit(false);
      await loadBookings();
      setScanMessage(
        r.changes === 0
          ? "Aucune modification enregistrée."
          : r.clientNotified
            ? `Rendez-vous modifié — client prévenu par e-mail (${r.changes} champ${r.changes > 1 ? "s" : ""}).`
            : "Rendez-vous modifié — aucun e-mail client connu, pas de notification.",
      );
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : "Modification impossible");
    } finally {
      setEditBusy(false);
    }
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
          onClick={() => openNewBooking()}
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
          {loading ? (
            <LoadingStar />
          ) : groups.length === 0 ? (
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
          onClose={closeNewBooking}
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
            <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-sm text-white">Images d&apos;inspiration</p>
                <p className="mt-0.5 text-[11px] text-white/45">
                  Si activé, le client doit envoyer au moins une image avant de payer
                  l&apos;acompte ou la totalité.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={bInspiration}
                onClick={() => setBInspiration((v) => !v)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                  bInspiration ? "bg-pss-pink" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                    bInspiration ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeNewBooking}
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
                {linkCopied ? (
                  <p className="font-medium text-emerald-300">Lien copié dans le presse-papiers</p>
                ) : (
                  <p className="text-white/70">Lien public à partager :</p>
                )}
                <div className="mt-2 flex gap-2">
                  <input
                    readOnly
                    value={createdUrl}
                    className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    className={`rounded-lg border px-3 py-1 text-xs uppercase transition ${
                      linkCopied
                        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                        : "border-white/20 text-white/80"
                    }`}
                    onClick={() => void copyReservationLink(createdUrl)}
                  >
                    {linkCopied ? "Copié" : "Copier"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* Booking detail modal — hidden while creating to avoid showing another RDV */}
      {detailBooking && !showNewBooking && (
        <Modal
          title={detailBooking.serviceTypeName}
          subtitle="Détail du rendez-vous"
          onClose={closeDetailBooking}
          wide
        >
          {(() => {
            const publicUrl = `${window.location.origin}/reservation/${detailBooking.publicToken}`;
            const guestName = [detailBooking.guestFirstName, detailBooking.guestLastName]
              .map((s) => s?.trim())
              .filter(Boolean)
              .join(" ");
            const collected = bookingCollectedCents(detailBooking);
            const remaining = Math.max(
              detailBooking.priceCents - collected,
              0,
            );
            return (
              <div className="space-y-4">
                {/* Bandeau créneau + statuts + montants */}
                <div className="rounded-xl border border-white/10 bg-gradient-to-r from-pss-pink/10 via-white/[0.03] to-transparent p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex w-[62px] shrink-0 flex-col items-center rounded-lg bg-pss-pink/15 px-2 py-2 ring-1 ring-pss-pink/20 sm:w-[76px] sm:px-3">
                      <span className="font-display text-base text-white sm:text-xl">
                        {detailBooking.time}
                      </span>
                      <span className="text-[9px] uppercase tracking-[0.12em] text-white/55 sm:text-[10px]">
                        {detailBooking.endTime?.trim()
                          ? `→ ${detailBooking.endTime}`
                          : "fin —"}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-white">
                        {formatLongDate(detailBooking.date)}
                      </p>
                      <p className="mt-0.5 text-xs text-white/50 sm:hidden">
                        {fmtEUR(detailBooking.priceCents)} ·{" "}
                        {detailBooking.paymentStatus === "deposit_paid"
                          ? `payé ${fmtEUR(collected)} · reste ${fmtEUR(remaining)}`
                          : `acompte ${fmtEUR(detailBooking.depositCents)}`}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="font-display text-xl text-white">
                        {fmtEUR(detailBooking.priceCents)}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">
                        {detailBooking.paymentStatus === "deposit_paid"
                          ? `Payé ${fmtEUR(collected)} · reste ${fmtEUR(remaining)}`
                          : `Acompte ${fmtEUR(detailBooking.depositCents)}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${paymentStatusTone(detailBooking.paymentStatus)}`}
                    >
                      {paymentStatusLabel(detailBooking.paymentStatus)}
                    </span>
                    {detailBooking.visitLabelFR && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${visitTone(detailBooking.visitStatus)}`}
                      >
                        {detailBooking.visitLabelFR}
                      </span>
                    )}
                    {detailBooking.balancePaidLabelFR && (
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/60">
                        Solde : {detailBooking.balancePaidLabelFR}
                      </span>
                    )}
                    {detailBooking.cashOnSiteIntent && remaining > 0 && (
                      <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-200/90">
                        {fmtEUR(remaining)} en espèces le jour J
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="min-w-0 space-y-4">
                    <DetailCard title="Client">
                      {detailBooking.clientUserId ? (
                        <>
                          <p className="text-sm font-medium text-white">
                            {detailBooking.clientName?.trim() || "—"}
                          </p>
                          <span className="mt-2 inline-block rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                            Compte client
                          </span>
                        </>
                      ) : guestName || detailBooking.guestEmail ? (
                        <>
                          <p className="text-sm font-medium text-white">
                            {guestName || "—"}
                          </p>
                          {detailBooking.guestEmail?.trim() && (
                            <a
                              href={`mailto:${detailBooking.guestEmail.trim()}`}
                              className="mt-1 inline-flex max-w-full items-center gap-1.5 break-all text-sm text-pss-pink hover:underline"
                            >
                              <Icon name="mail" className="h-3.5 w-3.5 shrink-0" />
                              {detailBooking.guestEmail.trim()}
                            </a>
                          )}
                          <span className="mt-2 block w-fit rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/60">
                            Visiteur — pas de compte
                          </span>
                        </>
                      ) : (
                        <p className="text-sm text-white/45">
                          Aucun client rattaché.
                        </p>
                      )}
                    </DetailCard>

                    {detailBooking.description && (
                      <DetailCard title="Description">
                        <p className="whitespace-pre-line text-sm leading-relaxed text-white/75">
                          {detailBooking.description}
                        </p>
                      </DetailCard>
                    )}

                    <DetailCard
                      title="Images d'inspiration"
                      aside={
                        inspImages.length > 0
                          ? `${inspImages.length} image${inspImages.length > 1 ? "s" : ""}`
                          : undefined
                      }
                    >
                      {!detailBooking.inspirationRequired && inspImages.length === 0 ? (
                        <p className="text-sm text-white/45">
                          Option désactivée pour ce RDV.
                        </p>
                      ) : inspImages.length === 0 ? (
                        <p className="text-sm text-amber-200/80">
                          En attente — aucune image envoyée par le client.
                        </p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {inspImages.map((img, i) => (
                            <button
                              key={img.id}
                              type="button"
                              onClick={() => setInspIndex(i)}
                              className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-black/40"
                              title={img.originalName || "Voir l'image"}
                            >
                              <img
                                src={img.thumbUrl}
                                alt={img.originalName || "Inspiration"}
                                className="h-full w-full object-cover transition group-hover:scale-105"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </DetailCard>
                  </div>

                  <div className="min-w-0 space-y-4">
                    <DetailCard title="Lien public client">
                      <div className="flex items-center gap-2">
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={publicUrl}
                          className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-pss-pink transition hover:border-pss-pink/40"
                        >
                          {publicUrl.replace(/^https?:\/\//, "")}
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(publicUrl)
                              .then(() => setDetailLinkCopied(true))
                              .catch(() => setDetailLinkCopied(false));
                          }}
                          title="Copier le lien"
                          aria-label="Copier le lien"
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 text-white/70 transition hover:border-pss-pink/50 hover:text-pss-pink"
                        >
                          <Icon name="copy" className="h-4 w-4" />
                        </button>
                      </div>
                      {detailLinkCopied && (
                        <p className="mt-2 text-[11px] text-emerald-300/80">
                          Lien copié.
                        </p>
                      )}
                    </DetailCard>

                    {(detailBooking.paymentStatus === "deposit_paid" ||
                      detailBooking.paymentStatus === "paid") && (
                      <DetailCard title="Factures PDF">
                        <div className="flex flex-col gap-2">
                          {detailBooking.paymentStatus === "deposit_paid" && (
                            <a
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/85 transition hover:border-pss-pink/50"
                              href={`/api/public/bookings/${detailBooking.publicToken}/facture.pdf`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Icon name="external" className="h-4 w-4" /> Facture
                              (acompte)
                            </a>
                          )}
                          {detailBooking.paymentStatus === "paid" && (
                            <>
                              <a
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/85 transition hover:border-pss-pink/50"
                                href={`/api/public/bookings/${detailBooking.publicToken}/facture.pdf?variant=deposit`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Icon name="external" className="h-4 w-4" /> Facture —
                                acompte
                              </a>
                              <a
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-pss-pink/35 bg-pss-pink/10 px-3 py-2 text-sm text-pss-pink transition hover:bg-pss-pink/15"
                                href={`/api/public/bookings/${detailBooking.publicToken}/facture.pdf`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Icon name="external" className="h-4 w-4" /> Facture —
                                totalité
                              </a>
                            </>
                          )}
                        </div>
                      </DetailCard>
                    )}

                    <DetailCard title="Actions">
                      <div className="flex flex-col gap-2">
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
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ffb6dd] via-pss-pink to-pss-hot px-4 py-2.5 text-sm font-medium text-white shadow-[0_0_24px_rgba(244,63,155,0.35)] transition hover:brightness-110"
                          >
                            <Icon name="check" className="h-4 w-4" /> Terminer le RDV
                          </button>
                        )}
                        {detailBooking.visitStatus === "completed" && (
                          <p className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-300/80">
                            Prestation clôturée.
                          </p>
                        )}
                        {detailBooking.date >= today ? (
                          <button
                            type="button"
                            onClick={() => openEdit(detailBooking)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.02] px-4 py-2.5 text-sm text-white/85 transition hover:border-pss-pink/50 hover:text-pss-pink"
                          >
                            <Icon name="edit" className="h-4 w-4" /> Modifier le RDV
                          </button>
                        ) : (
                          <p className="rounded-lg border border-white/10 px-3 py-2 text-center text-xs text-white/40">
                            Rendez-vous passé — modification impossible.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => openReschedule(detailBooking)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.02] px-4 py-2.5 text-sm text-white/85 transition hover:border-sky-400/40 hover:text-sky-300"
                        >
                          <Icon name="calendar" className="h-4 w-4" /> Déplacer le RDV
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteBooking(detailBooking.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Icon name="trash" className="h-4 w-4" /> Supprimer
                        </button>
                      </div>
                    </DetailCard>
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Reschedule modal */}
      {/* Edit booking modal */}
      {showEdit && detailBooking && (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center bg-black/85 px-3 py-4 sm:items-center sm:px-4 sm:py-8"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0c0c10] p-4 shadow-xl sm:p-6">
            <h2 className="font-display text-lg uppercase tracking-[0.1em] text-white">
              Modifier le rendez-vous
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-white/50">
              Le client sera prévenu par e-mail de chaque information modifiée.
            </p>

            <div className="mt-5 space-y-4">
              <Field label="Type de prestation">
                <select
                  value={eServiceId}
                  onChange={(e) => setEServiceId(e.target.value)}
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
                    value={eDate}
                    min={today}
                    onChange={(e) => setEDate(e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="Heure début">
                  <input
                    type="time"
                    value={eTime}
                    onChange={(e) => setETime(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
              <Field label="Heure de fin (interne)">
                <input
                  type="time"
                  value={eEndTime}
                  onChange={(e) => setEEndTime(e.target.value)}
                  className="input"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prix (€)">
                  <input
                    value={ePrice}
                    onChange={(e) => setEPrice(e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="Acompte (€)">
                  <input
                    value={eDeposit}
                    onChange={(e) => setEDeposit(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  value={eDesc}
                  onChange={(e) => setEDesc(e.target.value)}
                  rows={3}
                  className="input"
                />
              </Field>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="text-sm text-white">Images d&apos;inspiration</p>
                  <p className="mt-0.5 text-[11px] text-white/45">
                    Obligatoires avant le paiement de l&apos;acompte ou de la totalité.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={eInspiration}
                  onClick={() => setEInspiration((v) => !v)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    eInspiration ? "bg-pss-pink" : "bg-white/15"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                      eInspiration ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {(detailBooking.paymentStatus === "deposit_paid" ||
                detailBooking.paymentStatus === "paid") &&
                (eurToCents(ePrice) !== detailBooking.priceCents ||
                  eurToCents(eDeposit) !== detailBooking.depositCents) && (
                  <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
                    Ce rendez-vous est déjà payé ({paymentStatusLabel(detailBooking.paymentStatus)}).
                    Changer les montants ne rembourse ni ne débite quoi que ce soit — à régulariser
                    à part.
                  </p>
                )}

              {editConflict && (
                <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  Créneau déjà pris —{" "}
                  <strong className="text-red-200">{editConflict.serviceTypeName}</strong> le{" "}
                  {editConflict.date} à {editConflict.time}
                  {editConflict.endTime ? ` → ${editConflict.endTime}` : ""}
                </p>
              )}
              {editErr && <p className="text-xs text-red-400">{editErr}</p>}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/75 hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={
                  editBusy ||
                  !eServiceId ||
                  !eDate ||
                  !eTime ||
                  eurToCents(ePrice) <= 0 ||
                  eurToCents(eDeposit) <= 0 ||
                  eurToCents(eDeposit) > eurToCents(ePrice) ||
                  !!editConflict
                }
                onClick={() => void submitEdit()}
                className="btn-pink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editBusy ? "…" : "Enregistrer & prévenir"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  Il reste{" "}
                  <strong className="text-white">
                    {fmtEUR(
                      Math.max(
                        0,
                        detailBooking.priceCents -
                          bookingCollectedCents(detailBooking),
                      ),
                    )}
                  </strong>{" "}
                  non réglés en ligne
                  {detailBooking.cashOnSiteIntent
                    ? " (le client a prévu de payer en espèces)"
                    : ""}
                  . Comment le solde a-t-il été payé{" "}
                  <strong className="text-white">sur place</strong> ?
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

      {/* Inspiration lightbox — version haute qualité (pas la miniature) */}
      {inspIndex !== null && inspImages[inspIndex] && (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center bg-black/90 px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!inspSwiped.current) setInspIndex(null);
          }}
          onTouchStart={onInspTouchStart}
          onTouchEnd={onInspTouchEnd}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-lg border border-white/20 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-white/80 hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              setInspIndex(null);
            }}
          >
            Fermer
          </button>
          <img
            key={inspImages[inspIndex].id}
            src={inspImages[inspIndex].fullUrl}
            alt={inspImages[inspIndex].originalName || "Inspiration"}
            className="max-h-[85vh] max-w-full select-none object-contain"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />
          {inspImages.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Image précédente"
                onClick={(e) => {
                  e.stopPropagation();
                  stepInsp(-1);
                }}
                className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/60 text-white/85 transition hover:border-pss-pink/50 hover:text-pss-pink sm:grid"
              >
                <Icon name="chevronLeft" className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Image suivante"
                onClick={(e) => {
                  e.stopPropagation();
                  stepInsp(1);
                }}
                className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/60 text-white/85 transition hover:border-pss-pink/50 hover:text-pss-pink sm:grid"
              >
                <Icon name="chevronRight" className="h-5 w-5" />
              </button>
              <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/70">
                {inspIndex + 1} / {inspImages.length}
              </span>
            </>
          )}
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

/** Écran d'attente pendant le chargement des réservations : l'étoile PSS
 *  entourée d'un anneau qui tourne. */
function LoadingStar() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16">
      <span className="relative grid h-20 w-20 place-items-center">
        <span className="absolute inset-0 rounded-full bg-pss-pink/20 blur-xl" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-pss-pink" />
        <svg viewBox="0 0 100 100" className="relative z-10 h-9 w-9">
          <defs>
            <linearGradient id="loaderstar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ffd4ee" />
              <stop offset="0.5" stopColor="#ff007a" />
              <stop offset="1" stopColor="#5a0028" />
            </linearGradient>
          </defs>
          <polygon
            fill="url(#loaderstar)"
            stroke="#0c0010"
            strokeWidth="4"
            strokeLinejoin="round"
            points="50,5 61,38 96,38 67,58 78,92 50,72 22,92 33,58 4,38 39,38"
          />
        </svg>
      </span>
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
        Chargement…
      </p>
    </div>
  );
}

/** Bloc de section dans la modale de détail d'un rendez-vous. */
function DetailCard({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
          {title}
        </p>
        {aside && <span className="text-[11px] text-white/35">{aside}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
