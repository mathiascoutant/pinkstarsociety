import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { safeInternalPath } from "../lib/routes";

type Step = 1 | 2;

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = useMemo(
    () => safeInternalPath(searchParams.get("redirect")),
    [searchParams],
  );
  const connexionHref = redirectTo
    ? `/connexion?redirect=${encodeURIComponent(redirectTo)}`
    : "/connexion";

  const [step, setStep] = useState<Step>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loyaltyCode, setLoyaltyCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const step1Valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function goNext(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!step1Valid) {
      setErr("Vérifie ton prénom, ton nom et ton email.");
      return;
    }
    setStep(2);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
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
      await register({
        firstName,
        lastName,
        email,
        password,
        passwordConfirm,
        loyaltyCode: loyaltyCode.trim() || undefined,
      });
      nav(connexionHref);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507] text-white">
      {/* BG */}
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-[36rem] w-[36rem] rounded-full bg-pss-pink/20 blur-[180px]" />
      <div className="pointer-events-none absolute -right-32 -bottom-32 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/15 blur-[150px]" />

      {/* Top bar */}
      <div className="relative z-10 mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 md:px-10">
        <Link to="/" className="flex items-center gap-3">
          <span className="relative grid h-9 w-9 place-items-center">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-pss-pink/40 to-transparent blur-xl" />
            <Star />
          </span>
          <span className="font-display text-base uppercase tracking-[0.22em] text-white">
            PinkStar<span className="text-pss-pink">.</span>Society
          </span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-white/55 transition hover:text-pss-pink"
        >
          <ArrowLeft />
          Retour
        </Link>
      </div>

      {/* Card */}
      <div className="relative z-10 mx-auto w-full max-w-lg px-5 pb-16 pt-4 md:pt-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-white/55">
            <span className="font-mono text-pss-pink">/01</span>
            <span className="h-px w-10 bg-white/20" />
            <span>Espace personnel</span>
          </div>
          <h1 className="mt-4 font-display text-4xl uppercase leading-[0.92] tracking-tight sm:text-5xl">
            <span className="block chrome-pink">Rejoindre</span>
            <span className="block text-white">la Society.</span>
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/60">
            En 30 secondes, tu reçois ton espace pour suivre tes RDV et
            retrouver tes photos.
          </p>
        </motion.div>

        {/* Step indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mb-5 flex items-center gap-3"
        >
          <StepDot index={1} current={step} label="Identité" />
          <span className="h-px flex-1 bg-white/10">
            <motion.span
              initial={false}
              animate={{ width: step === 1 ? "0%" : "100%" }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              className="block h-px bg-pss-pink"
            />
          </span>
          <StepDot index={2} current={step} label="Sécurité" />
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="glass-card relative overflow-hidden rounded-3xl p-5 sm:p-7"
        >
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 ? (
              <motion.form
                key="step-1"
                onSubmit={goNext}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                className="space-y-4"
              >
                <StepHeader index={1} of={2} title="Identité" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Prénom"
                    required
                    value={firstName}
                    onChange={setFirstName}
                    placeholder="Léa"
                    autoComplete="given-name"
                  />
                  <Field
                    label="Nom"
                    required
                    value={lastName}
                    onChange={setLastName}
                    placeholder="Martin"
                    autoComplete="family-name"
                  />
                </div>

                <Field
                  label="Email"
                  type="email"
                  required
                  value={email}
                  onChange={setEmail}
                  placeholder="lea@email.com"
                  autoComplete="email"
                />

                {err && <ErrorBanner message={err} />}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    to={connexionHref}
                    className="text-center text-sm text-white/55 sm:text-left"
                  >
                    Déjà inscrit·e ?{" "}
                    <span className="text-pss-pink underline-offset-4 hover:underline">
                      Connexion
                    </span>
                  </Link>
                  <button
                    type="submit"
                    disabled={!step1Valid}
                    className="btn-pink justify-center disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continuer
                    <ArrowRight />
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="step-2"
                onSubmit={onSubmit}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                className="space-y-4"
              >
                <StepHeader index={2} of={2} title="Sécurité" />

                <div>
                  <Field
                    label="Mot de passe"
                    hint="min. 8 caractères"
                    type={showPwd ? "text" : "password"}
                    required
                    minLength={8}
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
                  {password.length > 0 && (
                    <Strength level={strength(password)} />
                  )}
                </div>

                <Field
                  label="Confirmation"
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
                  error={
                    passwordConfirm.length > 0 && password !== passwordConfirm
                      ? "Ne correspond pas"
                      : undefined
                  }
                />

                <Field
                  label="Code fidélité"
                  hint="optionnel"
                  value={loyaltyCode}
                  onChange={setLoyaltyCode}
                  placeholder="Ex : WELCOME10"
                  autoComplete="off"
                />

                {err && <ErrorBanner message={err} />}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setErr(null);
                      setStep(1);
                    }}
                    className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-[13px] uppercase tracking-[0.18em] text-white/75 transition hover:border-white/25 hover:text-white"
                  >
                    <ArrowLeft />
                    Étape précédente
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="btn-pink justify-center disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? (
                      <>
                        <Spinner />
                        Création…
                      </>
                    ) : (
                      <>
                        Créer mon compte
                        <ArrowRight />
                      </>
                    )}
                  </button>
                </div>
                <p className="pt-1 text-center text-[11px] text-white/40 sm:text-left">
                  En continuant, vous acceptez les conditions d'utilisation.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/40">
          <span>★</span>
          <span>Bordeaux · sur rendez-vous</span>
          <span>★</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Step indicator ─────────────────────────────────── */

function StepDot({
  index,
  current,
  label,
}: {
  index: 1 | 2;
  current: Step;
  label: string;
}) {
  const isActive = current === index;
  const isDone = current > index;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`grid h-7 w-7 place-items-center rounded-full border text-[11px] transition ${
          isActive
            ? "border-pss-pink bg-pss-pink text-black shadow-[0_0_15px_rgba(255,0,122,0.6)]"
            : isDone
              ? "border-pss-pink/60 bg-pss-pink/15 text-pss-pink"
              : "border-white/15 bg-white/[0.03] text-white/45"
        }`}
      >
        {isDone ? "✓" : index}
      </span>
      <span
        className={`hidden text-[10px] uppercase tracking-[0.22em] sm:inline ${
          isActive
            ? "text-white"
            : isDone
              ? "text-pss-pink"
              : "text-white/40"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function StepHeader({
  index,
  of,
  title,
}: {
  index: number;
  of: number;
  title: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="font-display text-xl uppercase tracking-[0.12em] text-white">
        {title}
      </h2>
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
        {String(index).padStart(2, "0")} / {String(of).padStart(2, "0")}
      </span>
    </div>
  );
}

/* ─── Field ─────────────────────────────────────────── */

function Field({
  label,
  hint,
  required,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  trailing,
  error,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  trailing?: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.22em] text-white/55">
          {label}
          {required && <span className="ml-1 text-pss-pink">*</span>}
        </span>
        {hint && (
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">
            {hint}
          </span>
        )}
      </div>
      <div
        className={`group relative rounded-2xl border bg-white/[0.04] backdrop-blur transition focus-within:border-pss-pink/60 focus-within:bg-white/[0.06] focus-within:ring-2 focus-within:ring-pss-pink/25 ${
          error ? "border-red-400/40" : "border-white/12 hover:border-white/20"
        }`}
      >
        <input
          type={type}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full rounded-2xl bg-transparent px-4 py-3.5 text-[15px] text-white placeholder:text-white/25 outline-none"
        />
        {trailing && (
          <div className="absolute inset-y-0 right-2 flex items-center">
            {trailing}
          </div>
        )}
      </div>
      {error && (
        <div className="mt-1.5 text-[11px] text-red-300">{error}</div>
      )}
    </label>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-sm text-red-300"
    >
      <span className="mt-0.5">⚠</span>
      <span>{message}</span>
    </motion.div>
  );
}

/* ─── Password strength ─────────────────────────────── */

function strength(p: string): 0 | 1 | 2 | 3 | 4 {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) && p.length >= 12) s++;
  return Math.min(s, 4) as 0 | 1 | 2 | 3 | 4;
}

function Strength({ level }: { level: 0 | 1 | 2 | 3 | 4 }) {
  const labels = ["", "Faible", "Correct", "Bon", "Solide"];
  const colors = [
    "bg-white/10",
    "bg-red-400/70",
    "bg-amber-300/70",
    "bg-pss-pink",
    "bg-emerald-400/80",
  ];
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition ${
              i <= level ? colors[level] : "bg-white/8"
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">
        {labels[level]}
      </span>
    </div>
  );
}

/* ─── Tiny widgets ──────────────────────────────────── */

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
      aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
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
    <svg viewBox="0 0 100 100" className="relative z-10 h-6 w-6">
      <defs>
        <linearGradient id="reg-star" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffd4ee" />
          <stop offset="0.5" stopColor="#ff007a" />
          <stop offset="1" stopColor="#5a0028" />
        </linearGradient>
      </defs>
      <polygon
        fill="url(#reg-star)"
        stroke="#0c0010"
        strokeWidth="4"
        strokeLinejoin="round"
        points="50,5 61,38 96,38 67,58 78,92 50,72 22,92 33,58 4,38 39,38"
      />
    </svg>
  );
}
