import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { safeInternalPath } from "../lib/routes";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = useMemo(
    () => safeInternalPath(searchParams.get("redirect")),
    [searchParams],
  );
  const inscriptionHref = redirectTo
    ? `/inscription?redirect=${encodeURIComponent(redirectTo)}`
    : "/inscription";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const u = await login(email, password);
      if (redirectTo) {
        nav(redirectTo);
        return;
      }
      if (u.role === "admin") nav("/admin");
      else nav("/");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507] text-white lg:flex">
      {/* ──────────────── LEFT BRAND PANEL ──────────────── */}
      <aside className="relative hidden overflow-hidden lg:flex lg:w-[52%] lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Background art */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(244,63,155,0.18),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(244,63,155,0.12),transparent_55%)]" />
          <div className="absolute inset-0 grid-noise opacity-25" />
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
        </div>

        {/* TOP — logo */}
        <Link to="/" className="relative z-10 inline-flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center">
            <Star />
          </span>
          <span className="font-display text-base uppercase tracking-[0.06em] text-white">
            PinkStar<span className="text-pss-pink">.</span>Society
          </span>
        </Link>

        {/* MIDDLE — visual + tagline */}
        <div className="relative z-10 flex flex-col items-start gap-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative"
          >
            <BrandStar />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="max-w-md"
          >
            <p className="text-[10px] uppercase tracking-[0.32em] text-white/45">
              ★ Bon retour
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-white xl:text-4xl">
              « Tes ongles, ton studio,
              <br />
              <span className="text-pss-pink">ton espace.</span> »
            </h2>
            <p className="mt-4 max-w-sm font-body text-[14px] leading-relaxed text-white/55">
              Retrouve tes rendez-vous, ta galerie privée, et tes points
              fidélité — au même endroit.
            </p>
          </motion.div>
        </div>

        {/* BOTTOM */}
        <div className="relative z-10 flex items-center justify-between text-[10px] uppercase tracking-[0.32em] text-white/40">
          <span>★ Bordeaux · sur rendez-vous</span>
          <span className="font-mono">PSS / 2026</span>
        </div>
      </aside>

      {/* ──────────────── RIGHT FORM PANEL ──────────────── */}
      <main className="relative flex min-h-screen w-full flex-col lg:w-[48%]">
        {/* Mobile header */}
        <div className="flex items-center justify-between px-5 py-5 lg:px-12 lg:py-6 xl:px-16">
          <Link
            to="/"
            className="flex items-center gap-3 lg:hidden"
            aria-label="Accueil"
          >
            <span className="grid h-8 w-8 place-items-center">
              <Star />
            </span>
            <span className="font-display text-sm uppercase tracking-[0.06em] text-white">
              PinkStar<span className="text-pss-pink">.</span>Society
            </span>
          </Link>
          <span className="hidden lg:inline" />
          <Link
            to="/"
            className="ml-auto flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-white/55 transition hover:text-pss-pink"
          >
            <ArrowLeft />
            Retour à l'accueil
          </Link>
        </div>

        {/* BG accents (mobile only — desktop has the left panel) */}
        <div className="pointer-events-none absolute inset-0 -z-10 lg:hidden">
          <div className="absolute -left-32 top-1/4 h-[26rem] w-[26rem] rounded-full bg-pss-pink/15 blur-[160px]" />
          <div className="absolute -right-32 -bottom-32 h-[20rem] w-[20rem] rounded-full bg-fuchsia-500/12 blur-[140px]" />
          <div className="absolute inset-0 grid-noise opacity-20" />
        </div>

        {/* CENTER */}
        <div className="flex flex-1 items-center justify-center px-5 pb-12 pt-2 lg:px-12 xl:px-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-full max-w-md"
          >
            {/* Heading */}
            <div className="mb-8">
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-white/55">
                <span className="font-mono text-pss-pink">/02</span>
                <span className="h-px w-10 bg-white/15" />
                <span>Connexion</span>
              </div>
              <h1 className="mt-4 font-display text-4xl uppercase leading-[1] tracking-[-0.02em] sm:text-5xl">
                <span className="block py-[0.06em] text-white">Bon retour.</span>
              </h1>
              <p className="mt-3 max-w-sm font-serif text-[16px] leading-relaxed text-white/65 md:text-[17px]">
                Connecte-toi pour accéder à ton espace personnel.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <Field
                label="Email"
                type="email"
                required
                value={email}
                onChange={setEmail}
                placeholder="ton@email.com"
                autoComplete="email"
              />

              <Field
                label="Mot de passe"
                type={showPwd ? "text" : "password"}
                required
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                trailing={
                  <ToggleEye
                    shown={showPwd}
                    onToggle={() => setShowPwd((v) => !v)}
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
                    Connexion…
                  </>
                ) : (
                  <>
                    Se connecter
                    <ArrowRight />
                  </>
                )}
              </button>
            </form>

            <div className="my-7 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] uppercase tracking-[0.32em] text-white/35">
                ou
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex flex-col items-center gap-3 text-center text-sm text-white/55">
              <div>
                Pas encore de compte ?{" "}
                <Link
                  to={inscriptionHref}
                  className="font-medium text-pss-pink underline-offset-4 hover:underline"
                >
                  Créer un compte
                </Link>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer mini line — desktop right panel */}
        <div className="hidden items-center justify-between px-12 py-6 text-[10px] uppercase tracking-[0.32em] text-white/30 lg:flex xl:px-16">
          <span>Espace sécurisé · données chiffrées</span>
          <span className="font-mono">PSS</span>
        </div>
      </main>
    </div>
  );
}

