import { supabase } from '../lib/supabase';
import type { Store } from '../lib/types';
import { cleanName } from '../logic/text';

export async function addStore(familyId: string, name: string, sort = 0): Promise<Store> {
  const { data, error } = await supabase.from('stores').insert({ family_id: familyId, name: cleanName(name), sort }).select().single();
  if (error) throw error;
  return data;
}

export async function renameStore(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('stores').update({ name: cleanName(name) }).eq('id', id);
  if (error) throw error;
}

export async function deleteStore(id: string): Promise<void> {
  const { error } = await supabase.from('stores').delete().eq('id', id);
  if (error) throw error;
}
