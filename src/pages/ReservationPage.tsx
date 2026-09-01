import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../lib/api";
import { compressImageFile } from "../lib/compressImage";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import { useAuth } from "../context/AuthContext";

type InspirationImage = {
  id: string;
  originalName?: string;
  thumbUrl: string;
  fullUrl: string;
};

type PublicBooking = {
  serviceTypeName: string;
  date: string;
  time: string;
  priceCents: number;
  depositCents: number;
  /** Total déjà encaissé en ligne (acompte, paiements partiels…). */
  paidCents: number;
  remainingCents: number;
  /** Montant minimum d'un paiement partiel en carte. */
  minPartialCents: number;
  /** Le client a choisi de régler le reliquat en espèces le jour J. */
  cashOnSiteIntent?: boolean;
  description: string;
  inspirationRequired?: boolean;
  inspirationImages?: InspirationImage[];
  inspirationImagesCount?: number;
  inspirationReady?: boolean;
  paymentStatus: string;
  visitStatus?: string;
  visitLabelFR?: string;
  canPayDeposit: boolean;
  canPayFull: boolean;
  canPayBalance: boolean;
  canPayPartial: boolean;
  paidLabel: string;
  /** true si la même demi-journée a déjà été réservée par quelqu'un d'autre. */
  slotTaken?: boolean;
};

type PayKind = "full" | "deposit" | "balance" | "partial";

