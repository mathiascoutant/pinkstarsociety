/**
 * PinkStar Society — disponibilités (MongoDB via API).
 */

import { api } from "./api";

export type SlotKey = "h08" | "h10" | "h14" | "h17";
export type SlotStatus = "open" | "blocked";

export const SLOT_KEYS: SlotKey[] = ["h08", "h10", "h14", "h17"];

export const SLOT_LABELS: Record<SlotKey, string> = {
  h08: "8h",
  h10: "10h",
  h14: "14h",
  h17: "17h",
};

/** Fenêtres en minutes (fin exclusive) pour synchroniser les RDV. */
const SLOT_WINDOWS: Record<SlotKey, [number, number]> = {
  h08: [8 * 60, 10 * 60],
  h10: [10 * 60, 14 * 60],
  h14: [14 * 60, 17 * 60],
  h17: [17 * 60, 24 * 60],
};

export type DayAvailability = {
  day: number;
  h08: SlotStatus;
  h10: SlotStatus;
  h14: SlotStatus;
  h17: SlotStatus;
  /** legacy */
  morning?: SlotStatus;
  afternoon?: SlotStatus;
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

function isSlotStatus(v: unknown): v is SlotStatus {
  return v === "open" || v === "blocked";
}

export function normalizeDay(d: DayAvailability): DayAvailability {
  const morning = isSlotStatus(d.morning) ? d.morning : "blocked";
  const afternoon = isSlotStatus(d.afternoon) ? d.afternoon : "blocked";
  return {
    day: d.day,
    h08: isSlotStatus(d.h08) ? d.h08 : morning,
    h10: isSlotStatus(d.h10) ? d.h10 : morning,
    h14: isSlotStatus(d.h14) ? d.h14 : afternoon,
    h17: isSlotStatus(d.h17) ? d.h17 : afternoon,
  };
}

export function normalizeMonth(m: MonthAvailability): MonthAvailability {
  return {
    ...m,
    days: (m.days || []).map(normalizeDay),
  };
}

export function defaultMonth(year: number, month: number): MonthAvailability {
  const total = daysInMonth(year, month);
  const days: DayAvailability[] = [];
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const slot: SlotStatus = isWeekend ? "blocked" : "open";
    days.push({
      day: d,
      h08: slot,
      h10: slot,
      h14: slot,
      h17: slot,
    });
  }
  return { year, month, published: false, days };
}

export async function fetchAdminMonth(
  year: number,
  month: number,
): Promise<MonthAvailability> {
  const m = await api<MonthAvailability>(`/admin/availability/${year}/${month}`);
  return normalizeMonth(m);
}

export async function saveAdminMonth(
  m: MonthAvailability,
): Promise<MonthAvailability> {
  const normalized = normalizeMonth(m);
  const saved = await api<MonthAvailability>(
    `/admin/availability/${normalized.year}/${normalized.month}`,
    {
      method: "PUT",
      body: JSON.stringify({
        days: normalized.days.map((d) => ({
          day: d.day,
          h08: d.h08,
          h10: d.h10,
          h14: d.h14,
          h17: d.h17,
        })),
        published: normalized.published,
      }),
    },
  );
  return normalizeMonth(saved);
}

export async function publishMonth(
  year: number,
  month: number,
): Promise<MonthAvailability> {
  return normalizeMonth(
    await api<MonthAvailability>(`/admin/availability/${year}/${month}/publish`, {
      method: "POST",
    }),
  );
}

export async function unpublishMonth(
  year: number,
  month: number,
): Promise<MonthAvailability> {
  return normalizeMonth(
    await api<MonthAvailability>(
      `/admin/availability/${year}/${month}/unpublish`,
      { method: "POST" },
    ),
  );
}

export async function fetchPublicMonth(
  year: number,
  month: number,
): Promise<MonthAvailability> {
  return normalizeMonth(
    await api<MonthAvailability>(`/public/availability/${year}/${month}`),
  );
}

export function toggleSlotPure(
  m: MonthAvailability,
  day: number,
  slot: SlotKey,
): MonthAvailability {
  const out: MonthAvailability = JSON.parse(JSON.stringify(normalizeMonth(m)));
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
  const out: MonthAvailability = JSON.parse(JSON.stringify(normalizeMonth(m)));
  const d = out.days.find((x) => x.day === day);
  if (!d) return out;
  for (const key of SLOT_KEYS) d[key] = status;
  return out;
}

export function isDayFullyOpen(d: DayAvailability): boolean {
  const n = normalizeDay(d);
  return SLOT_KEYS.every((k) => n[k] === "open");
}

export type BookingLite = {
  date: string;
  time: string;
  endTime?: string;
  paymentStatus: string;
};

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

export function bookingDurationMinutes(time: string, endTime?: string): number {
  const range = bookingRange(time, endTime);
  return range ? range.end - range.start : DEFAULT_DURATION_MINUTES;
}

function intervalsOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && s2 < e1;
}

function overlapsSlotWindow(
  time: string,
  endTime: string | undefined,
  slot: SlotKey,
): boolean {
  const range = bookingRange(time, endTime);
  if (!range) return false;
  const [ws, we] = SLOT_WINDOWS[slot];
  return intervalsOverlap(range.start, range.end, ws, we);
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
  const out: MonthAvailability = JSON.parse(JSON.stringify(normalizeMonth(m)));
  const target = `${out.year}-${String(out.month).padStart(2, "0")}`;
  for (const b of bookings) {
    if (!isConfirmedBooking(b)) continue;
    if (!b.date?.startsWith(target)) continue;
    const day = parseInt(b.date.split("-")[2], 10);
    if (!Number.isFinite(day)) continue;
    const d = out.days.find((x) => x.day === day);
    if (!d) continue;
    const time = b.time || "00:00";
    for (const slot of SLOT_KEYS) {
      if (overlapsSlotWindow(time, b.endTime, slot)) d[slot] = "blocked";
    }
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
      const normalized = normalizeMonth(m);
      await api(`/admin/availability/${normalized.year}/${normalized.month}`, {
        method: "PUT",
        body: JSON.stringify({
          days: normalized.days.map((d) => ({
            day: d.day,
            h08: d.h08,
            h10: d.h10,
            h14: d.h14,
            h17: d.h17,
          })),
          published: Boolean(normalized.published),
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
