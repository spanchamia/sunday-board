// School timetables: which classes a kid has on a given day, after term dates and
// exceptions (field trip, no school). Pure functions on 'YYYY-MM-DD' local dates.
import { addDays, fromISODate } from './dates';

export interface TermLite { starts_on: string | null; ends_on: string | null }
export interface ClassLite { id: string; weekday: number; starts_at: string; ends_at: string; title: string; room: string | null; teacher: string | null }
export interface ExceptionLite { id: string; from_date: string; to_date: string; title: string; note: string | null; replaces_classes: boolean }

/** 1 = Monday … 7 = Sunday. */
export const isoWeekday = (iso: string) => ((fromISODate(iso).getDay() + 6) % 7) + 1;

/** Monday on or before the given day (school weeks start Monday). */
export const schoolWeekStart = (iso: string) => addDays(iso, 1 - isoWeekday(iso));

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export interface DayPlan<C extends ClassLite = ClassLite, E extends ExceptionLite = ExceptionLite> {
  date: string;
  inTerm: boolean;
  off: E | null;          // an exception that replaces the day's classes
  notes: E[];             // exceptions shown on top of the normal classes
  classes: C[];           // what's on, in time order (empty when off / out of term)
}

export function dayPlan<C extends ClassLite, E extends ExceptionLite>(date: string, term: TermLite | null, classes: readonly C[], exceptions: readonly E[]): DayPlan<C, E> {
  const inTerm = !!term && (!term.starts_on || date >= term.starts_on) && (!term.ends_on || date <= term.ends_on);
  const here = exceptions.filter((x) => x.from_date <= date && date <= x.to_date);
  const off = here.find((x) => x.replaces_classes) ?? null;
  const wd = isoWeekday(date);
  const todays = inTerm && !off
    ? classes.filter((c) => c.weekday === wd).sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.title.localeCompare(b.title))
    : [];
  return { date, inTerm, off: inTerm ? off : null, notes: inTerm ? here.filter((x) => !x.replaces_classes) : [], classes: todays };
}

/** Monday–Friday, plus Saturday/Sunday only when they have classes. */
export function shownWeekdays(classes: readonly { weekday: number }[]): number[] {
  const days = [1, 2, 3, 4, 5];
  for (const d of [6, 7]) if (classes.some((c) => c.weekday === d)) days.push(d);
  return days;
}

/** Copy one day's classes onto other days (their own classes are replaced). */
export function copyDay<C extends ClassLite>(classes: readonly C[], from: number, to: readonly number[]):
  { remove: string[]; add: Omit<ClassLite, 'id'>[] } {
  const src = classes.filter((c) => c.weekday === from);
  const targets = to.filter((d) => d !== from);
  return {
    remove: classes.filter((c) => targets.includes(c.weekday)).map((c) => c.id),
    add: targets.flatMap((d) => src.map(({ starts_at, ends_at, title, room, teacher }) => ({ weekday: d, starts_at, ends_at, title, room, teacher }))),
  };
}

/** "Fall 2026" (Aug–Dec), "Spring 2027" (Jan–May), "Summer 2027" (Jun–Jul). */
export function suggestTermName(todayIso: string): string {
  const d = fromISODate(todayIso);
  const m = d.getMonth() + 1;
  return `${m >= 8 ? 'Fall' : m <= 5 ? 'Spring' : 'Summer'} ${d.getFullYear()}`;
}

/** Two classes on the same day that overlap in time (shown as a warning while editing). */
export function overlaps(classes: readonly ClassLite[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const a of classes) for (const b of classes) {
    if (a.id < b.id && a.weekday === b.weekday && a.starts_at < b.ends_at && b.starts_at < a.ends_at) out.push([a.id, b.id]);
  }
  return out;
}
