import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ListEntry, ListReason } from '../lib/types';
import { addDays, today } from '../logic/dates';
import type { ItemEventLite } from '../logic/restock';

/** How far ahead "this week's shop" looks at planned meals. */
export const SHOP_AHEAD_DAYS = 7;

export interface ListData {
  entries: ListEntry[];                 // open rows (to buy / in the bag)
  reasons: ListReason[];
  dishName: Map<string, string>;        // dish id -> name (for reasons)
  plannedDish: Map<string, string>;     // planned meal id -> dish id
  events: ItemEventLite[];              // purchases and "have it", last ~2 years
  week: { id: string; date: string; dish_id: string | null }[];  // meals planned for the coming week
  ingredientsOfDish: Map<string, string[]>;                        // dish id -> item ids (planned dishes only)
}

async function load(familyId: string): Promise<ListData> {
  const entries = await supabase.from('list_entries').select('*').eq('family_id', familyId).in('status', ['to_buy', 'in_bag']).order('added_at').limit(2000);
  if (entries.error) throw entries.error;
  const ids = (entries.data ?? []).map((e) => e.id);
  const reasons = ids.length
    ? await supabase.from('list_entry_reasons').select('*').eq('family_id', familyId).in('entry_id', ids).limit(5000)
    : { data: [] as ListReason[], error: null };
  if (reasons.error) throw reasons.error;
  const pmIds = [...new Set((reasons.data ?? []).flatMap((r) => (r.planned_meal_id ? [r.planned_meal_id] : [])))];
  const planned = pmIds.length
    ? await supabase.from('planned_meals').select('id, dish_id').in('id', pmIds)
    : { data: [] as { id: string; dish_id: string | null }[], error: null };
  if (planned.error) throw planned.error;
  const t = today();
  const [dishes, events, week] = await Promise.all([
    supabase.from('dishes').select('id, name').eq('family_id', familyId).limit(2000),
    supabase.from('item_events').select('item_id, kind, happened_on').eq('family_id', familyId).gte('happened_on', addDays(t, -730)).order('happened_on').limit(10000),
    supabase.from('planned_meals').select('id, date, dish_id').eq('family_id', familyId).gte('date', t).lte('date', addDays(t, SHOP_AHEAD_DAYS)).order('date').limit(500),
  ]);
  const err = [dishes, events, week].find((r) => r.error)?.error;
  if (err) throw err;
  const weekDishes = [...new Set((week.data ?? []).flatMap((w) => (w.dish_id ? [w.dish_id] : [])))];
  const ings = weekDishes.length
    ? await supabase.from('dish_ingredients').select('dish_id, item_id').eq('family_id', familyId).in('dish_id', weekDishes).limit(5000)
    : { data: [] as { dish_id: string; item_id: string }[], error: null };
  if (ings.error) throw ings.error;
  const ingredientsOfDish = new Map<string, string[]>();
  for (const i of ings.data ?? []) ingredientsOfDish.set(i.dish_id, [...(ingredientsOfDish.get(i.dish_id) ?? []), i.item_id]);
  return {
    entries: entries.data ?? [],
    reasons: reasons.data ?? [],
    dishName: new Map((dishes.data ?? []).map((d) => [d.id, d.name])),
    plannedDish: new Map((planned.data ?? []).flatMap((p) => (p.dish_id ? [[p.id, p.dish_id] as [string, string]] : []))),
    events: events.data ?? [], week: week.data ?? [], ingredientsOfDish,
  };
}

/** The family's open shopping list, kept in sync between phones. */
export function useList(familyId: string) {
  const [data, setData] = useState<ListData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<number | undefined>(undefined);
  const reload = useCallback(async () => {
    try { setData(await load(familyId)); setError(null); } catch (e) { setError((e as Error).message); }
  }, [familyId]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const soon = () => { window.clearTimeout(pending.current); pending.current = window.setTimeout(() => void reload(), 250); };
    const ch = supabase.channel(`list-${familyId}`);
    for (const table of ['list_entries', 'list_entry_reasons', 'planned_meals'] as const) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` }, soon);
    }
    ch.subscribe();
    const onShow = () => { if (document.visibilityState === 'visible') soon(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { void supabase.removeChannel(ch); document.removeEventListener('visibilitychange', onShow); };
  }, [familyId, reload]);
  return { data, error, reload };
}
