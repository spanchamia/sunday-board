import { useState, type FormEvent } from 'react';
import {
  addClass, addException, addKid, copyClassesToDays, deleteClass, deleteException, deleteKid,
  renameKid, startTerm, updateClass, updateException, updateTerm,
} from '../../commands/school';
import { explain } from '../../lib/supabase';
import type { Kid, SchoolClass, SchoolException, SchoolTerm } from '../../lib/types';
import { addDays, today } from '../../logic/dates';
import { suggestTermName, WEEKDAY_NAMES } from '../../logic/school';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

type Done = () => Promise<void> | void;

/** Run a save; show a friendly error in the sheet instead of closing. */
function useSave(onDone: Done, onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>, close = true) => {
    setBusy(true); setError(null);
    try { await fn(); await onDone(); if (close) onClose(); }
    catch (e) { setError(explain(e as Error)); }
    setBusy(false);
  };
  return { busy, error, setError, run };
}

/** Add a kid (kid = null) or rename / remove one. */
export function KidSheet({ familyId, kid, count, onClose, onDone }: { familyId: string; kid: Kid | null; count: number; onClose: () => void; onDone: (k?: Kid) => Promise<void> | void }) {
  const toast = useToast();
  const [name, setName] = useState(kid?.name ?? '');
  const { busy, error, setError, run } = useSave(() => undefined, onClose);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Type the kid’s name.'); return; }
    void run(async () => {
      if (kid) { await renameKid(kid.id, name); await onDone(); }
      else { const k = await addKid(familyId, name, count); await onDone(k); toast(`Added ${k.name}`); }
    });
  };
  const remove = () => {
    if (!kid || !window.confirm(`Remove ${kid.name} and their school timetable?`)) return;
    void run(async () => { await deleteKid(kid.id); await onDone(); toast(`Removed ${kid.name}`); });
  };
  return (
    <Sheet title={kid ? `Edit ${kid.name}` : 'Add a kid'} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        <label className="field"><span>Name</span>
          <input className="input" value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} placeholder="e.g. Ridhaan" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={busy}>{kid ? 'Save' : 'Add'}</button>
        {kid && <button type="button" className="btn danger wide" disabled={busy} onClick={remove}>Remove {kid.name}</button>}
      </form>
    </Sheet>
  );
}

/** Start a new semester (erases the current timetable) or change the current one's name and dates. */
export function TermSheet({ familyId, kid, term, fresh, onClose, onDone }: {
  familyId: string; kid: Kid; term: SchoolTerm | null; fresh: boolean; onClose: () => void; onDone: Done;
}) {
  const toast = useToast();
  const editing = term && !fresh;
  const [name, setName] = useState(editing ? term.name : suggestTermName(today()));
  const [starts, setStarts] = useState(editing ? term.starts_on ?? '' : '');
  const [ends, setEnds] = useState(editing ? term.ends_on ?? '' : '');
  const { busy, error, setError, run } = useSave(onDone, onClose);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Give it a name, like “Fall 2026”.'); return; }
    if (starts && ends && ends < starts) { setError('The end date is before the start date.'); return; }
    if (!editing && term && !window.confirm(`Erase ${kid.name}’s ${term.name} timetable and start ${name.trim()}?`)) return;
    void run(async () => {
      const t = { name, starts_on: starts || null, ends_on: ends || null };
      if (editing) await updateTerm(term.id, t); else await startTerm(familyId, kid.id, t);
      toast(editing ? 'Saved' : `${name.trim()} started. Now add the classes.`);
    });
  };
  return (
    <Sheet title={editing ? 'Semester dates' : term ? 'Start a new semester' : `${kid.name}’s timetable`} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        {!editing && term && <p className="notice small">This erases {kid.name}’s <strong>{term.name}</strong> classes and exceptions, then starts fresh.</p>}
        <label className="field"><span>Name</span>
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fall 2026" />
        </label>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow"><span>Starts <span className="soft">(optional)</span></span><input className="input" type="date" value={starts} onChange={(e) => setStarts(e.target.value)} /></label>
          <label className="field grow"><span>Ends <span className="soft">(optional)</span></span><input className="input" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} /></label>
        </div>
        <p className="soft small" style={{ margin: 0 }}>Outside these dates the week shows no classes (summer, winter break).</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={busy}>{editing ? 'Save' : term ? 'Erase and start fresh' : 'Start'}</button>
      </form>
    </Sheet>
  );
}

