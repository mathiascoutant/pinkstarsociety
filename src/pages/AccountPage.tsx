import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { useLenis } from "../lib/useLenis";
import { api } from "../lib/api";

const easeOut = [0.2, 0.8, 0.2, 1] as const;

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOut } },
};

function AccountBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 grid-noise opacity-20" />
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-32 top-10 h-[32rem] w-[32rem] rounded-full bg-pss-pink/15 blur-[160px]"
      />
      <div className="absolute -right-16 top-1/4 h-[24rem] w-[24rem] rounded-full bg-fuchsia-500/10 blur-[130px]" />
      <div className="absolute bottom-0 left-1/2 h-[18rem] w-[min(90vw,48rem)] -translate-x-1/2 rounded-full bg-violet-600/6 blur-[100px]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-pss-ink to-transparent" />
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-medium uppercase tracking-[0.08em] transition-all duration-300 ${
        active
          ? "bg-pss-pink/12 text-white shadow-[0_0_24px_rgba(255,43,177,0.15)] ring-1 ring-pss-pink/25"
          : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
        {label}
      </label>
      {children}
    </div>
  );
}

function ModernInput({
  value,
  onChange,
  type = "text",
  placeholder = "",
  autoComplete,
  required,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {icon && (
        <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25">
          {icon}
        </div>
      )}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 text-sm text-white outline-none transition-all duration-300 placeholder:text-white/20 focus:border-pss-pink/40 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(255,43,177,0.08)] ${
          icon ? "pl-10 pr-4" : "px-4"
        }`}
      />
    </div>
  );
}

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="8.5" r="3.4" />
    <path d="M5 19.5c1.5-3.4 4.2-5 7-5s5.5 1.6 7 5" strokeLinecap="round" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" strokeLinecap="round" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3.5l7.5 2.5v6c0 4.5-3.4 7.6-7.5 8.5-4.1-.9-7.5-4-7.5-8.5V6L12 3.5Z" strokeLinejoin="round" />
  </svg>
);

export default function AccountPage() {
  useLenis();
  const navigate = useNavigate();
  const { user, refresh, logout } = useAuth();

  const [tab, setTab] = useState<"profile" | "security" | "danger">("profile");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [currentPasswordForChange, setCurrentPasswordForChange] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
  }, [user]);

  useEffect(() => {
    if (!deleteOpen) {
      setDeletePassword("");
      setDeleteErr(null);
    }
  }, [deleteOpen]);

  useEffect(() => {
    if (msg) {
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), 4000);
      return () => clearTimeout(t);
    }
  }, [msg]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const body: Record<string, string> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
      };
      const np = newPassword.trim();
      if (np !== "") {
        body.password = np;
        body.passwordConfirm = newPasswordConfirm.trim();
        body.currentPassword = currentPasswordForChange.trim();
      }
      await api("/me", { method: "PATCH", body: JSON.stringify(body) });
      setMsg("Profil mis à jour.");
      setNewPassword("");
      setNewPasswordConfirm("");
      setCurrentPasswordForChange("");
      await refresh();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteErr(null);
    setBusy(true);
    try {
      await api("/me", {
        method: "DELETE",
        body: JSON.stringify({ currentPassword: deletePassword }),
      });
      logout();
      navigate("/", { replace: true });
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()
    : "?";

  return (
    <div className="relative min-h-screen bg-[#050507] text-white">
      <Navbar />

      <main className="relative">
        <AccountBackground />

        <div className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-28 md:px-8 md:pt-36">
          <AnimatePresence>
            {showSuccess && msg && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: easeOut }}
                className="fixed left-1/2 top-20 z-[90] -translate-x-1/2"
              >
                <div className="flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm text-emerald-200 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {msg}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.div variants={fadeUp}>
              <p className="text-[11px] uppercase tracking-[0.32em] text-white/35">
                <Link to="/" className="transition hover:text-pss-pink">
              Accueil
            </Link>
                <span className="mx-2 text-white/20">/</span>
                <span className="text-white/55">Compte</span>
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-8">
              <div className="glass-card overflow-hidden rounded-2xl">
                <div className="relative overflow-hidden px-6 py-8 md:px-10 md:py-10">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pss-pink/8 via-transparent to-violet-500/5" />
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-pss-pink/10 blur-[80px]" />
                  <div className="relative flex items-center gap-5 md:gap-6">
                    <div className="relative">
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-pss-pink/30 to-pss-hot/20 font-display text-2xl tracking-wider shadow-[0_0_40px_rgba(255,43,177,0.2)] ring-1 ring-white/10">
                        {initials}
                      </div>
                      <div className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 ring-2 ring-[#050507]">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h1 className="font-display text-2xl uppercase tracking-[0.08em] md:text-3xl">
                        <span className="text-white">Bonjour, </span>
                        <span className="chrome-pink">{user?.firstName}</span>
                      </h1>
                      <p className="mt-1 truncate text-sm text-white/40 md:text-[15px]">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.55, ease: easeOut }}
            className="mt-8 flex gap-2 overflow-x-auto pb-1 md:gap-2"
          >
            <TabButton
              active={tab === "profile"}
              onClick={() => setTab("profile")}
              icon={<UserIcon />}
              label="Profil"
            />
            <TabButton
              active={tab === "security"}
              onClick={() => setTab("security")}
              icon={<LockIcon />}
              label="Mot de passe"
            />
            <TabButton
              active={tab === "danger"}
              onClick={() => setTab("danger")}
              icon={<ShieldIcon />}
              label="Zone sensible"
            />
          </motion.div>

          <div className="relative mt-6">
            <AnimatePresence mode="wait">
              {tab === "profile" && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.35, ease: easeOut }}
                >
                  <form
                    onSubmit={(e) => void saveProfile(e)}
                    className="glass-card overflow-hidden rounded-2xl"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pss-pink/40 to-transparent" />
                    <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-5 md:px-8">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-pss-pink/10">
                        <UserIcon />
                      </div>
                      <div>
                        <h2 className="font-display text-base uppercase tracking-[0.1em]">
                          Informations personnelles
                        </h2>
                        <p className="text-[11px] text-white/35">
                          Modifie ton nom et ton adresse email
                        </p>
          </div>
        </div>

                    <div className="space-y-5 px-6 py-6 md:px-8 md:py-8">
                      <div className="grid gap-5 md:grid-cols-2">
                        <FieldGroup label="Prénom">
                          <ModernInput
                            required
                            value={firstName}
                            onChange={setFirstName}
                            autoComplete="given-name"
                            icon={<UserIcon />}
                          />
                        </FieldGroup>
                        <FieldGroup label="Nom">
                          <ModernInput
                            required
                            value={lastName}
                            onChange={setLastName}
                            autoComplete="family-name"
                            icon={<UserIcon />}
                          />
                        </FieldGroup>
            </div>

                      <FieldGroup label="Email">
                        <ModernInput
                          required
                          type="email"
                          value={email}
                          onChange={setEmail}
                          autoComplete="email"
                          icon={<MailIcon />}
                        />
                      </FieldGroup>

                      <div className="border-t border-white/[0.06] pt-5">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                          Optionnel — changement de mot de passe
            </p>
          </div>

                      <div className="grid gap-5 md:grid-cols-2">
                        <FieldGroup label="Nouveau mot de passe">
                          <ModernInput
                            type="password"
                            value={newPassword}
                            onChange={setNewPassword}
                            autoComplete="new-password"
                            placeholder="Laisser vide pour ne pas changer"
                            icon={<LockIcon />}
                          />
                        </FieldGroup>
                        <FieldGroup label="Confirmer le mot de passe">
                          <ModernInput
                            type="password"
                            value={newPasswordConfirm}
                            onChange={setNewPasswordConfirm}
                            autoComplete="new-password"
                            placeholder="Confirmer"
                            icon={<LockIcon />}
                          />
                        </FieldGroup>
                      </div>

                      <FieldGroup label="Mot de passe actuel">
                        <ModernInput
                          type="password"
                          value={currentPasswordForChange}
                          onChange={setCurrentPasswordForChange}
                          autoComplete="current-password"
                          placeholder="Requis si tu changes le mot de passe"
                          icon={<LockIcon />}
                        />
                      </FieldGroup>

                      {formErr && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300"
                          role="alert"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          {formErr}
                        </motion.div>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={busy}
                          className="btn-pink disabled:opacity-50"
                        >
                          {busy ? "Enregistrement…" : "Enregistrer"}
                          {!busy && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14M13 5l7 7-7 7" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </motion.div>
              )}

              {tab === "security" && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.35, ease: easeOut }}
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newPassword.trim()) {
                        setFormErr("Entre un nouveau mot de passe.");
                        return;
                      }
                      void saveProfile(e);
                    }}
                    className="glass-card overflow-hidden rounded-2xl"
                  >
                    <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-5 md:px-8">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/10">
                        <LockIcon />
                      </div>
                      <div>
                        <h2 className="font-display text-base uppercase tracking-[0.1em]">
                          Changer le mot de passe
                        </h2>
                        <p className="text-[11px] text-white/35">
                          Saisis ton nouveau mot de passe ci-dessous
                        </p>
                      </div>
                    </div>

                    <div className="space-y-5 px-6 py-6 md:px-8 md:py-8">
                      <FieldGroup label="Mot de passe actuel">
                        <ModernInput
                          type="password"
                          value={currentPasswordForChange}
                          onChange={setCurrentPasswordForChange}
                          autoComplete="current-password"
                          placeholder="Ton mot de passe actuel"
                          icon={<LockIcon />}
                        />
                      </FieldGroup>

                      <div className="grid gap-5 md:grid-cols-2">
                        <FieldGroup label="Nouveau mot de passe">
                          <ModernInput
                            type="password"
                            value={newPassword}
                            onChange={setNewPassword}
                            autoComplete="new-password"
                            placeholder="Min. 8 caractères"
                            icon={<LockIcon />}
                          />
                        </FieldGroup>
                        <FieldGroup label="Confirmer le nouveau">
                          <ModernInput
                            type="password"
                            value={newPasswordConfirm}
                            onChange={setNewPasswordConfirm}
                            autoComplete="new-password"
                            placeholder="Retape le nouveau mot de passe"
                            icon={<LockIcon />}
                          />
                        </FieldGroup>
                      </div>

                      {formErr && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300"
                          role="alert"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          {formErr}
                        </motion.div>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={busy}
                          className="btn-pink disabled:opacity-50"
                        >
                          {busy ? "Mise à jour…" : "Changer le mot de passe"}
                          {!busy && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14M13 5l7 7-7 7" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </motion.div>
              )}

              {tab === "danger" && (
                <motion.div
                  key="danger"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.35, ease: easeOut }}
                >
                  <div className="overflow-hidden rounded-2xl border border-red-500/15 bg-red-500/[0.03] backdrop-blur-sm">
                    <div className="flex items-center gap-3 border-b border-red-500/10 px-6 py-5 md:px-8">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/10">
                        <ShieldIcon />
                      </div>
                      <div>
                        <h2 className="font-display text-base uppercase tracking-[0.1em] text-red-200">
                          Zone sensible
                        </h2>
                        <p className="text-[11px] text-white/30">
                          Actions irréversibles — manipule avec précaution
                        </p>
                      </div>
                    </div>

                    <div className="px-6 py-8 md:px-8">
                      <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] p-5">
                        <div className="flex items-start gap-4">
                          <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-display text-sm uppercase tracking-[0.12em] text-red-200">
                              Supprimer le compte
                            </h3>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">
                              Cette action est <strong className="text-red-200">définitive</strong>. Ton compte,
                              tes données et l'accès à l'espace personnel seront effacés. Les réservations
                              passées resteront côté studio sans lien vers ton profil.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteErr(null);
                                setDeleteOpen(true);
                              }}
                              className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-6 py-2.5 text-[12px] font-medium uppercase tracking-[0.12em] text-red-200 transition-all duration-300 hover:border-red-400/50 hover:bg-red-500/20 hover:shadow-[0_0_24px_rgba(239,68,68,0.15)]"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                              Supprimer mon compte
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <Footer />

      <AnimatePresence>
        {deleteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
            onClick={() => !busy && setDeleteOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.3, ease: easeOut }}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/20 bg-[#0c0c10] shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-red-500/10 px-6 py-5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <h2
                    id="delete-account-title"
                    className="font-display text-lg uppercase tracking-[0.1em] text-red-200"
                  >
                    Supprimer le compte
                  </h2>
                  <p className="text-[11px] text-white/35">Action irréversible</p>
                </div>
              </div>

              <div className="px-6 pb-6 pt-5 md:px-8">
                <p className="text-sm leading-relaxed text-white/60">
                  Cette action est <strong className="text-red-200">définitive</strong> : ton
                  compte et l'accès à l'espace personnel seront supprimés. Les réservations
                  passées resteront côté studio sans lien vers ton compte.
                </p>
                <form onSubmit={(e) => void deleteAccount(e)} className="mt-5 space-y-4">
                  <FieldGroup label="Mot de passe actuel pour confirmer">
                    <ModernInput
                      required
                      type="password"
                      value={deletePassword}
                      onChange={setDeletePassword}
                      autoComplete="current-password"
                      icon={<LockIcon />}
                    />
                  </FieldGroup>
                  {deleteErr && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300"
                      role="alert"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {deleteErr}
                    </motion.div>
                  )}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDeleteOpen(false)}
                      className="rounded-xl px-5 py-2.5 text-sm text-white/50 transition hover:bg-white/[0.04] hover:text-white/80"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-600/20 px-6 py-2.5 text-[12px] font-medium uppercase tracking-[0.1em] text-red-100 transition-all duration-300 hover:border-red-400/60 hover:bg-red-600/30 hover:shadow-[0_0_24px_rgba(239,68,68,0.2)]"
                    >
                      {busy ? "Suppression…" : "Supprimer définitivement"}
                    </button>
                  </div>
                </form>
      </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}