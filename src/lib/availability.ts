/**
 * Pink Star Society — gestion des disponibilités (front MVP).
 *
 * Stockage : localStorage (clé `pss_availability_v1`).
 * À remplacer par des appels API quand le backend l'implémentera :
 *   GET    /api/availability/:year/:month                 (public, renvoie 404 si non publié)
 *   GET    /api/admin/availability/:year/:month           (admin, toujours présent)
 *   PUT    /api/admin/availability/:year/:month           (admin, sauvegarde slots)
 *   POST   /api/admin/availability/:year/:month/publish
 *   POST   /api/admin/availability/:year/:month/unpublish
 */

export type SlotKey = "morning" | "afternoon";
export type SlotStatus = "open" | "blocked";

export type DayAvailability = {
  day: number; // 1..31
  morning: SlotStatus;
  afternoon: SlotStatus;
};

export type MonthAvailability = {
  year: number;
  month: number; // 1..12
  published: boolean;
  days: DayAvailability[];
};

const STORAGE_KEY = "pss_availability_v1";

function loadAll(): MonthAvailability[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as MonthAvailability[]) : [];
  } catch {
    return [];
  }
}

function saveAll(list: MonthAvailability[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function key(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 0 = lundi … 6 = dimanche */
export function firstWeekdayMon(year: number, month: number): number {
  const d = new Date(year, month - 1, 1).getDay(); // 0=Sun..6=Sat
  return (d + 6) % 7;
}

/** Renvoie le mois (depuis le store) ou un défaut (week-end bloqué). */
export function getMonth(year: number, month: number): MonthAvailability {
  const all = loadAll();
  const k = key(year, month);
  const found = all.find((m) => key(m.year, m.month) === k);
  if (found) return JSON.parse(JSON.stringify(found));

  const total = daysInMonth(year, month);
  const days: DayAvailability[] = [];
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const isWeekend = dow === 0 || dow === 6;
    days.push({
      day: d,
      morning: isWeekend ? "blocked" : "open",
      afternoon: isWeekend ? "blocked" : "open",
    });
  }
  return { year, month, published: false, days };
}

export function saveMonth(m: MonthAvailability) {
  const all = loadAll();
  const k = key(m.year, m.month);
  const idx = all.findIndex((x) => key(x.year, x.month) === k);
  if (idx >= 0) all[idx] = m;
  else all.push(m);
  saveAll(all);
}

export function toggleSlot(
  year: number,
  month: number,
  day: number,
  slot: SlotKey,
): MonthAvailability {
  const m = getMonth(year, month);
  const d = m.days.find((x) => x.day === day);
  if (!d) return m;
  d[slot] = d[slot] === "open" ? "blocked" : "open";
  saveMonth(m);
  return m;
}

export function setDayBoth(
  year: number,
  month: number,
  day: number,
  status: SlotStatus,
): MonthAvailability {
  const m = getMonth(year, month);
  const d = m.days.find((x) => x.day === day);
  if (!d) return m;
  d.morning = status;
  d.afternoon = status;
  saveMonth(m);
  return m;
}

export function publish(year: number, month: number): MonthAvailability {
  const m = getMonth(year, month);
  m.published = true;
  saveMonth(m);
  return m;
}

export function unpublish(year: number, month: number): MonthAvailability {
  const m = getMonth(year, month);
  m.published = false;
  saveMonth(m);
  return m;
}

/** Forme minimale d'un booking pour le merge (compatible avec /admin/bookings). */
export type BookingLite = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  paymentStatus: string;
};

/** Un RDV "tient" le créneau dès qu'un acompte ou un paiement total a été reçu. */
export function isConfirmedBooking(b: { paymentStatus: string }): boolean {
  return b.paymentStatus === "deposit_paid" || b.paymentStatus === "paid";
}

/** Avant 13:00 → matin · ≥ 13:00 → après-midi. */
export function bookingSlot(time: string): SlotKey {
  const [hStr] = time.split(":");
  const h = parseInt(hStr, 10);
  return Number.isFinite(h) && h < 13 ? "morning" : "afternoon";
}

/**
 * Applique des RDV confirmés sur les slots du mois.
 * Si un RDV confirmé existe sur un créneau, le slot devient "blocked".
 * Persiste le résultat (les modifs admin restent, les slots avec RDV deviennent blocked).
 */
export function mergeBookings(
  year: number,
  month: number,
  bookings: BookingLite[],
): MonthAvailability {
  const m = getMonth(year, month);
  const target = `${year}-${String(month).padStart(2, "0")}`;
  let changed = false;
  for (const b of bookings) {
    if (!isConfirmedBooking(b)) continue;
    if (!b.date || !b.date.startsWith(target)) continue;
    const day = parseInt(b.date.split("-")[2], 10);
    if (!Number.isFinite(day)) continue;
    const slot = bookingSlot(b.time || "00:00");
    const d = m.days.find((x) => x.day === day);
    if (!d) continue;
    if (d[slot] !== "blocked") {
      d[slot] = "blocked";
      changed = true;
    }
  }
  if (changed) saveMonth(m);
  return m;
}

export const MONTH_LABELS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export const WEEKDAYS_FR_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
