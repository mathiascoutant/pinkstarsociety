import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  MONTH_LABELS_FR,
  SLOT_KEYS,
  SLOT_LABELS,
  WEEKDAYS_FR_SHORT,
  daysInMonth,
  firstWeekdayMon,
  type DayAvailability,
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

function dayTone(day: DayAvailability): "open" | "blocked" {
  const hasOpen = SLOT_KEYS.some((k) => day[k] === "open");
  return hasOpen ? "open" : "blocked";
}

function isPastDay(year: number, month: number, day: number, today: Date) {
  const isThisMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month;
  if (isThisMonth && day < today.getDate()) return true;
  if (year < today.getFullYear()) return true;
  if (year === today.getFullYear() && month < today.getMonth() + 1) return true;
  return false;
}

function formatSelectedDay(year: number, month: number, day: number) {
  return new Date(year, month - 1, day).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

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

  const today = useMemo(() => new Date(), []);
  const isThisMonth =
    today.getFullYear() === data.year && today.getMonth() + 1 === data.month;
  const todayNum = today.getDate();

  const defaultSelected = isThisMonth ? todayNum : 1;
  const [selectedDay, setSelectedDay] = useState(defaultSelected);

  useEffect(() => {
    const nextDefault =
      today.getFullYear() === data.year && today.getMonth() + 1 === data.month
        ? today.getDate()
        : 1;
    setSelectedDay(nextDefault);
  }, [data.year, data.month, today]);

  const selected = data.days.find((x) => x.day === selectedDay);
  const selectedPast = isPastDay(data.year, data.month, selectedDay, today);

  return (
    <div>
      {/* ===== Mobile: pick a day, then large slots ===== */}
      <div className="md:hidden">
        <div className="mb-3 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS_FR_SHORT.map((d) => (
            <div
              key={d}
              className="text-[9px] uppercase tracking-[0.2em] text-white/35"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={`e-${i}`} className="aspect-square" />;
            const day = data.days.find((x) => x.day === d);
            if (!day) return <div key={`m-${i}`} className="aspect-square" />;
            const isToday = isThisMonth && d === todayNum;
            const isPast = isPastDay(data.year, data.month, d, today);
            const isSelected = d === selectedDay;
            const tone = dayTone(day);

            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(d)}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl transition ${
                  isSelected
                    ? "bg-pss-pink text-white shadow-[0_8px_24px_-8px_rgba(244,63,155,0.7)]"
                    : isToday
                      ? "bg-white/[0.06] text-pss-pink ring-1 ring-pss-pink/40"
                      : "bg-white/[0.03] text-white/85 ring-1 ring-white/[0.06]"
                } ${isPast && !isSelected ? "opacity-40" : ""}`}
                aria-label={`Jour ${d}`}
                aria-pressed={isSelected}
              >
                <span className="font-body text-[15px] font-semibold leading-none">
                  {d}
                </span>
                {!isSelected && (
                  <span
                    className={`mt-1.5 h-1 w-1 rounded-full ${
                      tone === "open" ? "bg-emerald-400" : "bg-red-400/80"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {selected && (
          <motion.div
            key={selectedDay}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-6"
          >
            <div className="mb-3.5 flex items-end justify-between gap-3 border-b border-white/[0.06] pb-3">
              <p className="font-body text-[14px] font-medium capitalize tracking-wide text-white/70">
                {formatSelectedDay(data.year, data.month, selectedDay)}
              </p>
              {mode === "admin" && (
                <button
                  type="button"
                  onClick={() => onToggleDay?.(selectedDay)}
                  disabled={selectedPast}
                  className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-pss-pink/90 transition hover:text-pss-pink disabled:opacity-40"
                >
                  Tout basculer
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {SLOT_KEYS.map((slot) => (
                <MobileSlot
                  key={slot}
                  label={SLOT_LABELS[slot]}
                  status={selected[slot]}
                  disabled={mode !== "admin" || selectedPast}
                  onClick={() => mode === "admin" && onToggle?.(selectedDay, slot)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ===== Desktop: full month grid with slots ===== */}
      <div className="hidden md:block">
        <div className="mb-3 grid grid-cols-7 gap-2 text-center">
          {WEEKDAYS_FR_SHORT.map((d) => (
            <div
              key={d}
              className="text-[11px] uppercase tracking-[0.22em] text-white/40"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-3">
          {cells.map((d, i) => {
            if (d === null) return <div key={`e-${i}`} />;
            const day = data.days.find((x) => x.day === d);
            if (!day) return <div key={`m-${i}`} />;
            const isToday = isThisMonth && d === todayNum;
            const isPast = isPastDay(data.year, data.month, d, today);

            return (
              <motion.div
                key={d}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.005, duration: 0.25 }}
                className={`relative overflow-hidden rounded-2xl border bg-white/[0.025] p-3 transition ${
                  isToday
                    ? "border-pss-pink/70 shadow-[0_0_0_2px_rgba(244,63,155,0.35)]"
                    : "border-white/10"
                } ${isPast ? "opacity-50" : ""}`}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className={`font-display text-lg leading-none tracking-tight ${
                      isToday ? "text-pss-pink" : "text-white/85"
                    }`}
                  >
                    {d}
                  </span>
                  {mode === "admin" && (
                    <button
                      type="button"
                      onClick={() => onToggleDay?.(d)}
                      disabled={isPast}
                      className="grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-white/5 text-[10px] text-white/55 transition hover:border-pss-pink/60 hover:text-pss-pink disabled:opacity-40"
                      aria-label="Basculer la journée entière"
                      title="Tout basculer"
                    >
                      ⇅
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1">
                  {SLOT_KEYS.map((slot) => (
                    <DesktopSlot
                      key={slot}
                      label={SLOT_LABELS[slot]}
                      status={day[slot]}
                      disabled={mode !== "admin" || isPast}
                      onClick={() => mode === "admin" && onToggle?.(d, slot)}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.18em] text-white/40 md:justify-start">
        <LegendDot color="bg-emerald-400" label="Libre" />
        <LegendDot color="bg-red-400" label="Pris" />
      </div>
    </div>
  );
}

function MobileSlot({
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl transition ${
        isOpen
          ? "bg-emerald-400/[0.1] ring-1 ring-emerald-400/30"
          : "bg-white/[0.03] ring-1 ring-white/[0.08] opacity-70"
      } ${
        disabled
          ? "cursor-default"
          : "active:scale-[0.97]"
      }`}
    >
      <span
        className={`font-body text-[17px] font-semibold leading-none tracking-tight ${
          isOpen ? "text-white" : "text-white/45"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-[9px] uppercase tracking-[0.16em] ${
          isOpen ? "text-emerald-300/90" : "text-white/30"
        }`}
      >
        {isOpen ? "Libre" : "Pris"}
      </span>
    </button>
  );
}

function DesktopSlot({
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-9 w-full items-center justify-center rounded-md border text-[10px] uppercase tracking-[0.12em] transition ${
        isOpen
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
          : "border-red-500/35 bg-red-500/12 text-red-300"
      } ${
        disabled
          ? "cursor-default"
          : "cursor-pointer hover:brightness-115"
      }`}
    >
      {label}
    </button>
  );
}

function LegendDot({
  color,
  label,
  className = "",
}: {
  color: string;
  label: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
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
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.04] text-white/70 ring-1 ring-white/10 transition hover:text-pss-pink hover:ring-pss-pink/40"
      >
        <Chevron dir="left" />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <div className="truncate font-display text-2xl uppercase leading-none tracking-tight text-white sm:text-3xl">
          {MONTH_LABELS_FR[month - 1]}
        </div>
        <div className="mt-1.5 text-[11px] uppercase tracking-[0.28em] text-white/40">
          {year}
          {right ? (
            <span className="ml-3 inline-flex align-middle sm:hidden">{right}</span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onNext}
        aria-label="Mois suivant"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.04] text-white/70 ring-1 ring-white/10 transition hover:text-pss-pink hover:ring-pss-pink/40"
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
