import { supabase } from '../lib/supabase';
import type { Task } from '../lib/types';

export async function addTask(familyId: string, t: { title: string; due_on: string | null; due_time?: string | null; private: boolean }): Promise<Task> {
  const { data, error } = await supabase.from('tasks').insert({
    family_id: familyId, title: t.title.trim(), due_on: t.due_on, due_time: t.due_time ?? null,
    visibility: t.private ? 'private' : 'family',
  }).select().single();
  if (error) throw error;
  return data;
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('tasks').update({ done_at: done ? new Date().toISOString() : null }).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}