const plusMinutes = (t: string, m: number) => {
  const [h, mi] = t.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, (h ?? 0) * 60 + (mi ?? 0) + m);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** Add or change one class. "Save and add next" keeps the sheet open, starting where this one ends. */
export function ClassSheet({ familyId, termId, weekday, klass, startAt, onClose, onDone }: {
  familyId: string; termId: string; weekday: number; klass: SchoolClass | null; startAt?: string; onClose: () => void; onDone: Done;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(klass?.title ?? '');
  const [starts, setStarts] = useState(klass?.starts_at.slice(0, 5) ?? startAt ?? '08:00');
  const [ends, setEnds] = useState(klass?.ends_at.slice(0, 5) ?? plusMinutes(startAt ?? '08:00', 50));
  const [room, setRoom] = useState(klass?.room ?? '');
  const [teacher, setTeacher] = useState(klass?.teacher ?? '');
  const { busy, error, setError, run } = useSave(onDone, onClose);
  const valid = () => {
    if (!title.trim()) { setError('Type the class, like “Math”.'); return false; }
    if (!starts || !ends || ends <= starts) { setError('The end time must be after the start time.'); return false; }
    return true;
  };
  const fields = () => ({ weekday, starts_at: starts, ends_at: ends, title, room, teacher });
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!valid()) return;
    void run(() => (klass ? updateClass(klass.id, fields()) : addClass(familyId, termId, fields())));
  };
  const saveAndNext = () => {
    if (!valid()) return;
    void run(async () => {
      await addClass(familyId, termId, fields());
      toast(`Added ${title.trim()}`);
      const len = (Number(ends.slice(0, 2)) * 60 + Number(ends.slice(3))) - (Number(starts.slice(0, 2)) * 60 + Number(starts.slice(3)));
      setTitle(''); setRoom(''); setTeacher(''); setStarts(ends); setEnds(plusMinutes(ends, len));
    }, false);
  };
  const remove = () => void run(async () => { await deleteClass(klass!.id); toast(`Removed ${klass!.title}`); });
  return (
    <Sheet title={klass ? `Edit ${klass.title}` : `Add a class: ${WEEKDAY_NAMES[weekday - 1]}`} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        <label className="field"><span>Class</span>
          <input className="input" value={title} maxLength={60} autoFocus={!klass} onChange={(e) => { setTitle(e.target.value); setError(null); }} placeholder="e.g. Math, Recess, Lunch" />
        </label>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow"><span>Starts</span><input className="input" type="time" value={starts} onChange={(e) => setStarts(e.target.value)} /></label>
          <label className="field grow"><span>Ends</span><input className="input" type="time" value={ends} onChange={(e) => setEnds(e.target.value)} /></label>
        </div>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow"><span>Room <span className="soft">(optional)</span></span><input className="input" value={room} maxLength={40} onChange={(e) => setRoom(e.target.value)} /></label>
          <label className="field grow"><span>Teacher <span className="soft">(optional)</span></span><input className="input" value={teacher} maxLength={60} onChange={(e) => setTeacher(e.target.value)} /></label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={busy}>{klass ? 'Save' : 'Add class'}</button>
        {!klass && <button type="button" className="btn wide" disabled={busy} onClick={saveAndNext}>Add and enter the next one</button>}
        {klass && <button type="button" className="btn danger wide" disabled={busy} onClick={remove}>Remove class</button>}
      </form>
    </Sheet>
  );
}

