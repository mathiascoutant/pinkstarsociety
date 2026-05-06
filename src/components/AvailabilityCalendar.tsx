import { motion } from "framer-motion";
import {
  MONTH_LABELS_FR,
  WEEKDAYS_FR_SHORT,
  daysInMonth,
  firstWeekdayMon,
  type MonthAvailability,
  type SlotKey,
  type SlotStatus,
} from "../lib/availability";

type Props = {
  data: MonthAvailability;
  mode: "public" | "admin";
  onToggle?: (day: number, slot: SlotKey) => void;
  onToggleDay?: (day: number) => void;
};

export default function AvailabilityCalendar({
  data,
  mode,
  onToggle,
  onToggleDay,
}: Props) {
  const total = daysInMonth(data.year, data.month);
  const offset = firstWeekdayMon(data.year, data.month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isThisMonth =
    today.getFullYear() === data.year && today.getMonth() + 1 === data.month;
  const todayNum = today.getDate();

  return (
    <div>
      {/* Weekday header */}
      <div className="mb-2 grid grid-cols-7 gap-1 text-center sm:mb-3 sm:gap-2">
        {WEEKDAYS_FR_SHORT.map((d) => (
          <div
            key={d}
            className="text-[9px] uppercase tracking-[0.18em] text-white/40 sm:text-[11px] sm:tracking-[0.22em]"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-3">
        {cells.map((d, i) => {
          if (d === null) return <div key={`e-${i}`} />;
          const day = data.days.find((x) => x.day === d);
          if (!day) return <div key={`m-${i}`} />;
          const isToday = isThisMonth && d === todayNum;
          const isPast =
            isThisMonth && d < todayNum
              ? true
              : data.year < today.getFullYear() ||
                (data.year === today.getFullYear() &&
                  data.month < today.getMonth() + 1);

          return (
            <motion.div
              key={d}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.005, duration: 0.25 }}
              className={`relative overflow-hidden rounded-xl border bg-white/[0.025] p-1.5 transition sm:rounded-2xl sm:p-3 ${
                isToday
                  ? "border-pss-pink/70 shadow-[0_0_0_2px_rgba(244,63,155,0.35)]"
                  : "border-white/10"
              } ${isPast ? "opacity-50" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between sm:mb-1.5">
                <span
                  className={`font-display text-sm leading-none tracking-tight sm:text-lg ${
                    isToday ? "text-pss-pink" : "text-white/85"
                  }`}
                >
                  {d}
                </span>
                {mode === "admin" && (
                  <button
                    type="button"
                    onClick={() => onToggleDay?.(d)}
                    className="grid h-4 w-4 place-items-center rounded-full border border-white/15 bg-white/5 text-[8px] text-white/55 transition hover:border-pss-pink/60 hover:text-pss-pink sm:h-5 sm:w-5 sm:text-[9px]"
                    aria-label="Basculer la journée entière"
                    title="Tout basculer"
                  >
                    ⇅
                  </button>
                )}
              </div>

              <SlotBar
                label="Mat"
                status={day.morning}
                disabled={mode !== "admin" || isPast}
                onClick={() => mode === "admin" && onToggle?.(d, "morning")}
              />
              <SlotBar
                label="Aprem"
                status={day.afternoon}
                disabled={mode !== "admin" || isPast}
                onClick={() => mode === "admin" && onToggle?.(d, "afternoon")}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/60">
        <LegendDot color="bg-emerald-400" label="Disponible" />
        <LegendDot color="bg-red-500" label="Indisponible" />
        {mode === "admin" && (
          <span className="text-[11px] text-white/40">
            • Cliquez un créneau pour basculer · ⇅ pour la journée
          </span>
        )}
      </div>
    </div>
  );
}

function SlotBar({
  label,
  status,
  disabled,
  onClick,
}: {
  label: string;
  status: SlotStatus;
  disabled: boolean;
  onClick: () => void;
}) {
  const isOpen = status === "open";
  const base =
    "mt-1 flex w-full items-center justify-center rounded-md border py-[5px] text-[10px] font-bold uppercase leading-none tracking-[0.1em] transition sm:mt-1.5 sm:justify-between sm:px-2 sm:py-1.5 sm:text-[10px] sm:font-normal sm:tracking-[0.18em]";
  const tone = isOpen
    ? "border-emerald-400/50 bg-emerald-400/25 text-emerald-200 sm:border-emerald-400/30 sm:bg-emerald-400/10 sm:text-emerald-300"
    : "border-red-500/55 bg-red-500/25 text-red-200 sm:border-red-500/35 sm:bg-red-500/12 sm:text-red-300";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${tone} ${
        disabled
          ? "cursor-default"
          : "cursor-pointer hover:brightness-115 hover:shadow-[0_0_0_2px_rgba(244,63,155,0.25)]"
      }`}
    >
      <span className="hidden opacity-70 sm:inline">{label}</span>
      <span className="hidden font-mono sm:inline">{isOpen ? "✓" : "✕"}</span>
      <span className="sm:hidden">{label === "Mat" ? "MAT" : "APR"}</span>
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span>{label}</span>
    </span>
  );
}

export function MonthHeader({
  year,
  month,
  onPrev,
  onNext,
  right,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 sm:gap-4">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Mois précédent"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-white/80 transition hover:border-pss-pink/60 hover:text-pss-pink sm:h-10 sm:w-10"
      >
        <Chevron dir="left" />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-white/45 sm:text-[10px] sm:tracking-[0.32em]">
          {String(month).padStart(2, "0")} / {year}
        </div>
        <div className="truncate font-display text-xl uppercase leading-none tracking-tight text-white sm:text-3xl">
          {MONTH_LABELS_FR[month - 1]}{" "}
          <span className="text-pss-pink">{year}</span>
        </div>
        {right ? <div className="mt-2 flex justify-center sm:hidden">{right}</div> : null}
      </div>
      <button
        type="button"
        onClick={onNext}
        aria-label="Mois suivant"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-white/80 transition hover:border-pss-pink/60 hover:text-pss-pink sm:h-10 sm:w-10"
      >
        <Chevron dir="right" />
      </button>
      {right ? <div className="hidden sm:block">{right}</div> : null}
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      {dir === "left" ? (
        <path
          d="M15 6l-6 6 6 6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M9 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
