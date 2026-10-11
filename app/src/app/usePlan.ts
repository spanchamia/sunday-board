import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Dish, DishIngredient, DishMealType, MealType, PlannedMeal, PrepStep, Task } from '../lib/types';
import { addDays, today } from '../logic/dates';

export interface PlanData {
  mealTypes: MealType[];
  dishes: Dish[];           // live (not archived) dishes, by name
  dishMealTypes: DishMealType[];
  ingredients: DishIngredient[];
  prepSteps: PrepStep[];
  planned: PlannedMeal[];   // from ~6 months ago (history feeds suggestions)
  tasks: Task[];            // open, plus anything done in the last 2 weeks
}

export interface PlanIndex {
  dishById: Map<string, Dish>;
  mealTypeById: Map<string, MealType>;
  mealTypesOfDish: Map<string, string[]>;
  ingredientsOfDish: Map<string, DishIngredient[]>;
  stepsOfDish: Map<string, PrepStep[]>;
  stepById: Map<string, PrepStep>;
}

const HISTORY_DAYS = 200;

async function load(familyId: string): Promise<PlanData> {
  const since = addDays(today(), -HISTORY_DAYS);
  const doneSince = new Date(Date.now() - 14 * 86400000).toISOString();
  const [mt, d, dmt, ing, steps, pm, tasks] = await Promise.all([
    supabase.from('meal_types').select('*').eq('family_id', familyId).order('sort').order('name'),
    supabase.from('dishes').select('*').eq('family_id', familyId).is('archived_at', null).order('name').limit(2000),
    supabase.from('dish_meal_types').select('*').eq('family_id', familyId).limit(5000),
    supabase.from('dish_ingredients').select('*').eq('family_id', familyId).limit(10000),
    supabase.from('dish_prep_steps').select('*').eq('family_id', familyId).order('sort'),
    supabase.from('planned_meals').select('*').eq('family_id', familyId).gte('date', since).order('date').limit(5000),
    supabase.from('tasks').select('*').eq('family_id', familyId).or(`done_at.is.null,done_at.gte."${doneSince}"`).order('due_on', { nullsFirst: false }).limit(2000),
  ]);
  const err = [mt, d, dmt, ing, steps, pm, tasks].find((r) => r.error)?.error;
  if (err) throw err;
  return {
    mealTypes: mt.data ?? [], dishes: d.data ?? [], dishMealTypes: dmt.data ?? [], ingredients: ing.data ?? [],
    prepSteps: steps.data ?? [], planned: pm.data ?? [], tasks: tasks.data ?? [],
  };
}

/** Meals, dishes and to-dos for the family, kept fresh as either phone changes them. */
export function usePlan(familyId: string) {
  const [data, setData] = useState<PlanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<number | undefined>(undefined);

  const reload = useCallback(async () => {
    try { setData(await load(familyId)); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, [familyId]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    const soon = () => { window.clearTimeout(pending.current); pending.current = window.setTimeout(() => void reload(), 250); };
    const channel = supabase.channel(`plan-${familyId}`);
    for (const table of ['meal_types', 'dishes', 'dish_meal_types', 'dish_ingredients', 'dish_prep_steps', 'planned_meals', 'tasks'] as const) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` }, soon);
    }
    channel.subscribe();
    const onShow = () => { if (document.visibilityState === 'visible') soon(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { void supabase.removeChannel(channel); document.removeEventListener('visibilitychange', onShow); };
  }, [familyId, reload]);

  const index = useMemo<PlanIndex | null>(() => {
    if (!data) return null;
    const group = <T, K extends keyof T>(rows: readonly T[], key: K) => {
      const m = new Map<string, T[]>();
      for (const r of rows) { const k = r[key] as unknown as string; m.set(k, [...(m.get(k) ?? []), r]); }
      return m;
    };
    return {
      dishById: new Map(data.dishes.map((d) => [d.id, d])),
      mealTypeById: new Map(data.mealTypes.map((m) => [m.id, m])),
      mealTypesOfDish: new Map([...group(data.dishMealTypes, 'dish_id')].map(([k, v]) => [k, v.map((x) => x.meal_type_id)])),
      ingredientsOfDish: group(data.ingredients, 'dish_id'),
      stepsOfDish: group(data.prepSteps, 'dish_id'),
      stepById: new Map(data.prepSteps.map((s) => [s.id, s])),
    };
  }, [data]);

  return { data, index, error, reload };
}