/** Copy one day's classes to other days, then fix the differences. */
export function CopyDaySheet({ familyId, termId, classes, from, days, onClose, onDone }: {
  familyId: string; termId: string; classes: SchoolClass[]; from: number; days: number[]; onClose: () => void; onDone: Done;
}) {
  const toast = useToast();
  const [to, setTo] = useState<number[]>(days.filter((d) => d !== from && !classes.some((c) => c.weekday === d)));
  const { busy, error, run } = useSave(onDone, onClose);
  const n = classes.filter((c) => c.weekday === from).length;
  const overwritten = to.filter((d) => classes.some((c) => c.weekday === d));
  return (
    <Sheet title={`Copy ${WEEKDAY_NAMES[from - 1]}`} onClose={onClose}>
      <div className="stack">
        <p className="soft small" style={{ margin: 0 }}>Copies {WEEKDAY_NAMES[from - 1]}’s {n} {n === 1 ? 'class' : 'classes'} to the days you tick. Then change whatever is different on each day.</p>
        <div className="panel">
          {days.filter((d) => d !== from).map((d) => (
            <label key={d} className="check-row">
              <input type="checkbox" checked={to.includes(d)} onChange={() => setTo((t) => (t.includes(d) ? t.filter((x) => x !== d) : [...t, d]))} />
              <span className="grow">{WEEKDAY_NAMES[d - 1]}
                {classes.some((c) => c.weekday === d) && <span className="meta" style={{ display: 'block' }}>Has classes already: they’ll be replaced</span>}</span>
            </label>
          ))}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={busy || !to.length || !n} onClick={() => {
          if (overwritten.length && !window.confirm(`Replace the classes on ${overwritten.map((d) => WEEKDAY_NAMES[d - 1]).join(', ')}?`)) return;
          void run(async () => { await copyClassesToDays(familyId, termId, classes, from, to); toast(`Copied to ${to.length} ${to.length === 1 ? 'day' : 'days'}`); });
        }}>{to.length ? `Copy to ${to.length} ${to.length === 1 ? 'day' : 'days'}` : 'Tick the days to copy to'}</button>
      </div>
    </Sheet>
  );
}

/** A day or run of days that's different: field trip, no school, early dismissal. */
export function ExceptionSheet({ familyId, termId, kidName, exception, initialDate, onClose, onDone }: {
  familyId: string; termId: string; kidName: string; exception: SchoolException | null; initialDate: string; onClose: () => void; onDone: Done;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(exception?.title ?? '');
  const [from, setFrom] = useState(exception?.from_date ?? initialDate);
  const [to, setTo] = useState(exception?.to_date ?? initialDate);
  const [note, setNote] = useState(exception?.note ?? '');
  const [replaces, setReplaces] = useState(exception?.replaces_classes ?? true);
  const { busy, error, setError, run } = useSave(onDone, onClose);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Say what it is, like “Field trip” or “No school”.'); return; }
    if (!from || !to || to < from) { setError('The last day must be on or after the first day.'); return; }
    const x = { from_date: from, to_date: to, title, note, replaces_classes: replaces };
    void run(async () => { if (exception) await updateException(exception.id, x); else await addException(familyId, termId, x); toast(exception ? 'Saved' : `Added for ${kidName}`); });
  };
  const remove = () => void run(async () => { await deleteException(exception!.id); toast('Removed'); });
  return (
    <Sheet title={exception ? 'Edit exception' : `Something different for ${kidName}`} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        <label className="field"><span>What</span>
          <input className="input" value={title} maxLength={60} autoFocus={!exception} onChange={(e) => { setTitle(e.target.value); setError(null); }} placeholder="e.g. Field trip, No school, Minimum day" />
        </label>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow"><span>From</span><input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} /></label>
          <label className="field grow"><span>To</span><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="row" style={{ gap: 'var(--s2)' }}>
          {[['1 day', 0], ['Whole week', 4]].map(([label, n]) => (
            <button key={label} type="button" className="chip" onClick={() => setTo(addDays(from, n as number))}>{label}</button>
          ))}
        </div>
        <label className="check-row" style={{ padding: 0 }}>
          <input type="checkbox" checked={replaces} onChange={(e) => setReplaces(e.target.checked)} />
          <span className="grow">Instead of the usual classes
            <span className="meta" style={{ display: 'block' }}>Untick to keep the classes and just add a note (e.g. “Bring permission slip”).</span></span>
        </label>
        <label className="field"><span>Note <span className="soft">(optional)</span></span>
          <input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Pickup 3:30 at the museum" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={busy}>{exception ? 'Save' : 'Add'}</button>
        {exception && <button type="button" className="btn danger wide" disabled={busy} onClick={remove}>Remove</button>}
      </form>
    </Sheet>
  );
}