/* ─── Field ─────────────────────────────────────────── */

function Field({
  label,
  required,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  trailing,
}: {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
          placeholder={placeholder}
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

/* ─── Brand visual (left panel) ─────────────────────── */

function BrandStar() {
  return (
    <div className="relative grid h-72 w-72 place-items-center xl:h-96 xl:w-96">
      <motion.div
        animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.06, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-0 grid place-items-center"
      >
        <div className="h-full w-full rounded-full bg-pss-pink/30 blur-3xl" />
      </motion.div>

      <img
        src="/logo.png"
        alt="Pink Star Society"
        loading="eager"
        decoding="async"
        style={{
          mixBlendMode: "screen",
          WebkitMaskImage:
            "radial-gradient(circle at center, #000 60%, rgba(0,0,0,0.7) 75%, transparent 90%)",
          maskImage:
            "radial-gradient(circle at center, #000 60%, rgba(0,0,0,0.7) 75%, transparent 90%)",
          filter:
            "drop-shadow(0 0 30px rgba(244,63,155,0.95)) drop-shadow(0 0 60px rgba(255,182,221,0.55)) saturate(1.1)",
        }}
        className="relative z-10 h-full w-full select-none object-contain"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = "none";
          const sib = target.nextElementSibling as HTMLElement | null;
          if (sib) sib.style.display = "block";
        }}
      />

      {/* Fallback */}
      <svg
        style={{ display: "none" }}
        viewBox="0 0 200 200"
        className="relative z-10 h-full w-full drop-shadow-[0_0_50px_rgba(244,63,155,0.4)]"
      >
        <polygon
          fill="#f43f9b"
          stroke="#0c0010"
          strokeWidth="6"
          strokeLinejoin="round"
          points="100,18 122,72 180,72 132,108 152,168 100,128 48,168 68,108 20,72 78,72"
        />
      </svg>
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
        <linearGradient id="login-mini-star" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffd4ee" />
          <stop offset="0.5" stopColor="#f43f9b" />
          <stop offset="1" stopColor="#d61e7c" />
        </linearGradient>
      </defs>
      <polygon
        fill="url(#login-mini-star)"
        stroke="#0c0010"
        strokeWidth="4"
        strokeLinejoin="round"
        points="50,5 61,38 96,38 67,58 78,92 50,72 22,92 33,58 4,38 39,38"
      />
    </svg>
  );
}
