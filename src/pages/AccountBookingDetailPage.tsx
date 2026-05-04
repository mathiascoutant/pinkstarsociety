import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useLenis } from "../lib/useLenis";
import { api } from "../lib/api";

const easeOut = [0.2, 0.8, 0.2, 1] as const;

type BookingDetail = {
  id: string;
  publicToken: string;
  publicUrl: string;
  serviceTypeName: string;
  date: string;
  time: string;
  priceCents: number;
  depositCents: number;
  description: string;
  paymentStatus: string;
  visitStatus?: string;
  visitLabelFR?: string;
};

function fmtEUR(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function payMeta(status: string): { label: string; tone: "ok" | "mid" | "wait" } {
  switch (status) {
    case "paid":
      return { label: "Totalité payée", tone: "ok" };
    case "deposit_paid":
      return { label: "Acompte payé", tone: "mid" };
    case "pending":
      return { label: "En attente de paiement", tone: "wait" };
    default:
      return { label: status, tone: "wait" };
  }
}

function formatDateLong(iso: string) {
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function AccountBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 grid-noise opacity-20" />
      <motion.div
        animate={{ opacity: [0.32, 0.58, 0.32] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-28 top-16 h-[26rem] w-[26rem] rounded-full bg-pss-pink/16 blur-[130px] md:h-[34rem] md:w-[34rem]"
      />
      <div className="absolute -right-24 top-1/3 h-[20rem] w-[20rem] rounded-full bg-fuchsia-500/8 blur-[110px]" />
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-pss-ink to-transparent" />
    </div>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#050507] text-white">
      <Navbar />
      <main className="relative flex-1">
        <AccountBackground />
        <div className="relative z-10 mx-auto w-full max-w-2xl px-5 pb-24 pt-28 md:px-8 md:pt-36">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "mid" | "wait" | "neutral";
}) {
  const ring =
    tone === "ok"
      ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
      : tone === "mid"
        ? "border-amber-400/35 bg-amber-500/10 text-amber-100"
        : tone === "wait"
          ? "border-white/15 bg-white/[0.06] text-white/75"
          : "border-white/12 bg-white/[0.04] text-white/70";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${ring}`}
    >
      {label}
    </span>
  );
}

function DetailShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative glass-card overflow-hidden rounded-2xl border border-white/10 p-6 md:p-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      {children}
    </div>
  );
}

export default function AccountBookingDetailPage() {
  useLenis();
  const { id } = useParams<{ id: string }>();
  const [b, setB] = useState<BookingDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let c = false;
    void (async () => {
      try {
        const row = await api<BookingDetail>(`/me/bookings/${id}`);
        if (!c) setB(row);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Introuvable");
      }
    })();
    return () => {
      c = true;
    };
  }, [id]);

  if (err) {
    return (
      <PageFrame>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-500/25 bg-red-500/[0.07] p-8 text-center"
        >
          <p className="font-display text-lg uppercase tracking-[0.1em] text-red-200">
            Impossible d’afficher la prestation
          </p>
          <p className="mt-3 text-sm text-white/55">{err}</p>
          <Link
            to="/compte/fidelite"
            className="mt-6 inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-white transition hover:border-pss-pink/40 hover:text-pss-pink"
          >
            Retour aux séances
          </Link>
        </motion.div>
      </PageFrame>
    );
  }

  if (!b) {
    return (
      <PageFrame>
        <div className="flex flex-col items-center justify-center py-20">
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-pss-pink to-transparent"
          />
          <p className="mt-6 text-xs uppercase tracking-[0.22em] text-white/40">
            Chargement de la prestation…
          </p>
        </div>
      </PageFrame>
    );
  }

  const pay = payMeta(b.paymentStatus);
  const remaining =
    b.paymentStatus === "deposit_paid"
      ? Math.max(0, b.priceCents - b.depositCents)
      : null;

  return (
    <PageFrame>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <nav className="text-[11px] uppercase tracking-[0.28em] text-white/45">
          <Link to="/" className="transition hover:text-pss-pink">
            Accueil
          </Link>
          <span className="mx-2 text-white/20">/</span>
          <Link to="/compte/fidelite" className="transition hover:text-pss-pink">
            Fidélité
          </Link>
          <span className="mx-2 text-white/20">/</span>
          <span className="text-white/65">Prestation</span>
        </nav>

        <p className="mt-8 text-[10px] uppercase tracking-[0.26em] text-pss-pink/90">
          Rendez-vous
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-[1.05] tracking-tight text-white md:text-4xl">
          {b.serviceTypeName}
        </h1>
        <p className="mt-3 capitalize text-white/55 md:text-lg">
          {formatDateLong(b.date)}
        </p>
        <p className="mt-1 text-sm text-white/40">
          Heure prévue · <span className="text-white/80">{b.time}</span>
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <StatusBadge label={pay.label} tone={pay.tone} />
          {b.visitLabelFR ? (
            <StatusBadge label={b.visitLabelFR} tone="neutral" />
          ) : null}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.55, ease: easeOut }}
        className="mt-10 space-y-5"
      >
        <DetailShell>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
            Montants
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                Total
              </p>
              <p className="mt-1 font-display text-2xl text-white tabular-nums">
                {fmtEUR(b.priceCents)}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                Acompte
              </p>
              <p className="mt-1 font-display text-2xl text-white/90 tabular-nums">
                {fmtEUR(b.depositCents)}
              </p>
            </div>
          </div>
          {remaining != null && remaining > 0 ? (
            <div className="mt-4 rounded-xl border border-pss-pink/20 bg-pss-pink/[0.06] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">
                Solde à régler
              </p>
              <p className="mt-1 font-display text-xl text-pss-pink tabular-nums">
                {fmtEUR(remaining)}
              </p>
            </div>
          ) : null}
        </DetailShell>

        {b.description?.trim() ? (
          <DetailShell>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
              Notes
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-white/75">
              {b.description.trim()}
            </p>
          </DetailShell>
        ) : null}

        <motion.a
          href={b.publicUrl}
          target="_blank"
          rel="noreferrer"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-pss-pink/40 bg-gradient-to-b from-pss-pink/25 to-pss-pink/10 py-4 text-center text-sm font-medium uppercase tracking-[0.12em] text-white shadow-[0_0_32px_rgba(255,43,177,0.12)] transition hover:border-pss-pink/55 hover:from-pss-pink/35 hover:to-pss-pink/15"
        >
          Paiement & documents
          <span aria-hidden className="text-base opacity-80">
            ↗
          </span>
        </motion.a>

        <p className="text-center text-[11px] text-white/35">
          Lien sécurisé vers ta page de réservation (factures, calendrier, paiement
          en ligne).
        </p>
      </motion.div>
    </PageFrame>
  );
}
