import { supabase } from '../lib/supabase';
import type { Dish, PrepStep } from '../lib/types';
import { cleanName } from '../logic/text';

export interface DishDraft {
  id?: string;
  name: string;
  notes: string;
  make_every_days: number | null;
  weekdays_ok: boolean;
  weekends_ok: boolean;
  mealTypeIds: string[];
  ingredients: { itemId: string; amount: string | null }[];
  prepSteps: { id?: string; name: string; lead_minutes: number }[];
}

/** Create or update a dish with its meal types, ingredients and prep steps. */
export async function saveDish(familyId: string, d: DishDraft, existingSteps: readonly PrepStep[] = []): Promise<Dish> {
  const fields = {
    family_id: familyId, name: cleanName(d.name), notes: d.notes.trim(),
    make_every_days: d.make_every_days, weekdays_ok: d.weekdays_ok, weekends_ok: d.weekends_ok,
  };
  const res = d.id
    ? await supabase.from('dishes').update(fields).eq('id', d.id).select().single()
    : await supabase.from('dishes').insert(fields).select().single();
  if (res.error) throw res.error;
  const dish = res.data;

  // Meal types: replace the set.
  const delMt = await supabase.from('dish_meal_types').delete().eq('dish_id', dish.id);
  if (delMt.error) throw delMt.error;
  if (d.mealTypeIds.length) {
    const r = await supabase.from('dish_meal_types').insert(d.mealTypeIds.map((m) => ({ dish_id: dish.id, meal_type_id: m, family_id: familyId })));
    if (r.error) throw r.error;
  }

  // Ingredients: replace the set.
  const delIng = await supabase.from('dish_ingredients').delete().eq('dish_id', dish.id);
  if (delIng.error) throw delIng.error;
  const uniq = [...new Map(d.ingredients.map((i) => [i.itemId, i])).values()];
  if (uniq.length) {
    const r = await supabase.from('dish_ingredients').insert(uniq.map((i) => ({ dish_id: dish.id, item_id: i.itemId, family_id: familyId, amount: i.amount?.trim() || null })));
    if (r.error) throw r.error;
  }

  // Prep steps: keep ids of steps that stay (reminders already planned stay linked).
  const keep = new Set(d.prepSteps.flatMap((s) => (s.id ? [s.id] : [])));
  const gone = existingSteps.filter((s) => !keep.has(s.id)).map((s) => s.id);
  if (gone.length) {
    const r = await supabase.from('dish_prep_steps').delete().in('id', gone);
    if (r.error) throw r.error;
  }
  for (const [i, s] of d.prepSteps.entries()) {
    const row = { name: cleanName(s.name), lead_minutes: s.lead_minutes, sort: i };
    const r = s.id
      ? await supabase.from('dish_prep_steps').update(row).eq('id', s.id)
      : await supabase.from('dish_prep_steps').insert({ ...row, dish_id: dish.id, family_id: familyId });
    if (r.error) throw r.error;
  }
  return dish;
}

/** Hide a dish from lists and suggestions; past plans keep their history. */
export async function archiveDish(id: string): Promise<void> {
  const { error } = await supabase.from('dishes').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
