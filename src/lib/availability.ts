/**
 * Pink Star Society — disponibilités (MongoDB via API).
 */

import { api } from "./api";

export type SlotKey = "morning" | "afternoon";
export type SlotStatus = "open" | "blocked";

export type DayAvailability = {
  day: number;
  morning: SlotStatus;
  afternoon: SlotStatus;
};

export type MonthAvailability = {
  year: number;
  month: number;
  published: boolean;
  days: DayAvailability[];
};

const LEGACY_STORAGE_KEY = "pss_availability_v1";

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 0 = lundi … 6 = dimanche */
export function firstWeekdayMon(year: number, month: number): number {
  const d = new Date(year, month - 1, 1).getDay();
  return (d + 6) % 7;
}

export function defaultMonth(year: number, month: number): MonthAvailability {
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

export async function fetchAdminMonth(
  year: number,
  month: number,
): Promise<MonthAvailability> {
  return api<MonthAvailability>(`/admin/availability/${year}/${month}`);
}

export async function saveAdminMonth(
  m: MonthAvailability,
): Promise<MonthAvailability> {
  return api<MonthAvailability>(
    `/admin/availability/${m.year}/${m.month}`,
    {
      method: "PUT",
      body: JSON.stringify({
        days: m.days,
        published: m.published,
      }),
    },
  );
}

export async function publishMonth(
  year: number,
  month: number,
): Promise<MonthAvailability> {
  return api<MonthAvailability>(
    `/admin/availability/${year}/${month}/publish`,
    { method: "POST" },
  );
}

export async function unpublishMonth(
  year: number,
  month: number,
): Promise<MonthAvailability> {
  return api<MonthAvailability>(
    `/admin/availability/${year}/${month}/unpublish`,
    { method: "POST" },
  );
}

export async function fetchPublicMonth(
  year: number,
  month: number,
): Promise<MonthAvailability> {
  return api<MonthAvailability>(`/public/availability/${year}/${month}`);
}

export function toggleSlotPure(
  m: MonthAvailability,
  day: number,
  slot: SlotKey,
): MonthAvailability {
  const out: MonthAvailability = JSON.parse(JSON.stringify(m));
  const d = out.days.find((x) => x.day === day);
  if (!d) return out;
  d[slot] = d[slot] === "open" ? "blocked" : "open";
  return out;
}

export function setDayBothPure(
  m: MonthAvailability,
  day: number,
  status: SlotStatus,
): MonthAvailability {
  const out: MonthAvailability = JSON.parse(JSON.stringify(m));
  const d = out.days.find((x) => x.day === day);
  if (!d) return out;
  d.morning = status;
  d.afternoon = status;
  return out;
}

export type BookingLite = {
  date: string;
  time: string;
  paymentStatus: string;
};

export function isConfirmedBooking(b: { paymentStatus: string }): boolean {
  return b.paymentStatus === "deposit_paid" || b.paymentStatus === "paid";
}

export function bookingSlot(time: string): SlotKey {
  const [hStr] = time.split(":");
  const h = parseInt(hStr, 10);
  return Number.isFinite(h) && h < 13 ? "morning" : "afternoon";
}

export function mergeBookings(
  m: MonthAvailability,
  bookings: BookingLite[],
): MonthAvailability {
  const out: MonthAvailability = JSON.parse(JSON.stringify(m));
  const target = `${out.year}-${String(out.month).padStart(2, "0")}`;
  for (const b of bookings) {
    if (!isConfirmedBooking(b)) continue;
    if (!b.date?.startsWith(target)) continue;
    const day = parseInt(b.date.split("-")[2], 10);
    if (!Number.isFinite(day)) continue;
    const slot = bookingSlot(b.time || "00:00");
    const d = out.days.find((x) => x.day === day);
    if (d) d[slot] = "blocked";
  }
  return out;
}

/** Importe une fois les données localStorage vers MongoDB (migration MVP). */
export async function migrateLegacyAvailabilityIfNeeded(): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    for (const m of arr as MonthAvailability[]) {
      if (!m?.year || !m?.month || !Array.isArray(m.days)) continue;
      await api(`/admin/availability/${m.year}/${m.month}`, {
        method: "PUT",
        body: JSON.stringify({
          days: m.days,
          published: Boolean(m.published),
        }),
      });
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // migration best-effort
  }
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

export const WEEKDAYS_FR_SHORT = [
  "Lun",
  "Mar",
  "Mer",
  "Jeu",
  "Ven",
  "Sam",
  "Dim",
];
