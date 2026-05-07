import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type PublicBooking = {
  serviceTypeName: string;
  date: string;
  time: string;
  priceCents: number;
  depositCents: number;
  remainingCents: number;
  description: string;
  paymentStatus: string;
  visitStatus?: string;
  visitLabelFR?: string;
  canPayDeposit: boolean;
  canPayFull: boolean;
  canPayBalance: boolean;
  paidLabel: string;
  /** true si la même demi-journée a déjà été réservée par quelqu'un d'autre. */
  slotTaken?: boolean;
};

type PayKind = "full" | "deposit" | "balance";

function fmtEUR(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
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

  async function checkout(
    kind: PayKind,
    guest?: { firstName: string; lastName: string; email: string },
  ) {
    if (!token) return;
    setPayBusy(kind);
    try {
      const body: Record<string, unknown> = { kind };
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

  function onPayClick(kind: PayKind) {
    if (user) {
      void checkout(kind);
      return;
    }
    setPendingKind(kind);
    setAuthModal(true);
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
    setGuestModal(false);
    setPendingKind(null);
    if (k) void checkout(k, { firstName: first, lastName: last, email });
  }

  if (err) {
    return (
      <div className="min-h-screen bg-[#050507] px-5 py-20 text-white">
        <p className="text-red-400">{err}</p>
        <Link to="/" className="mt-6 inline-block text-pss-pink">
          Accueil
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-[#050507] px-5 py-20 text-white">
        Chargement…
      </div>
    );
  }

  const paid =
    data.paymentStatus === "paid" || data.paymentStatus === "deposit_paid";

  return (
    <div className="min-h-screen bg-[#050507] px-5 py-16 text-white">
      <div className="mx-auto max-w-lg">
        <Link
          to="/"
          className="text-sm uppercase tracking-[0.2em] text-white/50 hover:text-pss-pink"
        >
          Accueil
        </Link>
        <h1 className="mt-8 font-display text-2xl uppercase tracking-[0.12em]">
          Votre prestation
        </h1>
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
          {data.description && (
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                Description
              </p>
              <p className="mt-1 text-sm text-white/80">{data.description}</p>
            </div>
          )}
        </div>

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
                  Désolé, ce créneau vient d'être réservé.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  Une autre personne a confirmé son rendez-vous sur la même
                  demi-journée. Le paiement n'est plus possible pour cette
                  offre.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  Tu peux m'envoyer un message en DM Instagram pour qu'on te
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
                    Voir d'autres dates
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {!data.slotTaken && data.paymentStatus !== "paid" && (
          <div className="mt-8 flex flex-col gap-3">
            {data.canPayDeposit && (
              <button
                type="button"
                disabled={payBusy !== null}
                onClick={() => onPayClick("deposit")}
                className="rounded-xl border border-pss-pink/50 bg-pss-pink/10 px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white transition hover:bg-pss-pink/20 disabled:opacity-50"
              >
                {payBusy === "deposit"
                  ? "Redirection…"
                  : `Payer l'acompte (${fmtEUR(data.depositCents)})`}
              </button>
            )}
            {data.canPayFull && (
              <button
                type="button"
                disabled={payBusy !== null}
                onClick={() => onPayClick("full")}
                className="btn-pink justify-center disabled:opacity-50"
              >
                {payBusy === "full"
                  ? "Redirection…"
                  : `Payer la totalité (${fmtEUR(data.priceCents)})`}
              </button>
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
          </div>
        )}

        {paid && token && (
          <div className="mt-10 space-y-3 border-t border-white/10 pt-8">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">
              Après paiement
            </p>
            <a
              className="block rounded-xl border border-white/15 px-4 py-3 text-center text-sm hover:border-pss-pink/50"
              href={`/api/public/bookings/${token}/facture.pdf`}
              target="_blank"
              rel="noreferrer"
            >
              Télécharger la facture (PDF)
            </a>
            <a
              className="block rounded-xl border border-white/15 px-4 py-3 text-center text-sm hover:border-pss-pink/50"
              href={`/api/public/bookings/${token}/agenda.ics`}
            >
              Ajouter à l’agenda (.ics)
            </a>
          </div>
        )}
      </div>

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
              On en a besoin pour t'envoyer ta confirmation et ton QR de présence par e-mail.
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-white/45">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}
