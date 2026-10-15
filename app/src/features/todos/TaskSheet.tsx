import { useState, type FormEvent } from 'react';
import type { FamilyData } from '../../app/useFamily';
import { addTask, deleteTask, updateTask } from '../../commands/tasks';
import { explain } from '../../lib/supabase';
import type { Task } from '../../lib/types';
import { DEFAULT_REMIND_TIME, REMINDER_CHOICES, reminderLabel, repeatLabel, type Repeat, type RepeatUnit } from '../../logic/repeat';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

const PRESETS: { key: string; label: string; repeat: Repeat | null }[] = [
  { key: 'none', label: 'Doesn’t repeat', repeat: null },
  { key: 'day', label: 'Every day', repeat: { unit: 'day', every: 1 } },
  { key: 'week', label: 'Every week', repeat: { unit: 'week', every: 1 } },
  { key: '2week', label: 'Every 2 weeks', repeat: { unit: 'week', every: 2 } },
  { key: 'month', label: 'Every month', repeat: { unit: 'month', every: 1 } },
  { key: 'year', label: 'Every year', repeat: { unit: 'year', every: 1 } },
];
const presetKey = (r: Repeat | null) =>
  PRESETS.find((p) => (p.repeat === null ? r === null : r !== null && p.repeat.unit === r.unit && p.repeat.every === r.every))?.key ?? 'custom';

/** Add a to-do (task = null) or change one: when, who sees it, repeat, reminders. */
export function TaskSheet({ family, task, initialDate = null, initialTitle = '', onClose, reload }: {
  family: FamilyData; task: Task | null; initialDate?: string | null; initialTitle?: string;
  onClose: () => void; reload: () => Promise<void>;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(task?.title ?? initialTitle);
  const [date, setDate] = useState(task ? task.due_on ?? '' : initialDate ?? '');
  const [time, setTime] = useState(task?.due_time?.slice(0, 5) ?? '');
  const [mine, setMine] = useState(task?.visibility === 'private');
  const startRepeat: Repeat | null = task?.repeat_unit && task.repeat_every ? { unit: task.repeat_unit as RepeatUnit, every: task.repeat_every } : null;
  const [preset, setPreset] = useState(presetKey(startRepeat));
  const [custom, setCustom] = useState<Repeat>(startRepeat && presetKey(startRepeat) === 'custom' ? startRepeat : { unit: 'day', every: 3 });
  const [remind, setRemind] = useState<number[]>(task?.remind_before ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repeat = preset === 'custom' ? custom : PRESETS.find((p) => p.key === preset)?.repeat ?? null;
  const toggle = (m: number) => setRemind((r) => (r.includes(m) ? r.filter((x) => x !== m) : [...r, m]));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Type what needs doing.'); return; }
    if (repeat && !date) { setError('Pick a date to repeat from.'); return; }
    if (repeat && (!Number.isInteger(repeat.every) || repeat.every < 1 || repeat.every > 366)) { setError('Repeat every 1 to 366.'); return; }
    setBusy(true); setError(null);
    const fields = { title, due_on: date || null, due_time: time ? `${time}:00` : null, private: mine, repeat, remindBefore: remind };
    try {
      if (task) await updateTask(task, fields); else await addTask(family.family.id, fields);
      await reload();
      toast(task ? 'Saved' : mine ? 'Added, visible only to you' : 'Added');
      onClose();
    } catch (err) { setError(explain(err as Error)); setBusy(false); }
  }

  async function remove() {
    if (!task || !window.confirm(`Delete “${task.title}”?${task.series_id ? ' Earlier and later repeats stay.' : ''}`)) return;
    try { await deleteTask(task.id); await reload(); toast('To-do deleted'); onClose(); }
    catch (err) { setError(explain(err as Error)); }
  }

  return (
    <Sheet title={task ? 'Edit to-do' : 'New to-do'} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        <label className="field"><span>What</span>
          <input className="input" value={title} maxLength={120} autoFocus={!task}
            onChange={(e) => { setTitle(e.target.value); setError(null); }} placeholder="e.g. Book piano lesson" />
        </label>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow"><span>Date</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field grow"><span>Time <span className="soft">(optional)</span></span>
            <input className="input" type="time" value={time} disabled={!date} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
        {!date && <p className="soft small" style={{ marginTop: 4 }}>No date means “any time”. Add a date to repeat it or get reminders.</p>}

        <label className="field"><span>Repeat</span>
          <select className="input" value={preset} disabled={!date} onChange={(e) => setPreset(e.target.value)}>
            {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            <option value="custom">Custom…</option>
          </select>
        </label>
        {preset === 'custom' && date && (
          <div className="row">
            <span>Every</span>
            <input className="input" style={{ width: 80 }} inputMode="numeric" aria-label="How many" value={String(custom.every || '')}
              onChange={(e) => setCustom({ ...custom, every: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
            <select className="input grow" aria-label="Days, weeks, months or years" value={custom.unit}
              onChange={(e) => setCustom({ ...custom, unit: e.target.value as RepeatUnit })}>
              <option value="day">days</option><option value="week">weeks</option><option value="month">months</option><option value="year">years</option>
            </select>
          </div>
        )}
        {repeat && date && <p className="soft small" style={{ marginTop: 4 }}>{repeatLabel(repeat)}. When you tick it off, the next one appears.</p>}

        <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }} disabled={!date}>
          <legend style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--s1)', padding: 0 }}>Remind me</legend>
          <div className="chips">
            {REMINDER_CHOICES.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={remind.includes(m)} onClick={() => toggle(m)}>
                {reminderLabel(m)}
              </button>
            ))}
          </div>
          <span className="hint">
            {!date ? 'Add a date to get reminders.' : !time ? `No time set, so reminders count from ${DEFAULT_REMIND_TIME.replace(/^0/, '')} AM that day. ` : ''}
            {date ? 'Reminders arrive as notifications on phones that turn them on (Family → This device).' : ''}
          </span>
        </fieldset>

        <label className="check-row" style={{ padding: 0 }}>
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          <span className="grow">Just me<span className="meta" style={{ display: 'block' }}>Hidden from the rest of the family.</span></span>
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={busy}>{busy ? 'Saving…' : task ? 'Save' : 'Add to-do'}</button>
        {task && <button type="button" className="btn danger wide" onClick={() => void remove()}>Delete to-do</button>}
      </form>
    </Sheet>
  );
}
