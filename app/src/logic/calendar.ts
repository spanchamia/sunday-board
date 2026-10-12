// Calendar grids as lists of 'YYYY-MM-DD' local dates. Weeks start on Sunday.
import { addDays, fromISODate, toISODate } from './dates';

/** Sunday on or before the given day. */
export function weekStart(iso: string): string {
  return addDays(iso, -fromISODate(iso).getDay());
}

/** The 7 days (Sun–Sat) of the week containing `iso`. */
export function weekDays(iso: string): string[] {
  const s = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

export const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

/** Same day-of-month n months away, clamped (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(iso: string, n: number): string {
  const d = fromISODate(iso);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return toISODate(t);
}

/** Whole weeks covering the month of `iso` (4 to 6 rows of 7 days). */
export function monthGrid(iso: string): string[][] {
  const first = firstOfMonth(iso);
  const nextFirst = firstOfMonth(addMonths(first, 1));
  const weeks: string[][] = [];
  for (let s = weekStart(first); s < nextFirst; s = addDays(s, 7)) weeks.push(weekDays(s));
  return weeks;
}

export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

export function monthLabel(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** "Sun", "Mon"… in the device's language, starting Sunday. */
export function weekdayNames(style: 'short' | 'narrow' = 'short'): string[] {
  return weekDays('2026-10-11').map((d) => fromISODate(d).toLocaleDateString(undefined, { weekday: style }));
}
