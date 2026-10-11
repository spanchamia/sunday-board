import { supabase } from '../lib/supabase';

/** Start a new family; you become its owner. Creates the "My Home" category. */
export async function createFamily(familyName: string, myName: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_family', { family_name: familyName.trim(), my_name: myName.trim() });
  if (error) throw error;
  return data;
}

/** Join a family with the invite code a member shared. */
export async function joinFamily(code: string, myName: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_family', { code: code.trim(), my_name: myName.trim() });
  if (error) throw error;
  return data;
}

/** Owner only: replace the invite code (the old one stops working). */
export async function newInviteCode(): Promise<string> {
  const { data, error } = await supabase.rpc('new_invite_code');
  if (error) throw error;
  return data;
}

export async function renameMe(userId: string, displayName: string): Promise<void> {
  const { error } = await supabase.from('family_members').update({ display_name: displayName.trim() }).eq('user_id', userId);
  if (error) throw error;
}
