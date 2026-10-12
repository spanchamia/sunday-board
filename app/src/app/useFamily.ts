import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Category, Family, Item, ItemStore, Member, Store } from '../lib/types';
import { effectiveRestockMode } from '../logic/tree';

/** An item plus what it really is (its own setting, else its category's). */
export type HomeItem = Item & { mode: 'staple' | 'as_needed' };

export interface FamilyData {
  family: Family;
  me: Member;
  members: Member[];
  categories: Category[];
  items: HomeItem[]; // live (not archived) items
  stores: Store[];
  itemStores: ItemStore[];
}

type State =
  | { status: 'loading' }
  | { status: 'no-family' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: FamilyData };

async function load(userId: string): Promise<State> {
  const me = await supabase.from('family_members').select('*').eq('user_id', userId).maybeSingle();
  if (me.error) return { status: 'error', message: me.error.message };
  if (!me.data) return { status: 'no-family' };
  const fid = me.data.family_id;
  const [family, members, categories, items, stores, itemStores] = await Promise.all([
    supabase.from('families').select('*').eq('id', fid).single(),
    supabase.from('family_members').select('*').eq('family_id', fid).order('joined_at'),
    supabase.from('categories').select('*').eq('family_id', fid),
    supabase.from('items').select('*').eq('family_id', fid).is('archived_at', null).order('name').limit(5000),
    supabase.from('stores').select('*').eq('family_id', fid).order('sort').order('name'),
    supabase.from('item_stores').select('*').eq('family_id', fid).limit(10000),
  ]);
  const err = [family, members, categories, items, stores, itemStores].find((r) => r.error)?.error;
  if (err) return { status: 'error', message: err.message };
  return {
    status: 'ready',
    data: {
      family: family.data!, me: me.data, members: members.data ?? [], categories: categories.data ?? [],
      items: (items.data ?? []).map((i) => ({ ...i, mode: effectiveRestockMode(categories.data ?? [], i) })), stores: stores.data ?? [], itemStores: itemStores.data ?? [],
    },
  };
}

/**
 * Everything the app needs about the signed-in person's family, kept fresh:
 * when another family member changes items or categories, this reloads.
 */
export function useFamily(userId: string) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const pending = useRef<number | undefined>(undefined);

  const reload = useCallback(async () => setState(await load(userId)), [userId]);
  useEffect(() => { void reload(); }, [reload]);

  const familyId = state.status === 'ready' ? state.data.family.id : null;
  useEffect(() => {
    if (!familyId) return;
    const soon = () => { window.clearTimeout(pending.current); pending.current = window.setTimeout(() => void reload(), 250); };
    const channel = supabase.channel(`family-${familyId}`);
    for (const table of ['items', 'categories'] as const) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` }, soon);
    }
    channel.subscribe();
    const onFocus = () => { if (document.visibilityState === 'visible') soon(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => { void supabase.removeChannel(channel); document.removeEventListener('visibilitychange', onFocus); };
  }, [familyId, reload]);

  return { state, reload };
}
