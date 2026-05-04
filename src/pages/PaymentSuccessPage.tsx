import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export default function PaymentSuccessPage() {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !sessionId) {
      setStatus("err");
      setMsg("Session de paiement introuvable.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await api("/public/bookings/confirm", {
          method: "POST",
          body: JSON.stringify({ token, sessionId }),
        });
        if (!cancelled) setStatus("ok");
      } catch (e) {
        if (!cancelled) {
          setStatus("err");
          setMsg(e instanceof Error ? e.message : "Confirmation impossible");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, sessionId]);

  return (
    <div className="min-h-screen bg-[#050507] px-5 py-16 text-white">
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl uppercase tracking-[0.12em]">
          Merci
        </h1>
        {status === "idle" && (
          <p className="mt-4 text-white/65">Confirmation du paiement…</p>
        )}
        {status === "ok" && (
          <>
            <p className="mt-4 text-white/80">
              Votre paiement est bien enregistré.
            </p>
            {token && (
              <div className="mt-8 space-y-3">
                <a
                  className="block rounded-xl border border-white/15 px-4 py-3 text-sm hover:border-pss-pink/50"
                  href={`/api/public/bookings/${token}/facture.pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Télécharger la facture
                </a>
                <a
                  className="block rounded-xl border border-white/15 px-4 py-3 text-sm hover:border-pss-pink/50"
                  href={`/api/public/bookings/${token}/agenda.ics`}
                >
                  Télécharger le rendez-vous (agenda)
                </a>
                <Link
                  to={`/reservation/${token}`}
                  className="block text-sm text-pss-pink hover:underline"
                >
                  Voir le récapitulatif
                </Link>
              </div>
            )}
          </>
        )}
        {status === "err" && (
          <p className="mt-4 text-red-400">{msg}</p>
        )}
        <Link to="/" className="mt-10 inline-block text-sm text-white/50 hover:text-white">
          Accueil
        </Link>
      </div>
    </div>
  );
}
