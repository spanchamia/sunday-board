import { useState } from 'react';
import { deleteTask, setTaskDone } from '../../commands/tasks';
import type { PlanData, PlanIndex } from '../../app/usePlan';
import { explain } from '../../lib/supabase';
import type { Task } from '../../lib/types';
import { dayLabel, fromISODate, timeLabel } from '../../logic/dates';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';

/** What a prep reminder is for: "For Chole, Tue dinner". */
export function taskContext(t: Task, data: PlanData, index: PlanIndex): string | null {
  if (!t.planned_meal_id) return null;
  const pm = data.planned.find((p) => p.id === t.planned_meal_id);
  if (!pm) return null;
  const dish = pm.dish_id ? index.dishById.get(pm.dish_id)?.name : null;
  const mt = index.mealTypeById.get(pm.meal_type_id)?.name.toLowerCase();
  const day = fromISODate(pm.date).toLocaleDateString(undefined, { weekday: 'short' });
  return `For ${dish ?? 'a planned meal'}, ${day} ${mt ?? ''}`.trim();
}

export function TaskRow({ task, data, index, reload, showDay = false }: {
  task: Task; data: PlanData; index: PlanIndex; reload: () => Promise<void>; showDay?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const done = !!task.done_at;
  const ctx = taskContext(task, data, index);
  const when = [showDay && task.due_on ? dayLabel(task.due_on) : '', timeLabel(task.due_time)].filter(Boolean).join(', ');

  async function toggle() {
    setBusy(true);
    try { await setTaskDone(task.id, !done); await reload(); }
    catch (e) { toast(explain(e as Error)); }
    setBusy(false);
  }
  async function remove() {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    try { await deleteTask(task.id); await reload(); toast('To-do deleted'); }
    catch (e) { toast(explain(e as Error)); }
  }

  return (
    <div className="check-row task-row">
      <input type="checkbox" checked={done} disabled={busy} onChange={() => void toggle()} aria-label={`${task.title}${done ? ', done' : ''}`} />
      <span className="grow" style={{ textDecoration: done ? 'line-through' : undefined, opacity: done ? 0.6 : 1 }}>
        {task.title}
        {(ctx || when || task.visibility === 'private') && (
          <span className="meta" style={{ display: 'block' }}>
            {[when, ctx, task.visibility === 'private' ? 'Just you' : ''].filter(Boolean).join('. ')}
          </span>
        )}
      </span>
      {!task.planned_meal_id && (
        <button className="icon-btn" onClick={() => void remove()} aria-label={`Delete ${task.title}`}><Icon name="trash" /></button>
      )}
    </div>
  );
}
