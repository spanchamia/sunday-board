import { supabase } from '../lib/supabase';
import type { Category, RestockMode } from '../lib/types';
import { canMoveUnder, planPath } from '../logic/tree';
import { cleanName } from '../logic/text';

export async function addCategory(familyId: string, parentId: string, name: string, restockMode: RestockMode | null = null): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ family_id: familyId, parent_id: parentId, name: cleanName(name), default_restock_mode: restockMode })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, patch: { name?: string; default_restock_mode?: RestockMode | null }): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ ...patch, ...(patch.name ? { name: cleanName(patch.name) } : {}) })
    .eq('id', id);
  if (error) throw error;
}

export async function moveCategory(all: readonly Category[], id: string, newParentId: string): Promise<void> {
  if (!canMoveUnder(all, id, newParentId)) throw new Error('A category can’t go inside itself.');
  const { error } = await supabase.from('categories').update({ parent_id: newParentId }).eq('id', id);
  if (error) throw error;
}

/** Deletes the category and its sub-categories. Their items stay, without a category. */
export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Make sure a path like ['Kitchen', 'Spices'] exists under `startId`, creating any
 * missing levels. Returns the id of the deepest category. `known` is updated in place
 * so repeated calls in one batch don't create duplicates.
 */
export async function ensureCategoryPath(familyId: string, known: Category[], startId: string, names: readonly string[], leafRestockMode: RestockMode | null = null): Promise<string> {
  const { atId, missing } = planPath(known, startId, names);
  let parent = atId;
  for (const [i, name] of missing.entries()) {
    const isLeaf = i === missing.length - 1;
    const created = await addCategory(familyId, parent, name, isLeaf ? leafRestockMode : null);
    known.push(created);
    parent = created.id;
  }
  return parent;
}
