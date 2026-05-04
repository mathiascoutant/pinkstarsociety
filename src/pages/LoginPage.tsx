import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
    <div className="min-h-screen bg-[#050507] px-5 py-16 text-white">
      <div className="mx-auto w-full max-w-md">
        <Link
          to="/"
          className="text-sm uppercase tracking-[0.2em] text-white/50 hover:text-pss-pink"
        >
          Retour
        </Link>
        <h1 className="mt-8 font-display text-3xl uppercase tracking-[0.12em]">
          Connexion
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Accédez à votre espace Pink Star Society.
        </p>
        <form onSubmit={onSubmit} className="mt-10 space-y-4">
          <label className="block text-xs uppercase tracking-[0.18em] text-white/50">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-pss-pink/60"
            />
          </label>
          <label className="block text-xs uppercase tracking-[0.18em] text-white/50">
            Mot de passe
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-pss-pink/60"
            />
          </label>
          {err && (
            <p className="text-sm text-red-400" role="alert">
              {err}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="btn-pink w-full justify-center disabled:opacity-50"
          >
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-white/55">
          Pas encore de compte ?{" "}
          <Link to={inscriptionHref} className="text-pss-pink hover:underline">
            Inscription
          </Link>
        </p>
      </div>
    </div>
  );
}
