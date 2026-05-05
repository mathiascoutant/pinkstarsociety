import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const INSTA_URL = "https://instagram.com/pinkstar_society";
const MAIL_URL = "mailto:contact@pinkstarsociety.fr";

export default function CTA() {
  const { user, loading } = useAuth();
  const hasStoredToken =
    typeof window !== "undefined" && !!localStorage.getItem("pss_token");
  const showAuthLinks = !user && !(loading && hasStoredToken);

  return (
    <section
      id="contact"
      className="relative overflow-hidden border-t border-white/5 py-24 md:py-44"
    >
      <div className="pointer-events-none absolute inset-0 grid-noise opacity-25" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pss-pink/15 blur-[160px]" />

      <div className="relative mx-auto max-w-[1100px] px-5 text-center md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.32em] text-white/55"
        >
          <span className="font-mono text-pss-pink">/05</span>
          <span className="h-px w-10 bg-white/20" />
          <span>Réserver</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-6 font-display uppercase leading-[0.86] tracking-tight"
        >
          <span className="block text-[14vw] chrome-pink sm:text-6xl md:text-[7.5rem]">
            On commence
          </span>
          <span className="block text-[14vw] text-white sm:text-6xl md:text-[7.5rem]">
            par un message ?
          </span>
        </motion.h2>

        <p className="mx-auto mt-6 max-w-xl font-serif text-[16px] leading-relaxed text-white/70 md:text-[18px]">
          Réservation en DM Instagram ou par email. Acompte 30% ou paiement
          total une fois la date calée. Vos photos arriveront dans votre
          espace personnel après le rendez-vous.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mx-auto mt-10 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center"
        >
          <a
            href={INSTA_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-pink justify-center"
          >
            <InstaIcon />
            DM @pinkstar_society
          </a>
          <a href={MAIL_URL} className="btn-chrome justify-center">
            <MailIcon />
            Par email
          </a>
        </motion.div>

        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          <InfoCard k="Lieu" v="Bordeaux" sub="Adresse à la confirmation" />
          <InfoCard k="Format" v="Sur rendez-vous" sub="Réponse < 24h" />
          <InfoCard
            k="Galerie"
            v="Espace privé"
            sub="Photos après chaque séance"
          />
        </div>

        {showAuthLinks && (
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3 text-xs text-white/45">
            <Link
              to="/connexion"
              className="underline-offset-4 hover:text-white hover:underline"
            >
              Déjà client·e ? Accéder à mon espace
            </Link>
            <span className="hidden text-white/20 sm:inline">·</span>
            <Link
              to="/inscription"
              className="underline-offset-4 hover:text-white hover:underline"
            >
              Créer un compte
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function InfoCard({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left">
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">
        {k}
      </div>
      <div className="mt-1 font-display text-base text-white">{v}</div>
      <div className="mt-1 text-[11px] text-white/45">{sub}</div>
    </div>
  );
}

function InstaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m4 7 8 6 8-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
