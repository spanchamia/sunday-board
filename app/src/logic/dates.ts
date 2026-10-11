// Calendar dates as 'YYYY-MM-DD' strings in the device's own time zone. Dates are
// built and compared as local calendar days, never as UTC instants, so "Monday"
// means the family's Monday.

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export const today = (now = new Date()) => toISODate(now);

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Whole days from a to b (b - a). Safe across daylight-saving changes. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 86400000);
}
const ymd = (s: string): [number, number, number] => {
  const [y, m, d] = s.split('-').map(Number);
  return [y ?? 1970, (m ?? 1) - 1, d ?? 1];
};

export const isWeekend = (iso: string) => [0, 6].includes(fromISODate(iso).getDay());

/** "Today", "Tomorrow", "Yesterday", else "Mon 12 Oct". */
export function dayLabel(iso: string, now = new Date()): string {
  const diff = daysBetween(today(now), iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return fromISODate(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Oct 12 – 18" or "Oct 29 – Nov 4". */
export function rangeLabel(fromIso: string, toIso: string): string {
  const a = fromISODate(fromIso), b = fromISODate(toIso);
  const m = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  return a.getMonth() === b.getMonth()
    ? `${m(a)} ${a.getDate()} – ${b.getDate()}`
    : `${m(a)} ${a.getDate()} – ${m(b)} ${b.getDate()}`;
}

/** "18:30:00" or "18:30" -> "6:30 PM" style, in the device's format. */
export function timeLabel(t: string | null | undefined): string {
  if (!t) return '';
  const [h, mi] = t.split(':').map(Number);
  const d = new Date(2000, 0, 1, h ?? 0, mi ?? 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
