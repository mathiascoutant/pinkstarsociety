import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links: Array<
  | { label: string; href: string; to?: never }
  | { label: string; to: string; href?: never }
> = [
  { label: "À propos", to: "/a-propos" },
  { label: "Process", href: "#process" },
  { label: "Avis", href: "#echos" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const hasStoredToken =
    typeof window !== "undefined" && !!localStorage.getItem("pss_token");
  const guest = !user && !(loading && hasStoredToken);
  const { scrollY } = useScroll();
  const blur = useTransform(scrollY, [0, 200], [4, 18]);
  const bg = useTransform(scrollY, [0, 200], [
    "rgba(10,10,12,0)",
    "rgba(10,10,12,0.55)",
  ]);
  const [open, setOpen] = useState(false);

  return (
    <motion.header
      style={{
        backdropFilter: blur.get() ? `blur(${blur.get()}px)` : undefined,
        backgroundColor: bg as unknown as string,
      }}
      className="fixed inset-x-0 top-0 z-50 border-b border-white/5"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 md:px-10">
        <Link to="/" className="flex items-center gap-3">
          <span className="relative grid h-10 w-10 place-items-center">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-pss-pink/40 to-transparent blur-xl" />
            <Star />
          </span>
          <span className="font-display text-lg uppercase tracking-[0.22em] text-white">
            PinkStar<span className="text-pss-pink">.</span>Society
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            l.to ? (
              <Link
                key={l.to}
                to={l.to}
                className="group relative rounded-full px-4 py-2 text-[13px] uppercase tracking-[0.18em] text-white/70 transition hover:text-white"
              >
                {l.label}
                <span className="absolute inset-x-4 bottom-1 h-px origin-left scale-x-0 bg-pss-pink transition-transform duration-300 group-hover:scale-x-100" />
              </Link>
            ) : (
              <a
                key={l.href}
                href={l.href}
                className="group relative rounded-full px-4 py-2 text-[13px] uppercase tracking-[0.18em] text-white/70 transition hover:text-white"
              >
                {l.label}
                <span className="absolute inset-x-4 bottom-1 h-px origin-left scale-x-0 bg-pss-pink transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            )
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <UserMenu
              firstName={user.firstName}
              isAdmin={user.role === "admin"}
              onLogout={logout}
            />
          ) : guest ? (
            <>
              <Link
                to="/connexion"
                className="text-[12px] uppercase tracking-[0.18em] text-white/65 hover:text-pss-pink"
              >
                Connexion
              </Link>
              <a
                href="/inscription"
                className="btn-pink"
              >
                Inscription
                <Arrow />
              </a>
            </>
          ) : (
            <span
              className="text-[12px] uppercase tracking-[0.18em] text-white/35"
              aria-hidden
            >
              …
            </span>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 md:hidden"
          aria-label="Menu"
        >
          <span className="text-white">{open ? "✕" : "≡"}</span>
        </button>
      </div>

      {/* Mobile drawer */}
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        className="overflow-hidden border-t border-white/5 bg-pss-ink/95 backdrop-blur md:hidden"
      >
        <div className="flex flex-col gap-1 px-5 py-4">
          {links.map((l) => (
            l.to ? (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm uppercase tracking-[0.18em] text-white/80 hover:bg-white/5"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm uppercase tracking-[0.18em] text-white/80 hover:bg-white/5"
              >
                {l.label}
              </a>
            )
          ))}
          <div className="mt-2 flex flex-col gap-1 border-t border-white/5 pt-3">
            {user ? (
              <>
                <div className="px-4 pb-1 pt-1 text-[10px] uppercase tracking-[0.22em] text-white/40">
                  {user.firstName}
                </div>
                <Link
                  to="/compte"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm uppercase tracking-[0.18em] text-white/80 hover:bg-white/5"
                >
                  Compte
                </Link>
                <Link
                  to="/compte/fidelite"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm uppercase tracking-[0.18em] text-white/80 hover:bg-white/5"
                >
                  Fidélité
                </Link>
                {user.role === "admin" && (
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm uppercase tracking-[0.18em] text-white/80 hover:bg-white/5"
                  >
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                  className="rounded-xl px-4 py-3 text-left text-sm uppercase tracking-[0.18em] text-white/55 hover:bg-white/5"
                >
                  Déconnexion
                </button>
              </>
            ) : guest ? (
              <>
                <Link
                  to="/connexion"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm uppercase tracking-[0.18em] text-white/80 hover:bg-white/5"
                >
                  Connexion
                </Link>
                <a
                  href="/inscription"
                  onClick={() => setOpen(false)}
                  className="btn-pink self-start"
                >
                  Inscription
                  <Arrow />
                </a>
              </>
            ) : (
              <span className="px-4 py-3 text-sm text-white/35">…</span>
            )}
          </div>
        </div>
      </motion.div>
    </motion.header>
  );
}

function UserMenu({
  firstName,
  isAdmin,
  onLogout,
}: {
  firstName: string;
  isAdmin: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative z-[60]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`group flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] uppercase tracking-[0.18em] transition ${
          open
            ? "border-pss-pink/60 bg-pss-pink/10 text-white"
            : "border-white/15 bg-white/[0.04] text-white/85 hover:border-pss-pink/40 hover:text-white"
        }`}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-pss-pink/20 text-[10px] text-pss-pink">
          ★
        </span>
        <span>{firstName}</span>
        <Chevron open={open} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            role="menu"
            className="absolute right-0 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-pss-ink/95 p-1.5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          >
            <div className="px-3 pb-2 pt-1.5 text-[10px] uppercase tracking-[0.22em] text-white/40">
              Connecté en tant que
            </div>
            <div className="px-3 pb-3 font-display text-base text-white">
              {firstName}
            </div>
            <div className="my-1 h-px bg-white/8" />

            <MenuItem to="/compte" onClick={() => setOpen(false)} icon="user">
              Compte
            </MenuItem>
            <MenuItem
              to="/compte/fidelite"
              onClick={() => setOpen(false)}
              icon="star"
            >
              Fidélité
            </MenuItem>
            {isAdmin && (
              <MenuItem
                to="/admin"
                onClick={() => setOpen(false)}
                icon="shield"
                accent
              >
                Admin
              </MenuItem>
            )}

            <div className="my-1 h-px bg-white/8" />

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] text-white/65 transition hover:bg-white/5 hover:text-white"
              role="menuitem"
            >
              <Icon name="logout" />
              Déconnexion
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  to,
  onClick,
  icon,
  accent,
  children,
}: {
  to: string;
  onClick: () => void;
  icon: "user" | "star" | "shield";
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      role="menuitem"
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition ${
        accent
          ? "text-pss-pink hover:bg-pss-pink/10"
          : "text-white/85 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon name={icon} />
      {children}
    </Link>
  );
}

function Icon({
  name,
}: {
  name: "user" | "star" | "shield" | "logout";
}) {
  const sw = 1.6;
  switch (name) {
    case "user":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="8.5"
            r="3.4"
            stroke="currentColor"
            strokeWidth={sw}
          />
          <path
            d="M5 19.5c1.5-3.4 4.2-5 7-5s5.5 1.6 7 5"
            stroke="currentColor"
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </svg>
      );
    case "star":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3.5l2.6 5.5 6 .8-4.4 4.1 1.1 6L12 17l-5.3 2.9 1.1-6L3.4 9.8l6-.8L12 3.5Z"
            stroke="currentColor"
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      );
    case "shield":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3.5l7.5 2.5v6c0 4.5-3.4 7.6-7.5 8.5-4.1-.9-7.5-4-7.5-8.5V6L12 3.5Z"
            stroke="currentColor"
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      );
    case "logout":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M14 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8"
            stroke="currentColor"
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <path
            d="M16 8l4 4-4 4M20 12H10"
            stroke="currentColor"
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Star() {
  return (
    <svg viewBox="0 0 100 100" className="relative z-10 h-7 w-7">
      <defs>
        <linearGradient id="navg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffd4ee" />
          <stop offset="0.5" stopColor="#ff007a" />
          <stop offset="1" stopColor="#5a0028" />
        </linearGradient>
      </defs>
      <polygon
        fill="url(#navg)"
        stroke="#0c0010"
        strokeWidth="4"
        strokeLinejoin="round"
        points="50,5 61,38 96,38 67,58 78,92 50,72 22,92 33,58 4,38 39,38"
      />
    </svg>
  );
}

function Arrow() {
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
