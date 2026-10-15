// Repeating to-dos and reminder choices. Pure functions on 'YYYY-MM-DD' dates.
import { addMonths } from './calendar';
import { addDays } from './dates';

export type RepeatUnit = 'day' | 'week' | 'month' | 'year';
export interface Repeat { unit: RepeatUnit; every: number }

/** The date after `iso` in this repeat (months keep the day, clamped: Jan 31 → Feb 28). */
export function nextDate(iso: string, r: Repeat, from = iso): string {
  // Months/years step from the series' first day so a 31st doesn't drift to the 28th.
  let n = 1;
  for (;;) {
    const d = step(from, r, n);
    if (d > iso) return d;
    n++;
  }
}
function step(start: string, r: Repeat, n: number): string {
  switch (r.unit) {
    case 'day': return addDays(start, r.every * n);
    case 'week': return addDays(start, 7 * r.every * n);
    case 'month': return addMonths(start, r.every * n);
    case 'year': return addMonths(start, 12 * r.every * n);
  }
}

/** Upcoming repeats after `iso`, up to and including `until` (for showing on the calendar). */
export function repeatsBetween(iso: string, r: Repeat, until: string, limit = 400): string[] {
  const out: string[] = [];
  for (let n = 1; out.length < limit; n++) {
    const d = step(iso, r, n);
    if (d > until) break;
    out.push(d);
  }
  return out;
}

export function repeatLabel(r: Repeat | null): string {
  if (!r) return 'Doesn’t repeat';
  const names = { day: ['day', 'days'], week: ['week', 'weeks'], month: ['month', 'months'], year: ['year', 'years'] } as const;
  return r.every === 1 ? `Every ${names[r.unit][0]}` : `Every ${r.every} ${names[r.unit][1]}`;
}

/** The reminder choices, in minutes before. */
export const REMINDER_CHOICES = [0, 10, 60, 1440, 2880, 10080] as const;
export function reminderLabel(min: number): string {
  switch (min) {
    case 0: return 'At the time';
    case 10: return '10 min before';
    case 60: return '1 hour before';
    case 1440: return '1 day before';
    case 2880: return '2 days before';
    case 10080: return '1 week before';
    default: return `${min} min before`;
  }
}
/** Reminders count from this time when a to-do has no time of its own. */
export const DEFAULT_REMIND_TIME = '09:00';
