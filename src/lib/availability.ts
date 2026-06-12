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
  endTime?: string;
  paymentStatus: string;
};

const AFTERNOON_START_MINUTES = 13 * 60;
const DEFAULT_DURATION_MINUTES = 60;

export function isConfirmedBooking(b: { paymentStatus: string }): boolean {
  return b.paymentStatus === "deposit_paid" || b.paymentStatus === "paid";
}

function parseHM(time: string): number | null {
  const parts = time.trim().split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function bookingRange(time: string, endTime?: string): { start: number; end: number } | null {
  const start = parseHM(time);
  if (start === null) return null;
  let end: number;
  if (endTime?.trim()) {
    const parsedEnd = parseHM(endTime);
    end = parsedEnd === null ? start + DEFAULT_DURATION_MINUTES : parsedEnd;
  } else {
    end = start + DEFAULT_DURATION_MINUTES;
  }
  if (end <= start) end = start + DEFAULT_DURATION_MINUTES;
  return { start, end };
}

function intervalsOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && s2 < e1;
}

function overlapsHalfDayWindow(
  time: string,
  endTime: string | undefined,
  slot: SlotKey,
): boolean {
  const range = bookingRange(time, endTime);
  if (!range) return false;
  if (slot === "morning") {
    return intervalsOverlap(range.start, range.end, 0, AFTERNOON_START_MINUTES);
  }
  return intervalsOverlap(range.start, range.end, AFTERNOON_START_MINUTES, 24 * 60);
}

export function bookingsOverlap(
  a: { date: string; time: string; endTime?: string },
  b: { date: string; time: string; endTime?: string },
): boolean {
  if (a.date !== b.date) return false;
  const r1 = bookingRange(a.time, a.endTime);
  const r2 = bookingRange(b.time, b.endTime);
  if (!r1 || !r2) return false;
  return intervalsOverlap(r1.start, r1.end, r2.start, r2.end);
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
    const d = out.days.find((x) => x.day === day);
    if (!d) continue;
    const time = b.time || "00:00";
    if (overlapsHalfDayWindow(time, b.endTime, "morning")) d.morning = "blocked";
    if (overlapsHalfDayWindow(time, b.endTime, "afternoon")) d.afternoon = "blocked";
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