function fmtEUR(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** "12,50" / "12.5" → 1250 centimes. null si la saisie n'est pas un montant. */
function eurosInputToCents(raw: string): number | null {
  const s = raw.trim().replace(",", ".").replace(/\s/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

function centsToEurosInput(cents: number) {
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

/** Proposition par défaut : la moitié du reste dû, bornée au minimum autorisé. */
function defaultPartialCents(d: {
  remainingCents: number;
  minPartialCents: number;
}) {
  const half = Math.round(d.remainingCents / 2 / 100) * 100;
  return Math.min(Math.max(half, d.minPartialCents), d.remainingCents);
}

function visitRowClass(label?: string, status?: string) {
  if (label === "Confirmé") return "text-emerald-400/95";
  if (status === "completed") return "text-sky-300/95";
  if (status === "in_progress") return "text-emerald-400/95";
  if (status === "pending_validation") return "text-amber-200/90";
  return "text-white/70";
}

export default function ReservationPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<PublicBooking | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState<string | null>(null);
  const [authModal, setAuthModal] = useState(false);
  const [guestModal, setGuestModal] = useState(false);
  const [guestFirst, setGuestFirst] = useState("");
  const [guestLast, setGuestLast] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestErr, setGuestErr] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<PayKind | null>(null);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [partialModal, setPartialModal] = useState(false);
  const [partialEuros, setPartialEuros] = useState("");
  const [partialErr, setPartialErr] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const b = await api<PublicBooking>(`/public/bookings/${token}`);
        if (!cancelled) setData(b);
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Lien invalide");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useBodyScrollLock(
    lightboxIndex !== null || authModal || guestModal || partialModal,
  );

  const lightboxCount = data?.inspirationImages?.length ?? 0;

  function stepLightbox(delta: number) {
    setLightboxIndex((i) =>
      i === null || lightboxCount === 0
        ? i
        : (i + delta + lightboxCount) % lightboxCount,
    );
  }

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") stepLightbox(1);
      if (e.key === "ArrowLeft") stepLightbox(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, lightboxCount]);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    swiped.current = false;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || lightboxCount < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Swipe horizontal franc uniquement : on ignore les gestes verticaux.
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    swiped.current = true;
    stepLightbox(dx < 0 ? 1 : -1);
  }

  async function checkout(
    kind: PayKind,
    amountCents: number | null,
    guest?: { firstName: string; lastName: string; email: string },
  ) {
    if (!token) return;
    setPayBusy(kind);
    try {
      const body: Record<string, unknown> = { kind };
      if (kind === "partial" && amountCents != null) body.amountCents = amountCents;
      if (guest) body.guest = guest;
      const res = await api<{ url: string }>(
        `/public/bookings/${token}/checkout`,
        { method: "POST", body: JSON.stringify(body) },
      );
      window.location.href = res.url;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Paiement indisponible");
    } finally {
      setPayBusy(null);
    }
  }

  function onPayClick(kind: PayKind, amountCents: number | null = null) {
    if (
      data?.inspirationRequired &&
      data.paymentStatus === "pending" &&
      !data.inspirationImages?.length
    ) {
      setUploadErr("Ajoute au moins une image d'inspiration avant de payer.");
      return;
    }
    if (user) {
      void checkout(kind, amountCents);
      return;
    }
    setPendingKind(kind);
    setPendingAmount(amountCents);
    setAuthModal(true);
  }

  /** Ouvre la saisie du montant à régler en carte (le reste en espèces le jour J). */
  function openPartialModal() {
    if (!data) return;
    if (
      data.inspirationRequired &&
      data.paymentStatus === "pending" &&
      !data.inspirationImages?.length
    ) {
      setUploadErr("Ajoute au moins une image d'inspiration avant de payer.");
      return;
    }
    setPartialErr(null);
    setPartialEuros(centsToEurosInput(defaultPartialCents(data)));
    setPartialModal(true);
  }

  function submitPartial() {
    if (!data) return;
    const cents = eurosInputToCents(partialEuros);
    if (cents == null) {
      setPartialErr("Montant invalide.");
      return;
    }
    if (cents < data.minPartialCents) {
      setPartialErr(`Le montant minimum est de ${fmtEUR(data.minPartialCents)}.`);
      return;
    }
    if (cents > data.remainingCents) {
      setPartialErr(`Le montant maximum est de ${fmtEUR(data.remainingCents)}.`);
      return;
    }
    setPartialModal(false);
    setPartialErr(null);
    onPayClick("partial", cents);
  }

  function goLogin() {
    if (!token) return;
    const redirect = `/reservation/${token}`;
    setAuthModal(false);
    nav(`/connexion?redirect=${encodeURIComponent(redirect)}`);
  }

  function continueAsGuest() {
    setAuthModal(false);
    setGuestErr(null);
    setGuestModal(true);
  }

  function submitGuest() {
    const first = guestFirst.trim();
    const last = guestLast.trim();
    const email = guestEmail.trim();
    if (!first || !last) {
      setGuestErr("Renseigne ton prénom et ton nom.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGuestErr("Adresse e-mail invalide.");
      return;
    }
    const k = pendingKind;
    const amount = pendingAmount;
    setGuestModal(false);
    setPendingKind(null);
    setPendingAmount(null);
    if (k) void checkout(k, amount, { firstName: first, lastName: last, email });
  }

  async function onFilesSelected(files: FileList | null) {
    if (!token || !files?.length) return;
    setUploadBusy(true);
    setUploadErr(null);
    try {
      const form = new FormData();
      for (const file of Array.from(files)) {
        const compressed = await compressImageFile(file);
        form.append("files", compressed);
      }
      const res = await api<{ images: InspirationImage[]; count: number }>(
        `/public/bookings/${token}/inspiration-images`,
        { method: "POST", body: form },
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              inspirationImages: res.images,
              inspirationImagesCount: res.count,
              inspirationReady: res.count > 0,
              canPayDeposit: prev.paymentStatus === "pending" && res.count > 0,
              canPayFull: prev.paymentStatus === "pending" && res.count > 0,
              canPayPartial:
                prev.paymentStatus === "pending" &&
                res.count > 0 &&
                prev.remainingCents > prev.minPartialCents,
            }
          : prev,
      );
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload impossible");
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeImage(imageId: string) {
    if (!token) return;
    setDeletingId(imageId);
    setUploadErr(null);
    try {
      const res = await api<{ images: InspirationImage[]; count: number }>(
        `/public/bookings/${token}/inspiration-images/${imageId}`,
        { method: "DELETE" },
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              inspirationImages: res.images,
              inspirationImagesCount: res.count,
              inspirationReady: !prev.inspirationRequired || res.count > 0,
              canPayDeposit:
                prev.paymentStatus === "pending" &&
                (!prev.inspirationRequired || res.count > 0),
              canPayFull:
                prev.paymentStatus === "pending" &&
                (!prev.inspirationRequired || res.count > 0),
              canPayPartial:
                prev.paymentStatus === "pending" &&
                (!prev.inspirationRequired || res.count > 0) &&
                prev.remainingCents > prev.minPartialCents,
            }
          : prev,
      );
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Suppression impossible");
    } finally {
      setDeletingId(null);
    }
  }

  if (err) return <ReservationNotFound message={err} />;
  if (!data) {
    return (
      <div className="min-h-screen bg-[#050507] px-5 pb-20 pt-28 text-white md:pt-36">
        <Navbar />
        Chargement…
      </div>
    );
  }

  const paid =
    data.paymentStatus === "paid" || data.paymentStatus === "deposit_paid";
  const needsInspiration =
    !!data.inspirationRequired && data.paymentStatus === "pending";
  const images = data.inspirationImages ?? [];
  const hasInspiration = images.length > 0;
  const payBlockedByInspo = needsInspiration && !hasInspiration;
  // Les images ne sont modifiables qu'avant paiement (règle côté API).
  const canEditInspiration = data.paymentStatus === "pending";
  const showInspiration = needsInspiration || hasInspiration;

  return (
    <div className="min-h-screen bg-[#050507] px-5 pb-20 pt-28 text-white md:pt-36">
      <Navbar />
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl uppercase tracking-[0.12em]">
            Votre prestation
          </h1>
          {paid && token && (
            <a
              href={`/api/public/bookings/${token}/agenda.ics`}
              title="Ajouter à l’agenda (.ics)"
              aria-label="Ajouter à l’agenda (.ics)"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 text-white/70 transition hover:border-pss-pink/50 hover:text-pss-pink"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
              </svg>
            </a>
          )}
        </div>
        <p className="mt-2 text-sm text-pss-pink">{data.paidLabel}</p>
        {data.visitLabelFR ? (
          <p className={`mt-2 text-sm font-medium ${visitRowClass(data.visitLabelFR, data.visitStatus)}`}>
            Visite : {data.visitLabelFR}
          </p>
        ) : null}

        <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <Row label="Prestation" value={data.serviceTypeName} />
          <Row label="Date" value={data.date} />
          <Row label="Heure" value={data.time} />
          <Row label="Montant total" value={fmtEUR(data.priceCents)} />
          <Row label="Acompte" value={fmtEUR(data.depositCents)} />
          {data.paidCents > 0 && (
            <Row label="Déjà payé en ligne" value={fmtEUR(data.paidCents)} />
          )}
          {data.remainingCents > 0 && data.paymentStatus !== "pending" && (
            <Row label="Reste à régler" value={fmtEUR(data.remainingCents)} />
          )}
          {data.description && (
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                Description
              </p>
              <p className="mt-1 text-sm text-white/80">{data.description}</p>
            </div>
          )}
        </div>

        {showInspiration && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                Images d&apos;inspiration
              </p>
              {hasInspiration && (
                <span className="text-xs text-white/40">
                  {images.length} image{images.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {(needsInspiration || canEditInspiration) && (
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {needsInspiration
                  ? "Envoie au moins une image d'inspiration avant de pouvoir payer l'acompte ou la totalité."
                  : "Les images que tu as envoyées pour cette prestation."}
              </p>
            )}

            {hasInspiration && (
              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {images.map((img, i) => (
                  <div
                    key={img.id}
                    className="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-black/40"
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className="block h-full w-full"
                      title="Voir en grand"
                    >
                      <img
                        src={img.thumbUrl}
                        alt={img.originalName || "Inspiration"}
                        className="h-full w-full object-cover transition hover:scale-[1.03]"
                      />
                    </button>
                    {canEditInspiration && (
                      <button
                        type="button"
                        disabled={deletingId === img.id || uploadBusy}
                        onClick={() => void removeImage(img.id)}
                        className="absolute right-1 top-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/90 hover:bg-red-500/80 disabled:opacity-50"
                      >
                        {deletingId === img.id ? "…" : "✕"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEditInspiration && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => void onFilesSelected(e.target.files)}
                />
                <button
                  type="button"
                  disabled={uploadBusy || images.length >= 8}
                  onClick={() => fileRef.current?.click()}
                  className="mt-4 w-full rounded-xl border border-white/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-white/85 transition hover:border-pss-pink/50 disabled:opacity-50"
                >
                  {uploadBusy
                    ? "Compression & envoi…"
                    : hasInspiration
                      ? "Ajouter d'autres images"
                      : "Ajouter des images"}
                </button>
              </>
            )}
            {uploadErr && (
              <p className="mt-3 text-xs text-red-400">{uploadErr}</p>
            )}
            {payBlockedByInspo && !uploadErr && (
              <p className="mt-3 text-xs text-amber-200/85">
                Paiement bloqué tant qu&apos;aucune image n&apos;est envoyée.
              </p>
            )}
          </div>
        )}

        {data.slotTaken && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-red-400/30 bg-red-500/[0.07] p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-red-400/40 bg-red-500/15 text-lg text-red-300">
                ✕
              </span>
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-red-300/85">
                  Offre plus valable
                </div>
                <h2 className="mt-1 font-display text-xl uppercase tracking-[0.06em] text-white sm:text-2xl">
                  Désolé, ce créneau vient d&apos;être réservé.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  Une autre personne a confirmé son rendez-vous sur un créneau
                  qui chevauche celui-ci. Le paiement n&apos;est plus possible pour
                  cette offre.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  Tu peux m&apos;envoyer un message en DM Instagram pour que je te
                  propose un nouveau créneau.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    href="https://instagram.com/pinkstar_society"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-pink"
                  >
                    DM @pinkstar_society
                  </a>
                  <Link to="/disponibilites" className="btn-chrome">
                    Voir d&apos;autres dates
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {!data.slotTaken && data.paymentStatus !== "paid" && (
          <div className="mt-8 flex flex-col gap-3">
            {data.paymentStatus === "pending" && (
              <>
                <button
                  type="button"
                  disabled={payBusy !== null || payBlockedByInspo}
                  onClick={() => onPayClick("deposit")}
                  className="rounded-xl border border-pss-pink/50 bg-pss-pink/10 px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white transition hover:bg-pss-pink/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {payBusy === "deposit"
                    ? "Redirection…"
                    : `Payer l'acompte (${fmtEUR(data.depositCents)})`}
                </button>
                <button
                  type="button"
                  disabled={payBusy !== null || payBlockedByInspo}
                  onClick={() => onPayClick("full")}
                  className="btn-pink justify-center disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {payBusy === "full"
                    ? "Redirection…"
                    : `Payer la totalité (${fmtEUR(data.priceCents)})`}
                </button>
              </>
            )}
            {data.canPayBalance && (
              <button
                type="button"
                disabled={payBusy !== null}
                onClick={() => onPayClick("balance")}
                className="btn-pink justify-center disabled:opacity-50"
              >
                {payBusy === "balance"
                  ? "Redirection…"
                  : `Payer le solde (${fmtEUR(data.remainingCents)})`}
              </button>
            )}
            {data.canPayPartial && (
              <button
                type="button"
                disabled={payBusy !== null || payBlockedByInspo}
                onClick={openPartialModal}
                className="mt-1 self-center text-xs text-white/40 underline decoration-white/20 underline-offset-4 transition hover:text-white/70 hover:decoration-white/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {payBusy === "partial"
                  ? "Redirection…"
                  : "Payer une partie en carte, le reste en espèces le jour J"}
              </button>
            )}
          </div>
        )}

        {!data.slotTaken &&
          data.cashOnSiteIntent &&
          data.remainingCents > 0 &&
          data.paymentStatus !== "paid" && (
            <div className="mt-8 rounded-2xl border border-amber-300/25 bg-amber-400/[0.06] p-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/80">
                À prévoir le jour J
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                Il reste{" "}
                <span className="font-medium text-white">
                  {fmtEUR(data.remainingCents)}
                </span>{" "}
                à régler <span className="font-medium text-white">en espèces</span>{" "}
                sur place. Tu peux aussi les payer en ligne avant le rendez-vous
                avec les boutons ci-dessus.
              </p>
            </div>
          )}

      </div>

      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4 touch-pan-y"
          role="dialog"
          aria-modal="true"
          aria-label="Image d'inspiration"
          onClick={() => {
            if (!swiped.current) setLightboxIndex(null);
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img
            key={images[lightboxIndex].id}
            src={images[lightboxIndex].fullUrl}
            alt={images[lightboxIndex].originalName || "Inspiration"}
            className="max-h-[70vh] w-auto max-w-[min(90vw,26rem)] select-none rounded-xl object-contain"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Image précédente"
                onClick={(e) => {
                  e.stopPropagation();
                  stepLightbox(-1);
                }}
                className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/60 text-xl text-white/85 transition hover:border-pss-pink/50 hover:text-pss-pink sm:grid"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Image suivante"
                onClick={(e) => {
                  e.stopPropagation();
                  stepLightbox(1);
                }}
                className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/60 text-xl text-white/85 transition hover:border-pss-pink/50 hover:text-pss-pink sm:grid"
              >
                ›
              </button>
              <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/70">
                {lightboxIndex + 1} / {images.length}
              </span>
            </>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(null);
            }}
            className="absolute right-4 top-4 rounded-lg border border-white/20 bg-black/60 px-3 py-1.5 text-sm text-white/85 hover:border-pss-pink/50"
          >
            Fermer
          </button>
        </div>
      )}

      {partialModal && (() => {
        const cents = eurosInputToCents(partialEuros);
        const valid =
          cents != null &&
          cents >= data.minPartialCents &&
          cents <= data.remainingCents;
        const cash = valid ? data.remainingCents - (cents as number) : null;
        const presets = [0.25, 0.5, 0.75]
          .map((r) => Math.round((data.remainingCents * r) / 100) * 100)
          .filter(
            (v, i, arr) =>
              v >= data.minPartialCents &&
              v <= data.remainingCents &&
              arr.indexOf(v) === i,
          );
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="partial-pay-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c10] p-6 shadow-xl shadow-pss-pink/10">
              <h2
                id="partial-pay-title"
                className="font-display text-lg uppercase tracking-[0.12em] text-white"
              >
                Carte + espèces
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                Choisis ce que tu règles{" "}
                <strong className="text-white">en carte maintenant</strong> — le
                reste se paie{" "}
                <strong className="text-white">en espèces le jour du RDV</strong>.
              </p>

              <div className="mt-5">
                <label
                  htmlFor="partial-amount"
                  className="text-[11px] uppercase tracking-[0.18em] text-white/45"
                >
                  Montant en carte
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-black/30 px-4 py-3 focus-within:border-pss-pink/50">
                  <input
                    id="partial-amount"
                    type="text"
                    inputMode="decimal"
                    value={partialEuros}
                    onChange={(e) => {
                      setPartialEuros(e.target.value);
                      setPartialErr(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitPartial();
                    }}
                    className="w-full bg-transparent text-lg text-white outline-none placeholder:text-white/30"
                    placeholder="0"
                  />
                  <span className="text-lg text-white/50">€</span>
                </div>
                <p className="mt-2 text-xs text-white/40">
                  Entre {fmtEUR(data.minPartialCents)} et{" "}
                  {fmtEUR(data.remainingCents)}
                </p>
              </div>

              {presets.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {presets.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setPartialEuros(centsToEurosInput(v));
                        setPartialErr(null);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        cents === v
                          ? "border-pss-pink/60 bg-pss-pink/15 text-white"
                          : "border-white/15 text-white/60 hover:border-white/30"
                      }`}
                    >
                      {fmtEUR(v)}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-5 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">En carte maintenant</span>
                  <span className="font-medium text-white">
                    {valid ? fmtEUR(cents as number) : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">En espèces le jour J</span>
                  <span className="font-medium text-pss-pink">
                    {cash != null ? fmtEUR(cash) : "—"}
                  </span>
                </div>
              </div>

              {partialErr && (
                <p className="mt-3 text-xs text-red-400">{partialErr}</p>
              )}

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  disabled={!valid}
                  onClick={submitPartial}
                  className="btn-pink w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continuer vers le paiement
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPartialModal(false);
                    setPartialErr(null);
                  }}
                  className="text-center text-xs uppercase tracking-[0.16em] text-white/40 hover:text-white/60"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {guestModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-form-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c10] p-6 shadow-xl shadow-pss-pink/10">
            <h2
              id="guest-form-title"
              className="font-display text-lg uppercase tracking-[0.12em] text-white"
            >
              Tes informations
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              J&apos;en ai besoin pour t&apos;envoyer ta confirmation et ton QR de présence par e-mail.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <input
                type="text"
                placeholder="Prénom"
                value={guestFirst}
                onChange={(e) => setGuestFirst(e.target.value)}
                autoComplete="given-name"
                className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-pss-pink/50 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Nom"
                value={guestLast}
                onChange={(e) => setGuestLast(e.target.value)}
                autoComplete="family-name"
                className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-pss-pink/50 focus:outline-none"
              />
              <input
                type="email"
                placeholder="Adresse e-mail"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                autoComplete="email"
                className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-pss-pink/50 focus:outline-none"
              />
              {guestErr && (
                <p className="text-xs text-red-400">{guestErr}</p>
              )}
              <button
                type="button"
                onClick={submitGuest}
                className="btn-pink w-full justify-center"
              >
                Continuer vers le paiement
              </button>
              <button
                type="button"
                onClick={() => {
                  setGuestModal(false);
                  setPendingKind(null);
                  setPendingAmount(null);
                  setGuestErr(null);
                }}
                className="text-center text-xs uppercase tracking-[0.16em] text-white/40 hover:text-white/60"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {authModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-auth-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c10] p-6 shadow-xl shadow-pss-pink/10">
            <h2
              id="pay-auth-title"
              className="font-display text-lg uppercase tracking-[0.12em] text-white"
            >
              Avant le paiement
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Connecte-toi pour <strong className="text-white">cumuler des points</strong>{" "}
              de fidélité sur ton compte client, ou continue{" "}
              <strong className="text-white">en tant que visiteur</strong> (sans points).
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => goLogin()}
                className="btn-pink w-full justify-center"
              >
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => continueAsGuest()}
                className="rounded-xl border border-white/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-white/80 transition hover:border-white/30"
              >
                Continuer en visiteur
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthModal(false);
                  setPendingKind(null);
                  setPendingAmount(null);
                }}
                className="text-center text-xs uppercase tracking-[0.16em] text-white/40 hover:text-white/60"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Lien mort ou réservation supprimée. On distingue le 404 « ce lien ne mène
 * nulle part » d'une vraie panne API, le message d'action n'étant pas le même.
 */
function ReservationNotFound({ message }: { message: string }) {
  const notFound = /introuvable|invalide|not found/i.test(message);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507] px-5 pb-24 pt-28 text-white md:pt-36">
      <Navbar />
      {/* Halo rose diffus, comme sur la home */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-pss-pink/20 blur-[120px]"
      />

      <div className="relative mx-auto max-w-lg text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
          PinkStar Society
        </p>

        <p
          aria-hidden="true"
          className="mt-6 select-none bg-gradient-to-b from-white via-pss-pink to-pss-pink/20 bg-clip-text font-display text-[5.5rem] leading-none text-transparent sm:text-[7rem]"
        >
          {notFound ? "404" : "!"}
        </p>

        <h1 className="mt-4 font-display text-2xl uppercase leading-tight tracking-[0.06em] sm:text-3xl">
          {notFound
            ? "Ce lien ne mène à aucune réservation"
            : "Réservation indisponible"}
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-white/65">
          {notFound ? (
            <>
              Le lien est peut-être incomplet, expiré, ou le rendez-vous a été
              annulé. Vérifie le lien reçu par e-mail — ou écris-moi, je
              retrouve ça en deux minutes.
            </>
          ) : (
            <>
              Impossible de charger cette réservation pour le moment. Réessaie
              dans un instant.
            </>
          )}
        </p>

        <p className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-white/45">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pss-pink/70" />
          <span className="truncate">{message}</span>
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          {notFound ? (
            <Link to="/disponibilites" className="btn-pink">
              Voir les disponibilités
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-pink"
            >
              Réessayer
            </button>
          )}
          <Link to="/" className="btn-chrome">
            Accueil
          </Link>
        </div>

        <a
          href="https://instagram.com/pinkstar_society"
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-block text-xs uppercase tracking-[0.16em] text-white/40 underline decoration-white/20 underline-offset-4 transition hover:text-pss-pink hover:decoration-pss-pink/40"
        >
          M&apos;écrire en DM @pinkstar_society
        </a>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-white/45">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}
