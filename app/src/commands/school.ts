import { supabase } from '../lib/supabase';
import type { Kid, SchoolClass, SchoolTerm } from '../lib/types';
import { copyDay } from '../logic/school';

const must = <T>(r: { data: T | null; error: unknown }): T => { if (r.error) throw r.error; return r.data as T; };
const clean = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);

export async function addKid(familyId: string, name: string, sort: number): Promise<Kid> {
  return must(await supabase.from('kids').insert({ family_id: familyId, name: name.trim(), sort }).select().single());
}
export async function renameKid(id: string, name: string): Promise<void> {
  must(await supabase.from('kids').update({ name: name.trim() }).eq('id', id));
}
/** Removes the kid and their timetable. */
export async function deleteKid(id: string): Promise<void> {
  must(await supabase.from('kids').delete().eq('id', id));
}

export interface TermFields { name: string; starts_on: string | null; ends_on: string | null }

/** New semester: erases the kid's current timetable (classes and exceptions) and starts a fresh one. */
export async function startTerm(familyId: string, kidId: string, t: TermFields): Promise<SchoolTerm> {
  must(await supabase.from('school_terms').delete().eq('kid_id', kidId));
  return must(await supabase.from('school_terms').insert({
    family_id: familyId, kid_id: kidId, name: t.name.trim(), starts_on: t.starts_on || null, ends_on: t.ends_on || null,
  }).select().single());
}
export async function updateTerm(id: string, t: TermFields): Promise<void> {
  must(await supabase.from('school_terms').update({ name: t.name.trim(), starts_on: t.starts_on || null, ends_on: t.ends_on || null }).eq('id', id));
}
export interface ClassFields { weekday: number; starts_at: string; ends_at: string; title: string; room?: string | null; teacher?: string | null }

/** "08:00" → "08:00:00" (the database stores seconds). */
const hms = (t: string) => (t.length === 5 ? `${t}:00` : t);
const classRow = (c: ClassFields) => ({
  weekday: c.weekday, starts_at: hms(c.starts_at), ends_at: hms(c.ends_at), title: c.title.trim(), room: clean(c.room), teacher: clean(c.teacher),
});

export async function addClass(familyId: string, termId: string, c: ClassFields): Promise<void> {
  must(await supabase.from('school_classes').insert({ family_id: familyId, term_id: termId, ...classRow(c) }));
}
export async function updateClass(id: string, c: ClassFields): Promise<void> {
  must(await supabase.from('school_classes').update(classRow(c)).eq('id', id));
}
export async function deleteClass(id: string): Promise<void> {
  must(await supabase.from('school_classes').delete().eq('id', id));
}

/** Copy one day's classes onto other days; whatever those days had is replaced. */
export async function copyClassesToDays(familyId: string, termId: string, classes: readonly SchoolClass[], from: number, to: readonly number[]): Promise<void> {
  const { remove, add } = copyDay(classes.filter((c) => c.term_id === termId), from, to);
  if (remove.length) must(await supabase.from('school_classes').delete().in('id', remove));
  if (add.length) must(await supabase.from('school_classes').insert(add.map((c) => ({ family_id: familyId, term_id: termId, ...c }))));
}

export interface ExceptionFields { from_date: string; to_date: string; title: string; note?: string | null; replaces_classes: boolean }
const exceptionRow = (x: ExceptionFields) => ({
  from_date: x.from_date, to_date: x.to_date, title: x.title.trim(), note: clean(x.note), replaces_classes: x.replaces_classes,
});

export async function addException(familyId: string, termId: string, x: ExceptionFields): Promise<void> {
  must(await supabase.from('school_exceptions').insert({ family_id: familyId, term_id: termId, ...exceptionRow(x) }));
}
export async function updateException(id: string, x: ExceptionFields): Promise<void> {
  must(await supabase.from('school_exceptions').update(exceptionRow(x)).eq('id', id));
}
export async function deleteException(id: string): Promise<void> {
  must(await supabase.from('school_exceptions').delete().eq('id', id));
}
