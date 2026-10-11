import { toISODate } from './dates';

/** When a meal is served: its date at the meal type's usual time (noon if unset). */
export function mealStart(date: string, usualTime: string | null | undefined): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = (usualTime ?? '12:00').split(':').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, h ?? 12, mi ?? 0);
}

/**
 * When a prep step is due: `leadMinutes` before the meal. Returned as the local
 * date and time the task stores, e.g. soak 2 days before Sunday 08:00 breakfast
 * -> { due_on: Friday, due_time: '08:00:00' }.
 */
export function prepDue(date: string, usualTime: string | null | undefined, leadMinutes: number): { due_on: string; due_time: string } {
  const t = new Date(mealStart(date, usualTime).getTime() - leadMinutes * 60000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { due_on: toISODate(t), due_time: `${pad(t.getHours())}:${pad(t.getMinutes())}:00` };
}

/** "2 days before", "12 hours before", "At the meal". */
export function leadLabel(minutes: number): string {
  if (minutes <= 0) return 'At the meal';
  if (minutes % 1440 === 0) { const d = minutes / 1440; return `${d} ${d === 1 ? 'day' : 'days'} before`; }
  if (minutes % 60 === 0) { const h = minutes / 60; return `${h} ${h === 1 ? 'hour' : 'hours'} before`; }
  return `${minutes} minutes before`;
}
