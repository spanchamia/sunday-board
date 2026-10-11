import { useState, type FormEvent } from 'react';
import type { FamilyData } from '../../app/useFamily';
import type { PlanData, PlanIndex } from '../../app/usePlan';
import { addTask } from '../../commands/tasks';
import { explain } from '../../lib/supabase';
import { addDays, today } from '../../logic/dates';
import { useToast } from '../../ui/Toast';
import { TaskRow } from './TaskRow';

/** Every to-do: prep reminders from planned meals and things you add yourself. */
export function TodosView({ family, data, index, reload }: { family: FamilyData; data: PlanData; index: PlanIndex; reload: () => Promise<void> }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(today());
  const [mine, setMine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t0 = today();

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Type what needs doing.'); return; }
    try {
      await addTask(family.family.id, { title, due_on: due || null, private: mine });
      await reload(); setTitle(''); setError(null); toast(mine ? 'Added, visible only to you' : 'Added');
    } catch (err) { setError(explain(err as Error)); }
  }

  const open = data.tasks.filter((t) => !t.done_at);
  const sortT = (a: typeof open[number], b: typeof open[number]) => (a.due_on ?? '').localeCompare(b.due_on ?? '') || (a.due_time ?? '').localeCompare(b.due_time ?? '');
  const groups: [string, typeof open][] = [
    ['Overdue', open.filter((t) => t.due_on && t.due_on < t0).sort(sortT)],
    ['Today', open.filter((t) => t.due_on === t0).sort(sortT)],
    ['Next 7 days', open.filter((t) => t.due_on && t.due_on > t0 && t.due_on <= addDays(t0, 7)).sort(sortT)],
    ['Later', open.filter((t) => t.due_on && t.due_on > addDays(t0, 7)).sort(sortT)],
    ['Any time', open.filter((t) => !t.due_on)],
  ];
  const done = data.tasks.filter((t) => t.done_at).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));

  return (
    <div className="stack">
      <h1>To-dos</h1>
      <form className="panel stack" style={{ padding: 'var(--s3)' }} onSubmit={add} noValidate>
        <label className="sr-only" htmlFor="todo-title">New to-do</label>
        <input id="todo-title" className="input" value={title} onChange={(e) => { setTitle(e.target.value); setError(null); }} placeholder="Add a to-do, e.g. Book piano lesson" maxLength={120} />
        <div className="row">
          <label className="field grow"><span className="sr-only">When</span>
            <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
          <label className="check-row" style={{ padding: 0 }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Just me</label>
          <button className="btn primary">Add</button>
        </div>
        <span className="hint">Clear the date for “any time”. “Just me” hides it from the rest of the family.</span>
        {error && <p className="error" role="alert">{error}</p>}
      </form>

      {groups.map(([label, rows]) => rows.length > 0 && (
        <section key={label} className="stack" aria-label={label}>
          <h2>{label}</h2>
          <div className="panel">{rows.map((t) => <TaskRow key={t.id} task={t} data={data} index={index} reload={reload} showDay={label !== 'Today'} />)}</div>
        </section>
      ))}
      {open.length === 0 && <p className="soft empty">Nothing to do. Prep reminders appear here when you plan dishes that need them.</p>}

      {done.length > 0 && (
        <details>
          <summary className="soft">Done in the last 2 weeks ({done.length})</summary>
          <div className="panel" style={{ marginTop: 8 }}>{done.map((t) => <TaskRow key={t.id} task={t} data={data} index={index} reload={reload} showDay />)}</div>
        </details>
      )}
    </div>
  );
}
