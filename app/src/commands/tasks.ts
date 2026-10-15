import { supabase } from '../lib/supabase';
import type { Task } from '../lib/types';
import { nextDate, type Repeat } from '../logic/repeat';

export interface TaskFields {
  title: string;
  due_on: string | null;
  due_time?: string | null;
  private: boolean;
  repeat?: Repeat | null;         // needs a date
  remindBefore?: number[];        // minutes before; 0 = at the time
}

function columns(t: TaskFields) {
  const repeat = t.due_on ? t.repeat ?? null : null;
  return {
    title: t.title.trim(), due_on: t.due_on, due_time: t.due_on ? t.due_time ?? null : null,
    visibility: t.private ? 'private' : 'family',
    repeat_unit: repeat?.unit ?? null, repeat_every: repeat?.every ?? null,
    remind_before: t.due_on ? [...new Set(t.remindBefore ?? [])].sort((a, b) => a - b) : [],
  };
}

export async function addTask(familyId: string, t: TaskFields): Promise<Task> {
  const cols = columns(t);
  const { data, error } = await supabase.from('tasks').insert({
    family_id: familyId, ...cols, series_id: cols.repeat_unit ? crypto.randomUUID() : null,
  }).select().single();
  if (error) throw error;
  return data;
}

/** Change a to-do. Turning repeat on starts a series; turning it off ends it. */
export async function updateTask(task: Task, t: TaskFields): Promise<void> {
  const cols = columns(t);
  const series_id = cols.repeat_unit ? task.series_id ?? crypto.randomUUID() : null;
  const { error } = await supabase.from('tasks').update({ ...cols, series_id }).eq('id', task.id);
  if (error) throw error;
}

/**
 * Tick or untick. Ticking a repeating to-do adds the next one (once); unticking it
 * again takes that next one away, as long as it hasn't been done yet.
 */
export async function setTaskDone(task: Task, done: boolean): Promise<void> {
  const { error } = await supabase.from('tasks').update({ done_at: done ? new Date().toISOString() : null }).eq('id', task.id);
  if (error) throw error;
  if (!task.series_id || !task.repeat_unit || !task.repeat_every || !task.due_on) return;
  const later = await supabase.from('tasks').select('id, done_at').eq('series_id', task.series_id).gt('due_on', task.due_on);
  if (later.error) throw later.error;
  if (done) {
    if ((later.data ?? []).length) return;   // the next one already exists
    const first = await supabase.from('tasks').select('due_on').eq('series_id', task.series_id).order('due_on').limit(1);
    if (first.error) throw first.error;
    const anchor = first.data?.[0]?.due_on ?? task.due_on;
    const due_on = nextDate(task.due_on, { unit: task.repeat_unit as Repeat['unit'], every: task.repeat_every }, anchor);
    const ins = await supabase.from('tasks').insert({
      family_id: task.family_id, title: task.title, due_on, due_time: task.due_time, visibility: task.visibility,
      repeat_unit: task.repeat_unit, repeat_every: task.repeat_every, series_id: task.series_id, remind_before: task.remind_before,
    });
    if (ins.error) throw ins.error;
  } else {
    const undone = (later.data ?? []).filter((r) => !r.done_at).map((r) => r.id);
    if (undone.length) {
      const del = await supabase.from('tasks').delete().in('id', undone);
      if (del.error) throw del.error;
    }
  }
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}
