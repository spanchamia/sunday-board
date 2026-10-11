import { supabase } from '../lib/supabase';
import type { Dish, MealType, PlannedMeal, PrepStep } from '../lib/types';
import { prepDue } from '../logic/prep';
import { cleanName } from '../logic/text';

/**
 * Put a dish on a day for a meal type. Its prep steps become to-dos at the right
 * time before the meal, linked to this planned meal (so they move and disappear
 * with it). Returns the planned meal and how many prep reminders were added.
 */
export async function planMeal(familyId: string, date: string, mealType: MealType, dish: Dish, steps: readonly PrepStep[]): Promise<{ planned: PlannedMeal; reminders: number }> {
  const { data: planned, error } = await supabase
    .from('planned_meals')
    .insert({ family_id: familyId, date, meal_type_id: mealType.id, dish_id: dish.id })
    .select()
    .single();
  if (error) throw error;
  if (steps.length) {
    const rows = steps.map((s) => ({
      family_id: familyId, title: s.name, planned_meal_id: planned.id, prep_step_id: s.id,
      ...prepDue(date, mealType.usual_time, s.lead_minutes),
    }));
    const t = await supabase.from('tasks').insert(rows);
    if (t.error) throw t.error;
  }
  return { planned, reminders: steps.length };
}

/** Move a planned meal to another day or meal type; its prep reminders move with it. */
export async function movePlannedMeal(planned: PlannedMeal, date: string, mealType: MealType, stepsById: ReadonlyMap<string, PrepStep>): Promise<void> {
  const { error } = await supabase.from('planned_meals').update({ date, meal_type_id: mealType.id }).eq('id', planned.id);
  if (error) throw error;
  const { data: tasks, error: e2 } = await supabase.from('tasks').select('id, prep_step_id, done_at').eq('planned_meal_id', planned.id);
  if (e2) throw e2;
  for (const t of tasks ?? []) {
    const step = t.prep_step_id ? stepsById.get(t.prep_step_id) : undefined;
    if (!step || t.done_at) continue;
    const u = await supabase.from('tasks').update(prepDue(date, mealType.usual_time, step.lead_minutes)).eq('id', t.id);
    if (u.error) throw u.error;
  }
}

/** Take a dish off the plan. Its prep reminders go with it. */
export async function removePlannedMeal(id: string): Promise<void> {
  const { error } = await supabase.from('planned_meals').delete().eq('id', id);
  if (error) throw error;
}

export async function addMealType(familyId: string, name: string, sort: number, usualTime: string | null): Promise<MealType> {
  const { data, error } = await supabase.from('meal_types')
    .insert({ family_id: familyId, name: cleanName(name), sort, usual_time: usualTime }).select().single();
  if (error) throw error;
  return data;
}

export async function updateMealType(id: string, patch: { name?: string; usual_time?: string | null; sort?: number }): Promise<void> {
  const { error } = await supabase.from('meal_types')
    .update({ ...patch, ...(patch.name ? { name: cleanName(patch.name) } : {}) }).eq('id', id);
  if (error) throw error;
}

/** Deleting a meal type also removes its planned meals (dishes themselves stay). */
export async function deleteMealType(id: string): Promise<void> {
  const { error } = await supabase.from('meal_types').delete().eq('id', id);
  if (error) throw error;
}
