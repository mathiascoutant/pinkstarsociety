import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  SLOT_LABELS,
  fetchNextAvailability,
  type NextAvailableDay,
} from "../lib/availability";

type State =
  | { status: "loading" }
  | { status: "done"; next: NextAvailableDay | null }
  | { status: "error" };

/** Carte « Prochaine dispo » du Hero : premier jour avec un créneau libre. */
export default function NextAvailability() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchNextAvailability()
      .then((next) => {
        if (!cancelled) setState({ status: "done", next });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const next = state.status === "done" ? state.next : null;
  const date = next ? parseISODate(next.date) : null;

  return (
    <Link
      to={next ? `/disponibilites?date=${next.date}` : "/disponibilites"}
      className="glass-card group flex w-full max-w-md items-center gap-4 rounded-2xl p-3 pr-4 transition hover:border-pss-pink/40"
    >
      <span
        className={`grid h-16 w-14 shrink-0 place-items-center rounded-xl ring-1 ${
          date ? "bg-pss-pink/10 ring-pss-pink/30" : "bg-white/[0.03] ring-white/10"
        }`}
      >
        {date ? (
          <span className="text-center">
            <span className="block text-[9px] uppercase tracking-[0.2em] text-pss-pink">
              {date.toLocaleDateString("fr-FR", { month: "short" })}
            </span>
            <span className="mt-1 block font-display text-[1.7rem] leading-none text-white">
              {date.getDate()}
            </span>
          </span>
        ) : (
          <CalendarIcon
            className={
              state.status === "loading"
                ? "animate-pulse text-white/25"
                : "text-white/45"
            }
          />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/55">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              date
                ? "animate-pulse bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                : "bg-white/30"
            }`}
          />
          Prochaine dispo
        </span>

        {state.status === "loading" ? (
          <>
            <span className="mt-2 block h-5 w-28 animate-pulse rounded bg-white/10" />
            <span className="mt-2 block h-5 w-20 animate-pulse rounded bg-white/[0.06]" />
          </>
        ) : next && date ? (
          <>
            <span className="mt-2 block font-display text-xl uppercase leading-none tracking-tight text-white">
              {dayTitle(date)}
            </span>
            <span className="mt-2 flex flex-wrap gap-1">
              {next.slots.map((s) => (
                <span
                  key={s}
                  className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-emerald-300"
                >
                  {SLOT_LABELS[s]}
                </span>
              ))}
            </span>
          </>
        ) : (
          <>
            <span className="mt-2 block font-display text-xl uppercase leading-none tracking-tight text-white">
              {state.status === "error" ? "Agenda" : "Bientôt"}
            </span>
            <span className="mt-2 block text-[12px] text-white/50">
              {state.status === "error"
                ? "Voir les créneaux libres"
                : "Nouvelles dates à venir"}
            </span>
          </>
        )}
      </span>

      <span className="flex shrink-0 flex-col items-center gap-1.5">
        {(state.status === "loading" || next) && (
          <span className="text-center text-[9px] uppercase leading-tight tracking-[0.14em] text-white/50 transition group-hover:text-pss-pink">
            Voir autres
            <br />
            dispos
          </span>
        )}
        <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/60 transition group-hover:border-pss-pink/50 group-hover:text-pss-pink">
          <Arrow />
        </span>
      </span>
    </Link>
  );
}

function parseISODate(iso: string): Date | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** « Aujourd'hui », « Demain », sinon le jour de la semaine. */
function dayTitle(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  return date.toLocaleDateString("fr-FR", { weekday: "long" });
}

function CalendarIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3.5" y="5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="transition-transform group-hover:translate-x-0.5"
    >
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
