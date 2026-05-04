import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

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

function payLabel(s: string) {
  switch (s) {
    case "deposit_paid":
      return "Acompte payé";
    case "paid":
      return "Totalité payée";
    case "pending":
      return "En attente de paiement";
    default:
      return s;
  }
}

export default function AccountBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [b, setB] = useState<BookingDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let c = false;
    (async () => {
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
      <div className="min-h-screen bg-[#050507] px-5 py-16 text-white">
        <p className="text-red-400">{err}</p>
        <Link to="/compte/fidelite" className="mt-4 inline-block text-pss-pink">
          Retour à la fidélité
        </Link>
      </div>
    );
  }
  if (!b) {
    return (
      <div className="min-h-screen bg-[#050507] px-5 py-16 text-white">
        Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] px-5 py-16 text-white">
      <div className="mx-auto max-w-lg">
        <Link
          to="/compte/fidelite"
          className="text-sm uppercase tracking-[0.2em] text-white/50 hover:text-pss-pink"
        >
          Fidélité & séances
        </Link>
        <h1 className="mt-8 font-display text-xl uppercase tracking-[0.12em]">
          Détail prestation
        </h1>

        <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm">
          <Row label="Prestation" value={b.serviceTypeName} />
          <Row label="Date" value={b.date} />
          <Row label="Heure" value={b.time} />
          <Row label="Montant total" value={fmtEUR(b.priceCents)} />
          <Row label="Acompte" value={fmtEUR(b.depositCents)} />
          <Row label="Paiement" value={payLabel(b.paymentStatus)} />
          <Row
            label="Visite"
            value={b.visitLabelFR || "—"}
          />
          {b.description && (
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                Description
              </p>
              <p className="mt-1 text-white/80">{b.description}</p>
            </div>
          )}
        </div>

        <a
          href={b.publicUrl}
          className="mt-6 block rounded-xl border border-pss-pink/40 bg-pss-pink/10 py-3 text-center text-sm text-white transition hover:bg-pss-pink/20"
        >
          Ouvrir la page de paiement / documents
        </a>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/45">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
