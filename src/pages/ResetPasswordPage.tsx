import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(
    () => searchParams.get("token")?.trim() ?? "",
    [searchParams],
  );

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!token) {
      setErr("Lien invalide ou expiré.");
      return;
    }
    if (password.length < 8) {
      setErr("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== passwordConfirm) {
      setErr("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password, passwordConfirm }),
      });
      setDone(true);
      setTimeout(() => nav("/connexion"), 2500);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-1/4 h-[26rem] w-[26rem] rounded-full bg-pss-pink/15 blur-[160px]" />
        <div className="absolute -right-32 -bottom-32 h-[20rem] w-[20rem] rounded-full bg-fuchsia-500/12 blur-[140px]" />
        <div className="absolute inset-0 grid-noise opacity-20" />
      </div>

      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-5 py-5 lg:px-12">
          <Link to="/" className="flex items-center gap-3" aria-label="Accueil">
            <span className="grid h-8 w-8 place-items-center">
              <Star />
            </span>
            <span className="font-display text-sm uppercase tracking-[0.06em] text-white">
              PinkStar<span className="text-pss-pink">.</span>Society
            </span>
          </Link>
          <Link
            to="/connexion"
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-white/55 transition hover:text-pss-pink"
          >
            <ArrowLeft />
            Connexion
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="mb-8">
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-white/55">
                <span className="font-mono text-pss-pink">/02</span>
                <span className="h-px w-10 bg-white/15" />
                <span>Nouveau mot de passe</span>
              </div>
              <h1 className="mt-4 font-display text-4xl uppercase leading-[1] tracking-[-0.02em] sm:text-5xl">
                <span className="block py-[0.06em] text-white">
                  Réinitialisation.
                </span>
              </h1>
              <p className="mt-3 max-w-sm font-serif text-[16px] leading-relaxed text-white/65">
                Choisis un nouveau mot de passe pour ton compte.
              </p>
            </div>

            {!token ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-sm text-red-300"
              >
                Lien invalide ou expiré.{" "}
                <Link
                  to="/connexion"
                  className="font-medium text-pss-pink underline-offset-4 hover:underline"
                >
                  Retour à la connexion
                </Link>
              </div>
            ) : done ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.08] px-4 py-3 text-sm text-emerald-300"
              >
                <span className="mt-0.5">✓</span>
                <span>
                  Mot de passe mis à jour ! Redirection vers la connexion…
                </span>
              </motion.div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <Field
                  label="Nouveau mot de passe"
                  type={showPwd ? "text" : "password"}
                  required
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  trailing={
                    <ToggleEye
                      shown={showPwd}
                      onToggle={() => setShowPwd((v) => !v)}
                    />
                  }
                />
                <Field
                  label="Confirmer le mot de passe"
                  type={showPwd2 ? "text" : "password"}
                  required
                  value={passwordConfirm}
                  onChange={setPasswordConfirm}
                  autoComplete="new-password"
                  trailing={
                    <ToggleEye
                      shown={showPwd2}
                      onToggle={() => setShowPwd2((v) => !v)}
                    />
                  }
                />

                {err && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-sm text-red-300"
                  >
                    <span className="mt-0.5">⚠</span>
                    <span>{err}</span>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="btn-pink mt-2 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Spinner />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      Enregistrer
                      <ArrowRight />
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  type = "text",
  value,
  onChange,
  autoComplete,
  trailing,
}: {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.22em] text-white/55">
          {label}
          {required && <span className="ml-1 text-pss-pink">*</span>}
        </span>
      </div>
      <div className="group relative rounded-xl border border-white/12 bg-white/[0.04] backdrop-blur transition hover:border-white/20 focus-within:border-pss-pink/60 focus-within:bg-white/[0.06] focus-within:ring-2 focus-within:ring-pss-pink/25">
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-xl bg-transparent px-4 py-3 text-[15px] text-white placeholder:text-white/25 outline-none"
        />
        {trailing && (
          <div className="absolute inset-y-0 right-1.5 flex items-center">
            {trailing}
          </div>
        )}
      </div>
    </label>
  );
}

function ToggleEye({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        shown ? "Masquer le mot de passe" : "Afficher le mot de passe"
      }
      className="grid h-9 w-9 place-items-center rounded-full text-white/55 transition hover:text-pss-pink"
    >
      {shown ? <EyeOff /> : <Eye />}
    </button>
  );
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8M9.9 5.2A10 10 0 0 1 22 12s-1 2-3 4M6.4 6.5C3.7 8.3 2 12 2 12s3.5 7 10 7c2 0 3.7-.5 5.1-1.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12h14M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M19 12H5M11 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Star() {
  return (
    <svg viewBox="0 0 100 100" className="h-6 w-6">
      <defs>
        <linearGradient id="reset-mini-star" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffd4ee" />
          <stop offset="0.5" stopColor="#f43f9b" />
          <stop offset="1" stopColor="#d61e7c" />
        </linearGradient>
      </defs>
      <polygon
        fill="url(#reset-mini-star)"
        stroke="#0c0010"
        strokeWidth="4"
        strokeLinejoin="round"
        points="50,5 61,38 96,38 67,58 78,92 50,72 22,92 33,58 4,38 39,38"
      />
    </svg>
  );
}
