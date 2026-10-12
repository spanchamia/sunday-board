import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { today } from '../logic/dates';
import { readHidePrivate } from '../lib/device';

export interface Badges {
  toBuy: number;      // open rows on the shopping list
  todosDue: number;   // open to-dos due today or earlier (that I can see)
  todayMeals: string[]; // dish names planned for today, for the launcher
}

/** Small counts for the launcher tiles and the tab bar, kept fresh as things change. */
export function useBadges(familyId: string): Badges | null {
  const [b, setB] = useState<Badges | null>(null);
  const pending = useRef<number | undefined>(undefined);
  const load = useCallback(async () => {
    const t = today();
    const [list, todos, meals] = await Promise.all([
      supabase.from('list_entries').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('status', 'to_buy'),
      readHidePrivate()
        ? supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('family_id', familyId).is('done_at', null).lte('due_on', t).eq('visibility', 'family')
        : supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('family_id', familyId).is('done_at', null).lte('due_on', t),
      supabase.from('planned_meals').select('dish_id').eq('family_id', familyId).eq('date', t),
    ]);
    const dishIds = [...new Set((meals.data ?? []).flatMap((m) => (m.dish_id ? [m.dish_id] : [])))];
    const names = dishIds.length ? await supabase.from('dishes').select('name').in('id', dishIds) : { data: [] as { name: string }[] };
    setB({ toBuy: list.count ?? 0, todosDue: todos.count ?? 0, todayMeals: (names.data ?? []).map((d) => d.name) });
  }, [familyId]);
  useEffect(() => {
    void load();
    const soon = () => { window.clearTimeout(pending.current); pending.current = window.setTimeout(() => void load(), 400); };
    const ch = supabase.channel(`badges-${familyId}`);
    for (const table of ['list_entries', 'tasks', 'planned_meals'] as const) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` }, soon);
    }
    ch.subscribe();
    const onShow = () => { if (document.visibilityState === 'visible') soon(); };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('hashchange', soon);
    return () => {
      void supabase.removeChannel(ch);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('hashchange', soon);
    };
  }, [familyId, load]);
  return b;
}
