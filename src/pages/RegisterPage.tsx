import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { safeInternalPath } from "../lib/routes";

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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
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
      });
      nav(connexionHref);
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
          Inscription
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Créez un compte client. Le rôle administrateur est attribué via
          configuration.
        </p>
        <form onSubmit={onSubmit} className="mt-10 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs uppercase tracking-[0.18em] text-white/50">
              Prénom
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-pss-pink/60"
              />
            </label>
            <label className="block text-xs uppercase tracking-[0.18em] text-white/50">
              Nom
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-pss-pink/60"
              />
            </label>
          </div>
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
            Mot de passe (min. 8 caractères)
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-pss-pink/60"
            />
          </label>
          <label className="block text-xs uppercase tracking-[0.18em] text-white/50">
            Confirmation
            <input
              type="password"
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
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
            {busy ? "Création…" : "Créer mon compte"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-white/55">
          Déjà inscrit ?{" "}
          <Link to={connexionHref} className="text-pss-pink hover:underline">
            Connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
